import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClsService } from 'nestjs-cls';
import pino from 'pino';
import {
  ILoggerService,
  LogContext,
  LogConfig,
  LogMetadata,
} from '../interfaces/logging.interface';
import {
  PinoLoggerConfigService,
  LogLevel,
} from './pino-logger-config.service';
import { PinoLoggerFactory } from '../factories/pino-logger.factory';

/**
 * @class PinoLoggerService
 * @description
 * 基于Pino的日志服务实现类，提供高性能的结构化日志功能。
 *
 * 主要功能包括：
 * 1. 支持多种日志级别（trace, debug, info, warn, error, fatal）
 * 2. 结构化日志输出（JSON格式）
 * 3. 日志上下文和元数据支持
 * 4. 性能监控和错误追踪
 * 5. 日志配置管理和动态更新
 * 6. 子日志器创建和管理
 * 7. 日志统计和监控
 *
 * @implements {ILoggerService}
 * @implements {OnModuleDestroy}
 */
@Injectable()
export class PinoLoggerService implements ILoggerService, OnModuleDestroy {
  private logger: pino.Logger = {} as pino.Logger;
  private stats: {
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByContext: Record<LogContext, number>;
    totalLogSize: number;
    lastLogTime?: Date;
  } = {
    totalLogs: 0,
    logsByLevel: {
      fatal: 0,
      error: 0,
      warn: 0,
      info: 0,
      debug: 0,
      trace: 0,
    },
    logsByContext: {
      [LogContext.HTTP_REQUEST]: 0,
      [LogContext.DATABASE]: 0,
      [LogContext.BUSINESS]: 0,
      [LogContext.AUTH]: 0,
      [LogContext.CONFIG]: 0,
      [LogContext.CACHE]: 0,
      [LogContext.EVENT]: 0,
      [LogContext.SYSTEM]: 0,
      [LogContext.EXTERNAL]: 0,
      [LogContext.PERFORMANCE]: 0,
    },
    totalLogSize: 0,
  };

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: PinoLoggerConfigService,
    private readonly loggerFactory: PinoLoggerFactory,
    private readonly cls: ClsService
  ) {
    this.initializeStats();
    this.initializeLogger();
  }

  /**
   * @method debug
   * @description 记录调试日志
   */
  debug(
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
    error?: Error
  ): void {
    this.log('debug', message, context, metadata, error);
  }

  /**
   * @method info
   * @description 记录信息日志
   */
  info(
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
    error?: Error
  ): void {
    this.log('info', message, context, metadata, error);
  }

  /**
   * @method warn
   * @description 记录警告日志
   */
  warn(
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
    error?: Error
  ): void {
    this.log('warn', message, context, metadata, error);
  }

  /**
   * @method error
   * @description 记录错误日志
   */
  error(
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
    error?: Error
  ): void {
    this.log('error', message, context, metadata, error);
  }

  /**
   * @method fatal
   * @description 记录致命错误日志
   */
  fatal(
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
    error?: Error
  ): void {
    this.log('fatal', message, context, metadata, error);
  }

  /**
   * @method trace
   * @description 记录跟踪日志
   */
  trace(
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
    error?: Error
  ): void {
    this.log('trace', message, context, metadata, error);
  }

  /**
   * @method performance
   * @description 记录性能日志
   */
  performance(
    operation: string,
    duration: number,
    context?: LogContext,
    metadata?: LogMetadata
  ): void {
    const performanceMetadata: LogMetadata = {
      ...metadata,
      operation,
      duration,
      type: 'performance',
    };
    this.log(
      'info',
      `Performance: ${operation} took ${duration}ms`,
      context || LogContext.PERFORMANCE,
      performanceMetadata
    );
  }

  /**
   * @method business
   * @description 记录业务日志
   */
  business(message: string, metadata?: LogMetadata): void {
    this.log('info', message, LogContext.BUSINESS, metadata);
  }

  /**
   * @method security
   * @description 记录安全日志
   */
  security(message: string, metadata?: LogMetadata): void {
    this.log('warn', message, LogContext.AUTH, metadata);
  }

  /**
   * @method child
   * @description 创建子日志器
   */
  child(context: LogContext, metadata?: LogMetadata): ILoggerService {
    const childLogger = this.loggerFactory.createChildLogger(this.logger, {
      context,
      ...metadata,
    });

    // 创建一个新的PinoLoggerService实例，使用子日志器
    const childService = new PinoLoggerService(
      this.eventEmitter,
      this.configService,
      this.loggerFactory,
      this.cls
    );
    (
      childService as unknown as {
        logger: pino.Logger;
        stats: PinoLoggerService['stats'];
      }
    ).logger = childLogger;
    (
      childService as unknown as {
        logger: pino.Logger;
        stats: PinoLoggerService['stats'];
      }
    ).stats = this.stats;

    return childService;
  }

  /**
   * @method setLevel
   * @description 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.configService.setLevel(level);
    this.initializeLogger();
  }

  /**
   * @method getLevel
   * @description 获取日志级别
   */
  getLevel(): LogLevel {
    return this.configService.getLevel();
  }

  /**
   * @method updateConfig
   * @description 更新日志配置
   */
  updateConfig(config: Partial<LogConfig>): void {
    this.configService.updateConfig(config);
    this.initializeLogger();
  }

  /**
   * @method getConfig
   * @description 获取日志配置
   */
  getConfig(): LogConfig {
    return this.configService.getConfig();
  }

  /**
   * @method flush
   * @description 刷新日志缓冲区
   */
  async flush(): Promise<void> {
    if (this.logger.flush) {
      await this.logger.flush();
    }
  }

  /**
   * @method close
   * @description 关闭日志器
   */
  async close(): Promise<void> {
    await this.flush();
  }

  /**
   * @method onModuleDestroy
   * @description 模块销毁时的清理工作
   */
  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  /**
   * @method getStats
   * @description 获取日志统计信息
   */
  getStats(): {
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByContext: Record<LogContext, number>;
    averageLogSize: number;
    lastLogTime?: Date;
  } {
    return {
      totalLogs: this.stats.totalLogs,
      logsByLevel: { ...this.stats.logsByLevel },
      logsByContext: { ...this.stats.logsByContext },
      averageLogSize:
        this.stats.totalLogs > 0
          ? this.stats.totalLogSize / this.stats.totalLogs
          : 0,
      lastLogTime: this.stats.lastLogTime,
    };
  }

  /**
   * @method resetStats
   * @description 重置日志统计
   */
  resetStats(): void {
    this.initializeStats();
  }

  // 私有辅助方法

  /**
   * @private
   * @method initializeStats
   * @description 初始化统计信息
   */
  private initializeStats(): void {
    this.stats = {
      totalLogs: 0,
      logsByLevel: {
        trace: 0,
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        fatal: 0,
      },
      logsByContext: {
        [LogContext.HTTP_REQUEST]: 0,
        [LogContext.DATABASE]: 0,
        [LogContext.BUSINESS]: 0,
        [LogContext.AUTH]: 0,
        [LogContext.CONFIG]: 0,
        [LogContext.CACHE]: 0,
        [LogContext.EVENT]: 0,
        [LogContext.SYSTEM]: 0,
        [LogContext.EXTERNAL]: 0,
        [LogContext.PERFORMANCE]: 0,
      },
      totalLogSize: 0,
    };
  }

  /**
   * @private
   * @method initializeLogger
   * @description 初始化Pino日志器
   */
  private initializeLogger(): void {
    this.logger = this.loggerFactory.createLogger();
  }

  /**
   * @private
   * @method log
   * @description 内部日志记录方法
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
    error?: Error
  ): void {
    const config = this.configService.getConfig();

    // 从CLS获取上下文信息
    const requestId = this.cls.get('requestId');
    const tenantId = this.cls.get('tenantId');
    const userId = this.cls.get('userId');

    const logData: Record<string, unknown> = {
      message,
      context: context || LogContext.SYSTEM,
      timestamp: new Date().toISOString(),
      requestId,
      tenantId,
      userId,
      ...metadata,
    };

    if (error) {
      logData.error = {
        message: error.message,
        stack: config.stackTrace ? error.stack : undefined,
        code: (error as unknown as Record<string, unknown>).code,
        name: error.name,
      };
    }

    // 更新统计信息
    this.updateStats(level, context || LogContext.SYSTEM, message.length);

    // 记录日志
    this.logger[level](logData);

    // 发送事件
    this.eventEmitter.emit('logger.log', {
      level,
      message,
      context: context || LogContext.SYSTEM,
      metadata,
      error,
      timestamp: new Date(),
    });
  }

  /**
   * @private
   * @method updateStats
   * @description 更新统计信息
   */
  private updateStats(
    level: LogLevel,
    context: LogContext,
    logSize: number
  ): void {
    this.stats.totalLogs++;
    this.stats.logsByLevel[level]++;
    this.stats.logsByContext[context]++;
    this.stats.totalLogSize += logSize;
    this.stats.lastLogTime = new Date();
  }
}
