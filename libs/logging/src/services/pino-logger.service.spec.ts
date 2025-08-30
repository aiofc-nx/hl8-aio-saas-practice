import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import { PinoLoggerService } from './pino-logger.service';
import { PinoLoggerConfigService } from './pino-logger-config.service';
import { PinoLoggerFactory } from '../factories/pino-logger.factory';
import { LogContext, LogLevel } from '../interfaces/logging.interface';

describe('PinoLoggerService', () => {
  let service: PinoLoggerService;
  let eventEmitter: EventEmitter2;
  let configService: PinoLoggerConfigService;
  let loggerFactory: PinoLoggerFactory;
  let clsService: ClsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PinoLoggerService,
        PinoLoggerConfigService,
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: PinoLoggerFactory,
          useValue: {
            createLogger: jest.fn().mockReturnValue({
              debug: jest.fn(),
              info: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
              fatal: jest.fn(),
              trace: jest.fn(),
              child: jest.fn(),
              flush: jest.fn(),
            }),
            createChildLogger: jest.fn().mockReturnValue({
              debug: jest.fn(),
              info: jest.fn(),
              warn: jest.fn(),
              error: jest.fn(),
              fatal: jest.fn(),
              trace: jest.fn(),
            }),
          },
        },
        {
          provide: ClsService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            run: jest.fn(),
            runWith: jest.fn(),
            enter: jest.fn(),
            exit: jest.fn(),
            isActive: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<PinoLoggerService>(PinoLoggerService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    configService = module.get<PinoLoggerConfigService>(
      PinoLoggerConfigService
    );
    loggerFactory = module.get<PinoLoggerFactory>(PinoLoggerFactory);
    clsService = module.get<ClsService>(ClsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('basic logging', () => {
    beforeEach(() => {
      jest.spyOn(configService, 'getConfig').mockReturnValue({
        level: 'info',
        format: 'json' as any,
        colorize: true,
        timestamp: true,
        requestId: true,
        tenantId: true,
        userId: true,
        performance: true,
        stackTrace: true,
        filePath: undefined,
        rotation: { maxSize: '10m', maxFiles: 5, interval: '1d' },
        remote: undefined,
      });
    });

    it('should log debug messages', () => {
      const spy = jest.spyOn(service as any, 'log');
      service.debug('Debug message', LogContext.SYSTEM, { test: 'data' });
      expect(spy).toHaveBeenCalledWith(
        'debug',
        'Debug message',
        LogContext.SYSTEM,
        { test: 'data' },
        undefined
      );
    });

    it('should log info messages', () => {
      const spy = jest.spyOn(service as any, 'log');
      service.info('Info message', LogContext.BUSINESS, { operation: 'test' });
      expect(spy).toHaveBeenCalledWith(
        'info',
        'Info message',
        LogContext.BUSINESS,
        { operation: 'test' },
        undefined
      );
    });

    it('should log warn messages', () => {
      const spy = jest.spyOn(service as any, 'log');
      service.warn('Warning message', LogContext.AUTH, { userId: '123' });
      expect(spy).toHaveBeenCalledWith(
        'warn',
        'Warning message',
        LogContext.AUTH,
        { userId: '123' },
        undefined
      );
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      const spy = jest.spyOn(service as any, 'log');
      service.error(
        'Error message',
        LogContext.DATABASE,
        { query: 'SELECT *' },
        error
      );
      expect(spy).toHaveBeenCalledWith(
        'error',
        'Error message',
        LogContext.DATABASE,
        { query: 'SELECT *' },
        error
      );
    });

    it('should log fatal messages', () => {
      const spy = jest.spyOn(service as any, 'log');
      service.fatal('Fatal message', LogContext.SYSTEM, { critical: true });
      expect(spy).toHaveBeenCalledWith(
        'fatal',
        'Fatal message',
        LogContext.SYSTEM,
        { critical: true },
        undefined
      );
    });

    it('should log trace messages', () => {
      const spy = jest.spyOn(service as any, 'log');
      service.trace('Trace message', LogContext.PERFORMANCE, { duration: 100 });
      expect(spy).toHaveBeenCalledWith(
        'trace',
        'Trace message',
        LogContext.PERFORMANCE,
        { duration: 100 },
        undefined
      );
    });
  });

  describe('specialized logging', () => {
    it('should log performance messages', () => {
      const spy = jest.spyOn(service as any, 'log');
      service.performance('database_query', 150, LogContext.DATABASE, {
        table: 'users',
      });
      expect(spy).toHaveBeenCalledWith(
        'info',
        'Performance: database_query took 150ms',
        LogContext.DATABASE,
        {
          table: 'users',
          operation: 'database_query',
          duration: 150,
          type: 'performance',
        }
      );
    });

    it('should log business messages', () => {
      const spy = jest.spyOn(service as any, 'log');
      service.business('User registered', {
        userId: '123',
        email: 'test@example.com',
      });
      expect(spy).toHaveBeenCalledWith(
        'info',
        'User registered',
        LogContext.BUSINESS,
        {
          userId: '123',
          email: 'test@example.com',
        }
      );
    });

    it('should log security messages', () => {
      const spy = jest.spyOn(service as any, 'log');
      service.security('Failed login attempt', {
        ip: '192.168.1.1',
        username: 'test',
      });
      expect(spy).toHaveBeenCalledWith(
        'warn',
        'Failed login attempt',
        LogContext.AUTH,
        {
          ip: '192.168.1.1',
          username: 'test',
        }
      );
    });
  });

  describe('configuration', () => {
    it('should get and set log level', () => {
      jest.spyOn(configService, 'getLevel').mockReturnValue('info');
      jest.spyOn(configService, 'setLevel').mockImplementation(() => undefined);

      const originalLevel = service.getLevel();
      service.setLevel('debug');

      expect(configService.setLevel).toHaveBeenCalledWith('debug');
      expect(configService.getLevel).toHaveBeenCalled();
    });

    it('should get and update config', () => {
      const mockConfig = {
        level: 'warn' as LogLevel,
        format: 'json' as any,
        colorize: true,
        timestamp: true,
        requestId: true,
        tenantId: true,
        userId: true,
        performance: true,
        stackTrace: true,
        filePath: undefined,
        rotation: { maxSize: '10m', maxFiles: 5, interval: '1d' },
        remote: undefined,
      };
      jest.spyOn(configService, 'getConfig').mockReturnValue(mockConfig);
      jest
        .spyOn(configService, 'updateConfig')
        .mockImplementation(() => undefined);

      const config = service.getConfig();
      service.updateConfig({ level: 'warn' });

      expect(configService.getConfig).toHaveBeenCalled();
      expect(configService.updateConfig).toHaveBeenCalledWith({
        level: 'warn',
      });
      expect(config).toEqual(mockConfig);
    });
  });

  describe('child logger', () => {
    it('should create child logger', () => {
      const mockChildLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        fatal: jest.fn(),
        trace: jest.fn(),
      };
      jest
        .spyOn(loggerFactory, 'createChildLogger')
        .mockReturnValue(mockChildLogger as any);

      const childLogger = service.child(LogContext.DATABASE, {
        tenantId: '123',
      });

      expect(childLogger).toBeDefined();
      expect(childLogger).toBeInstanceOf(PinoLoggerService);
      expect(loggerFactory.createChildLogger).toHaveBeenCalledWith(
        expect.anything(),
        { context: LogContext.DATABASE, tenantId: '123' }
      );
    });
  });

  describe('statistics', () => {
    it('should track log statistics', () => {
      // 重置统计
      service.resetStats();

      // 记录一些日志
      service.info('Test message 1', LogContext.BUSINESS);
      service.warn('Test message 2', LogContext.AUTH);
      service.error('Test message 3', LogContext.DATABASE);

      const stats = service.getStats();

      expect(stats.totalLogs).toBeGreaterThanOrEqual(3);
      expect(stats.logsByLevel.info).toBeGreaterThanOrEqual(1);
      expect(stats.logsByLevel.warn).toBeGreaterThanOrEqual(1);
      expect(stats.logsByLevel.error).toBeGreaterThanOrEqual(1);
      expect(stats.logsByContext[LogContext.BUSINESS]).toBeGreaterThanOrEqual(
        1
      );
      expect(stats.logsByContext[LogContext.AUTH]).toBeGreaterThanOrEqual(1);
      expect(stats.logsByContext[LogContext.DATABASE]).toBeGreaterThanOrEqual(
        1
      );
      expect(stats.averageLogSize).toBeGreaterThan(0);
      expect(stats.lastLogTime).toBeDefined();
    });

    it('should reset statistics', () => {
      // 记录一些日志
      service.info('Test message');

      // 重置统计
      service.resetStats();

      const stats = service.getStats();
      expect(stats.totalLogs).toBe(0);
      expect(stats.logsByLevel.info).toBe(0);
    });
  });

  describe('event emission', () => {
    it('should emit log events', () => {
      service.info('Test message', LogContext.BUSINESS, { test: 'data' });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'logger.log',
        expect.objectContaining({
          level: 'info',
          message: 'Test message',
          context: LogContext.BUSINESS,
          metadata: { test: 'data' },
        })
      );
    });
  });

  describe('lifecycle methods', () => {
    it('should flush and close logger', async () => {
      await expect(service.flush()).resolves.not.toThrow();
      await expect(service.close()).resolves.not.toThrow();
    });

    it('should handle module destruction', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
