/**
 * @file logging.module.spec.ts
 * @description 日志模块单元测试
 *
 * 测试Pino日志服务的核心功能，包括：
 * - 日志级别控制
 * - 结构化日志输出
 * - 上下文管理
 * - 性能监控
 * - 错误处理
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClsModule } from 'nestjs-cls';
import { PinoLoggerService } from './services/pino-logger.service';
import { PinoLoggerConfigService } from './services/pino-logger-config.service';
import { PinoLoggerFactory } from './factories/pino-logger.factory';
import { PinoLoggingMiddleware } from './middleware/pino-logging.middleware';
import { PinoLoggingInterceptor } from './interceptors/pino-logging.interceptor';
import { LogContext, LogLevel } from './interfaces/logging.interface';

describe('LoggingModule', () => {
  let module: TestingModule;
  let loggerService: PinoLoggerService;
  let configService: PinoLoggerConfigService;
  let loggerFactory: PinoLoggerFactory;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            setup: (cls, req) => {
              cls.set('requestId', 'test-request-id');
              cls.set('tenantId', 'test-tenant-id');
              cls.set('userId', 'test-user-id');
            },
          },
        }),
      ],
      providers: [
        PinoLoggerConfigService,
        PinoLoggerFactory,
        PinoLoggerService,
        PinoLoggingMiddleware,
        PinoLoggingInterceptor,
      ],
    }).compile();

    loggerService = module.get<PinoLoggerService>(PinoLoggerService);
    configService = module.get<PinoLoggerConfigService>(
      PinoLoggerConfigService
    );
    loggerFactory = module.get<PinoLoggerFactory>(PinoLoggerFactory);
  });

  afterAll(async () => {
    if (module) {
      await module.close();
    }
  });

  describe('Module Initialization', () => {
    it('should be defined', () => {
      expect(module).toBeDefined();
    });

    it('should have PinoLoggerService', () => {
      expect(loggerService).toBeDefined();
    });

    it('should have PinoLoggerConfigService', () => {
      expect(configService).toBeDefined();
    });

    it('should have PinoLoggerFactory', () => {
      expect(loggerFactory).toBeDefined();
    });
  });

  describe('PinoLoggerService', () => {
    it('should log different levels', () => {
      const spy = jest
        .spyOn(loggerService as any, 'log')
        .mockImplementation(() => undefined);

      loggerService.debug('Debug message', LogContext.SYSTEM);
      loggerService.info('Info message', LogContext.BUSINESS);
      loggerService.warn('Warning message', LogContext.AUTH);
      loggerService.error('Error message', LogContext.SYSTEM);

      expect(spy).toHaveBeenCalledTimes(4);
      expect(spy).toHaveBeenCalledWith(
        'debug',
        'Debug message',
        LogContext.SYSTEM,
        undefined,
        undefined
      );
      expect(spy).toHaveBeenCalledWith(
        'info',
        'Info message',
        LogContext.BUSINESS,
        undefined,
        undefined
      );
      expect(spy).toHaveBeenCalledWith(
        'warn',
        'Warning message',
        LogContext.AUTH,
        undefined,
        undefined
      );
      expect(spy).toHaveBeenCalledWith(
        'error',
        'Error message',
        LogContext.SYSTEM,
        undefined,
        undefined
      );

      spy.mockRestore();
    });

    it('should log with metadata', () => {
      const spy = jest
        .spyOn(loggerService as any, 'log')
        .mockImplementation(() => undefined);
      const metadata = {
        requestId: 'test-request-id',
        tenantId: 'test-tenant-id',
        userId: 'test-user-id',
        operation: 'test-operation',
      };

      loggerService.info('Test message', LogContext.BUSINESS, metadata);

      expect(spy).toHaveBeenCalledWith(
        'info',
        'Test message',
        LogContext.BUSINESS,
        metadata,
        undefined
      );

      spy.mockRestore();
    });

    it('should log errors with stack trace', () => {
      const spy = jest
        .spyOn(loggerService as any, 'log')
        .mockImplementation(() => undefined);
      const error = new Error('Test error');

      loggerService.error(
        'Error occurred',
        LogContext.SYSTEM,
        undefined,
        error
      );

      expect(spy).toHaveBeenCalledWith(
        'error',
        'Error occurred',
        LogContext.SYSTEM,
        undefined,
        error
      );

      spy.mockRestore();
    });

    it('should log performance metrics', () => {
      const spy = jest
        .spyOn(loggerService as any, 'log')
        .mockImplementation(() => undefined);

      loggerService.performance('test-operation', 150, LogContext.PERFORMANCE);

      expect(spy).toHaveBeenCalledWith(
        'info',
        'Performance: test-operation took 150ms',
        LogContext.PERFORMANCE,
        {
          operation: 'test-operation',
          duration: 150,
          type: 'performance',
        }
      );

      spy.mockRestore();
    });

    it('should create child logger', () => {
      const childLogger = loggerService.child(LogContext.BUSINESS, {
        tenantId: 'child-tenant',
      });
      expect(childLogger).toBeDefined();
      expect(childLogger).toHaveProperty('info');
      expect(childLogger).toHaveProperty('error');
      expect(childLogger).toHaveProperty('warn');
    });

    it('should get and set log level', () => {
      const originalLevel = loggerService.getLevel();

      loggerService.setLevel('debug');
      expect(loggerService.getLevel()).toBe('debug');

      loggerService.setLevel(originalLevel);
      expect(loggerService.getLevel()).toBe(originalLevel);
    });

    it('should get stats', () => {
      const stats = loggerService.getStats();
      expect(stats).toHaveProperty('totalLogs');
      expect(stats).toHaveProperty('logsByLevel');
      expect(stats).toHaveProperty('logsByContext');
      expect(stats).toHaveProperty('averageLogSize');
    });
  });

  describe('PinoLoggerConfigService', () => {
    it('should get default config', () => {
      const config = configService.getConfig();
      expect(config).toBeDefined();
      expect(config).toHaveProperty('level');
      expect(config).toHaveProperty('format');
      expect(config).toHaveProperty('timestamp');
    });

    it('should update config', () => {
      const originalConfig = configService.getConfig();
      const newConfig = { level: 'debug' as LogLevel };

      configService.updateConfig(newConfig);
      expect(configService.getLevel()).toBe('debug');

      // 恢复原始配置
      configService.updateConfig(originalConfig);
    });

    it('should detect environment', () => {
      const isDev = configService.isDevelopment();
      const isProd = configService.isProduction();

      expect(typeof isDev).toBe('boolean');
      expect(typeof isProd).toBe('boolean');
    });
  });

  describe('PinoLoggerFactory', () => {
    it('should create logger', () => {
      const logger = loggerFactory.createLogger();
      expect(logger).toBeDefined();
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('error');
      expect(logger).toHaveProperty('warn');
    });

    it('should create child logger', () => {
      const parentLogger = loggerFactory.createLogger();
      const childLogger = loggerFactory.createChildLogger(parentLogger, {
        context: 'test',
      });

      expect(childLogger).toBeDefined();
      expect(childLogger).toHaveProperty('info');
      expect(childLogger).toHaveProperty('error');
    });
  });

  describe('Logging Middleware and Interceptor', () => {
    it('should have middleware defined', () => {
      const middleware = module.get<PinoLoggingMiddleware>(
        PinoLoggingMiddleware
      );
      expect(middleware).toBeDefined();
      expect(middleware).toHaveProperty('use');
    });

    it('should have interceptor defined', () => {
      const interceptor = module.get<PinoLoggingInterceptor>(
        PinoLoggingInterceptor
      );
      expect(interceptor).toBeDefined();
      expect(interceptor).toHaveProperty('intercept');
    });
  });
});
