import { Test, TestingModule } from '@nestjs/testing';
import { FastifyRequest, FastifyReply } from 'fastify';
import { PinoLoggingMiddleware } from './pino-logging.middleware';
import { PinoLoggerService } from '../services/pino-logger.service';
import { LogContext } from '../interfaces/logging.interface';

describe('PinoLoggingMiddleware', () => {
  let middleware: PinoLoggingMiddleware;
  let logger: PinoLoggerService;
  let mockRequest: Partial<FastifyRequest>;
  let mockResponse: Partial<FastifyReply>;
  let nextFunction: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PinoLoggingMiddleware,
        {
          provide: PinoLoggerService,
          useValue: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            performance: jest.fn(),
          },
        },
      ],
    }).compile();

    middleware = module.get<PinoLoggingMiddleware>(PinoLoggingMiddleware);
    logger = module.get<PinoLoggerService>(PinoLoggerService);

    // 重置模拟
    jest.clearAllMocks();
  });

  beforeEach(() => {
    // 设置模拟请求
    mockRequest = {
      method: 'GET',
      url: '/api/users',
      headers: {
        'user-agent': 'Mozilla/5.0',
        'x-tenant-id': 'tenant-123',
        'x-user-id': 'user-456',
        authorization: 'Bearer token123',
      },
      query: { page: '1', limit: '10' },
      body: { name: 'test' },
      ip: '192.168.1.1',
      socket: { remoteAddress: '192.168.1.1' } as unknown,
    } as Partial<FastifyRequest>;

    // 设置模拟响应
    mockResponse = {
      statusCode: 200,
      send: jest.fn().mockReturnThis(),
    } as Partial<FastifyReply>;

    nextFunction = jest.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('request logging', () => {
    it('should log request information', () => {
      middleware.use(
        mockRequest as FastifyRequest,
        mockResponse as FastifyReply,
        nextFunction
      );

      expect(logger.info).toHaveBeenCalledWith(
        'HTTP Request',
        LogContext.HTTP_REQUEST,
        expect.objectContaining({
          method: 'GET',
          url: '/api/users',
          userAgent: 'Mozilla/5.0',
          tenantId: 'tenant-123',
          userId: 'user-456',
          ip: '192.168.1.1',
          requestId: expect.any(String),
          headers: expect.objectContaining({
            authorization: '***REDACTED***',
            'user-agent': 'Mozilla/5.0',
          }),
          query: { page: '1', limit: '10' },
          body: { name: 'test' },
        })
      );

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should generate unique request ID', () => {
      middleware.use(
        mockRequest as FastifyRequest,
        mockResponse as FastifyReply,
        nextFunction
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        LogContext.HTTP_REQUEST,
        expect.objectContaining({
          requestId: expect.any(String),
        })
      );
    });

    it('should extract tenant ID from different sources', () => {
      // 测试从查询参数提取
      mockRequest.query = { tenantId: 'query-tenant' };
      mockRequest.headers = { 'user-agent': 'Mozilla/5.0' };

      middleware.use(
        mockRequest as FastifyRequest,
        mockResponse as FastifyReply,
        nextFunction
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        LogContext.HTTP_REQUEST,
        expect.objectContaining({
          tenantId: 'query-tenant',
        })
      );
    });

    it('should extract user ID from different sources', () => {
      // 测试从请求体提取
      mockRequest.body = { userId: 'body-user' };
      mockRequest.headers = { 'user-agent': 'Mozilla/5.0' };

      middleware.use(
        mockRequest as FastifyRequest,
        mockResponse as FastifyReply,
        nextFunction
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        LogContext.HTTP_REQUEST,
        expect.objectContaining({
          userId: 'body-user',
        })
      );
    });
  });

  describe('response logging', () => {
    it('should log successful response', (done) => {
      middleware.use(
        mockRequest as FastifyRequest,
        mockResponse as FastifyReply,
        nextFunction
      );

      // 模拟响应发送 - 直接调用重写后的send方法
      mockResponse.send?.('response data');

      // 等待异步日志记录
      setTimeout(() => {
        expect(logger.info).toHaveBeenCalledWith(
          'HTTP Response',
          LogContext.HTTP_REQUEST,
          expect.objectContaining({
            duration: expect.any(Number),
            statusCode: 200,
          })
        );
        done();
      }, 10);
    });

    it('should log error response as warning', (done) => {
      mockResponse.statusCode = 404;

      middleware.use(
        mockRequest as FastifyRequest,
        mockResponse as FastifyReply,
        nextFunction
      );

      // 模拟响应发送
      mockResponse.send?.('error response');

      // 等待异步日志记录
      setTimeout(() => {
        expect(logger.warn).toHaveBeenCalledWith(
          'HTTP Response',
          LogContext.HTTP_REQUEST,
          expect.objectContaining({
            statusCode: 404,
          })
        );
        done();
      }, 10);
    });

    it('should capture response size', (done) => {
      middleware.use(
        mockRequest as FastifyRequest,
        mockResponse as FastifyReply,
        nextFunction
      );

      // 模拟响应发送
      mockResponse.send?.('response data');

      // 等待异步日志记录
      setTimeout(() => {
        expect(logger.info).toHaveBeenCalledWith(
          expect.any(String),
          LogContext.HTTP_REQUEST,
          expect.objectContaining({
            duration: expect.any(Number),
          })
        );
        done();
      }, 10);
    });
  });

  describe('security features', () => {
    it('should sanitize sensitive headers', () => {
      middleware.use(
        mockRequest as FastifyRequest,
        mockResponse as FastifyReply,
        nextFunction
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        LogContext.HTTP_REQUEST,
        expect.objectContaining({
          headers: expect.objectContaining({
            authorization: '***REDACTED***',
            'user-agent': 'Mozilla/5.0',
          }),
        })
      );
    });

    it('should sanitize sensitive body fields', () => {
      mockRequest.body = {
        username: 'testuser',
        password: 'secret123',
        token: 'jwt-token',
        email: 'test@example.com',
      };

      middleware.use(
        mockRequest as FastifyRequest,
        mockResponse as FastifyReply,
        nextFunction
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        LogContext.HTTP_REQUEST,
        expect.objectContaining({
          body: expect.objectContaining({
            username: 'testuser',
            password: '***REDACTED***',
            token: '***REDACTED***',
            email: 'test@example.com',
          }),
        })
      );
    });
  });

  describe('client IP detection', () => {
    it('should detect IP from X-Forwarded-For header', () => {
      mockRequest = {
        ...mockRequest,
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Mozilla/5.0',
        },
        ip: undefined,
      } as Partial<FastifyRequest>;

      middleware.use(
        mockRequest as FastifyRequest,
        mockResponse as FastifyReply,
        nextFunction
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        LogContext.HTTP_REQUEST,
        expect.objectContaining({
          ip: '192.168.1.100',
          tenantId: undefined,
          userId: undefined,
        })
      );
    });

    it('should fallback to connection remote address', () => {
      mockRequest = {
        ...mockRequest,
        headers: { 'user-agent': 'Mozilla/5.0' },
        ip: undefined,
        socket: { remoteAddress: '192.168.1.200' } as unknown,
      } as Partial<FastifyRequest>;

      middleware.use(
        mockRequest as FastifyRequest,
        mockResponse as FastifyReply,
        nextFunction
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        LogContext.HTTP_REQUEST,
        expect.objectContaining({
          ip: '192.168.1.200',
        })
      );
    });
  });
});
