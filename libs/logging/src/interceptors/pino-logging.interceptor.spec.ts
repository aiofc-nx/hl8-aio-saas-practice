import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { PinoLoggingInterceptor } from './pino-logging.interceptor';
import { PinoLoggerService } from '../services/pino-logger.service';
import { LogContext } from '../interfaces/logging.interface';

describe('PinoLoggingInterceptor', () => {
  let interceptor: PinoLoggingInterceptor;
  let logger: PinoLoggerService;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PinoLoggingInterceptor,
        {
          provide: PinoLoggerService,
          useValue: {
            debug: jest.fn(),
            info: jest.fn(),
            error: jest.fn(),
            performance: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<PinoLoggingInterceptor>(PinoLoggingInterceptor);
    logger = module.get<PinoLoggerService>(PinoLoggerService);

    // 重置模拟
    jest.clearAllMocks();
  });

  beforeEach(() => {
    // 设置模拟执行上下文
    mockExecutionContext = {
      getHandler: jest.fn().mockReturnValue({ name: 'testMethod' }),
      getClass: jest.fn().mockReturnValue({ name: 'TestController' }),
      getArgs: jest.fn().mockReturnValue([
        {
          method: 'GET',
          requestId: 'req-123',
          tenantId: 'tenant-123',
          userId: 'user-456',
        },
        { statusCode: 200 },
        { id: 1, name: 'test' },
      ]),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          requestId: 'req-123',
          tenantId: 'tenant-123',
          userId: 'user-456',
        }),
      }),
    } as any;

    // 设置模拟调用处理器
    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({ success: true, data: 'test' })),
    };
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  describe('successful method execution', () => {
    it('should log method start and success', done => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: result => {
          expect(logger.debug).toHaveBeenCalledWith(
            'Method Start: TestController.testMethod',
            LogContext.BUSINESS,
            expect.objectContaining({
              methodId: expect.any(String),
              className: 'TestController',
              methodName: 'testMethod',
              requestId: 'req-123',
              tenantId: 'tenant-123',
              userId: 'user-456',
              parameters: [{ id: 1, name: 'test' }],
            }),
          );

          expect(logger.info).toHaveBeenCalledWith(
            expect.stringMatching(
              /Method Success: TestController\.testMethod - \d+ms/,
            ),
            LogContext.BUSINESS,
            expect.objectContaining({
              methodId: expect.any(String),
              className: 'TestController',
              methodName: 'testMethod',
              requestId: 'req-123',
              tenantId: 'tenant-123',
              userId: 'user-456',
              result: { success: true, data: 'test' },
              duration: expect.any(Number),
            }),
          );

          expect(logger.performance).toHaveBeenCalledWith(
            'method_execution',
            expect.any(Number),
            LogContext.PERFORMANCE,
            expect.objectContaining({
              methodId: expect.any(String),
              className: 'TestController',
              methodName: 'testMethod',
            }),
          );

          expect(result).toEqual({ success: true, data: 'test' });
          done();
        },
        error: done,
      });
    });

    it('should generate unique method ID for each call', done => {
      const methodIds: string[] = [];

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const debugCall = (logger.debug as jest.Mock).mock.calls[0];
          const methodId = debugCall[2].methodId;
          methodIds.push(methodId);

          interceptor
            .intercept(mockExecutionContext, mockCallHandler)
            .subscribe({
              next: () => {
                const secondDebugCall = (logger.debug as jest.Mock).mock
                  .calls[1];
                const secondMethodId = secondDebugCall[2].methodId;
                methodIds.push(secondMethodId);

                expect(methodIds[0]).not.toBe(methodIds[1]);
                expect(methodIds[0]).toMatch(
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
                );
                expect(methodIds[1]).toMatch(
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
                );
                done();
              },
              error: done,
            });
        },
        error: done,
      });
    });
  });

  describe('method execution with error', () => {
    it('should log method start and error', done => {
      const testError = new Error('Test error');
      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => testError));

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          done(new Error('Should not reach here'));
        },
        error: error => {
          expect(logger.debug).toHaveBeenCalledWith(
            'Method Start: TestController.testMethod',
            LogContext.BUSINESS,
            expect.objectContaining({
              methodId: expect.any(String),
              className: 'TestController',
              methodName: 'testMethod',
            }),
          );

          expect(logger.error).toHaveBeenCalledWith(
            expect.stringMatching(
              /Method Error: TestController\.testMethod - \d+ms/,
            ),
            LogContext.BUSINESS,
            expect.objectContaining({
              methodId: expect.any(String),
              className: 'TestController',
              methodName: 'testMethod',
              parameters: [{ id: 1, name: 'test' }],
              duration: expect.any(Number),
            }),
            testError,
          );

          expect(error).toBe(testError);
          done();
        },
      });
    });
  });

  describe('parameter extraction', () => {
    it('should filter out HTTP request and response objects', done => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(logger.debug).toHaveBeenCalledWith(
            expect.any(String),
            LogContext.BUSINESS,
            expect.objectContaining({
              parameters: [{ id: 1, name: 'test' }],
            }),
          );
          done();
        },
        error: done,
      });
    });

    it('should handle empty parameters', done => {
      mockExecutionContext.getArgs = jest
        .fn()
        .mockReturnValue([{ method: 'GET' }, { statusCode: 200 }]);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(logger.debug).toHaveBeenCalledWith(
            expect.any(String),
            LogContext.BUSINESS,
            expect.objectContaining({
              parameters: [],
            }),
          );
          done();
        },
        error: done,
      });
    });
  });

  describe('parameter sanitization', () => {
    it('should sanitize sensitive parameters', done => {
      mockExecutionContext.getArgs = jest.fn().mockReturnValue([
        { method: 'GET' },
        { statusCode: 200 },
        {
          username: 'testuser',
          password: 'secret123',
          token: 'jwt-token',
          email: 'test@example.com',
        },
      ]);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(logger.debug).toHaveBeenCalledWith(
            expect.any(String),
            LogContext.BUSINESS,
            expect.objectContaining({
              parameters: [
                {
                  username: 'testuser',
                  password: '[REDACTED]',
                  token: '[REDACTED]',
                  email: 'test@example.com',
                },
              ],
            }),
          );
          done();
        },
        error: done,
      });
    });

    it('should sanitize nested sensitive parameters', done => {
      mockExecutionContext.getArgs = jest.fn().mockReturnValue([
        { method: 'GET' },
        { statusCode: 200 },
        {
          user: {
            name: 'testuser',
            credentials: {
              password: 'secret123',
              apiKey: 'key123',
            },
          },
        },
      ]);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(logger.debug).toHaveBeenCalledWith(
            expect.any(String),
            LogContext.BUSINESS,
            expect.objectContaining({
              parameters: [
                {
                  user: {
                    name: 'testuser',
                    credentials: {
                      password: '[REDACTED]',
                      apiKey: '[REDACTED]',
                    },
                  },
                },
              ],
            }),
          );
          done();
        },
        error: done,
      });
    });

    it('should sanitize array parameters', done => {
      mockExecutionContext.getArgs = jest.fn().mockReturnValue([
        { method: 'GET' },
        { statusCode: 200 },
        [
          { id: 1, password: 'secret1' },
          { id: 2, password: 'secret2' },
        ],
      ]);

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(logger.debug).toHaveBeenCalledWith(
            expect.any(String),
            LogContext.BUSINESS,
            expect.objectContaining({
              parameters: [
                [
                  { id: 1, password: '[REDACTED]' },
                  { id: 2, password: '[REDACTED]' },
                ],
              ],
            }),
          );
          done();
        },
        error: done,
      });
    });
  });

  describe('result sanitization', () => {
    it('should sanitize sensitive result fields', done => {
      mockCallHandler.handle = jest.fn().mockReturnValue(
        of({
          success: true,
          user: {
            id: 1,
            name: 'testuser',
            password: 'secret123',
            token: 'jwt-token',
          },
        }),
      );

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(logger.info).toHaveBeenCalledWith(
            expect.any(String),
            LogContext.BUSINESS,
            expect.objectContaining({
              result: {
                success: true,
                user: {
                  id: 1,
                  name: 'testuser',
                  password: '[REDACTED]',
                  token: '[REDACTED]',
                },
              },
            }),
          );
          done();
        },
        error: done,
      });
    });
  });

  describe('context extraction', () => {
    it('should extract context from request', done => {
      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(logger.debug).toHaveBeenCalledWith(
            expect.any(String),
            LogContext.BUSINESS,
            expect.objectContaining({
              requestId: 'req-123',
              tenantId: 'tenant-123',
              userId: 'user-456',
            }),
          );
          done();
        },
        error: done,
      });
    });

    it('should handle missing context', done => {
      mockExecutionContext.switchToHttp = jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
      });

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(logger.debug).toHaveBeenCalledWith(
            expect.any(String),
            LogContext.BUSINESS,
            expect.objectContaining({
              requestId: undefined,
              tenantId: undefined,
              userId: undefined,
            }),
          );
          done();
        },
        error: done,
      });
    });
  });
});
