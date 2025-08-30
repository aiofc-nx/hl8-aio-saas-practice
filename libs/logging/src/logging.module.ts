/**
 * @file logging.module.ts
 * @description 日志管理模块
 *
 * 该模块整合了所有日志相关的服务，包括：
 * - Pino日志服务
 * - 日志配置服务
 * - 日志传输器
 * - 日志格式化器
 * - 日志中间件
 * - 日志拦截器
 *
 * 遵循DDD和Clean Architecture原则，提供统一的日志管理功能。
 */

import { DynamicModule, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClsModule } from 'nestjs-cls';
import { PinoLoggerService } from './services/pino-logger.service';
import { PinoLoggerConfigService } from './services/pino-logger-config.service';
import { PinoLoggerFactory } from './factories/pino-logger.factory';
import { PinoLoggingMiddleware } from './middleware/pino-logging.middleware';
import { PinoLoggingInterceptor } from './interceptors/pino-logging.interceptor';
import { LogConfig } from './interfaces/logging.interface';

/**
 * @interface LoggingModuleOptions
 * @description
 * 日志模块配置选项接口，用于自定义日志模块的行为。
 *
 * 主要配置项：
 * 1. config: 日志配置对象
 * 2. global: 是否注册为全局模块
 * 3. middleware: 是否自动注册中间件
 * 4. interceptor: 是否自动注册拦截器
 */
export interface LoggingModuleOptions {
  /** 日志配置 */
  config?: Partial<LogConfig>;
  /** 是否注册为全局模块 */
  global?: boolean;
  /** 是否自动注册中间件 */
  middleware?: boolean;
  /** 是否自动注册拦截器 */
  interceptor?: boolean;
}

/**
 * @class LoggingModule
 * @description
 * Aiofix IAM平台日志模块，提供高性能的日志服务。
 *
 * 主要功能：
 * 1. 提供PinoLoggerService日志服务
 * 2. 提供PinoLoggerConfigService配置服务
 * 3. 提供PinoLoggerFactory日志工厂
 * 4. 提供PinoLoggingMiddleware日志中间件
 * 5. 提供PinoLoggingInterceptor日志拦截器
 *
 * 使用示例：
 * ```typescript
 * import { LoggingModule } from '@aiofix/logging';
 *
 * @Module({
 *   imports: [
 *     LoggingModule.register({
 *       config: {
 *         level: 'info',
 *         format: 'json',
 *         colorize: false
 *       },
 *       global: true,
 *       middleware: true,
 *       interceptor: true
 *     })
 *   ]
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class LoggingModule {
  /**
   * @function register
   * @description
   * 注册日志模块，支持自定义配置。
   *
   * @param {LoggingModuleOptions} options - 模块配置选项
   * @returns {DynamicModule} 动态模块配置
   */
  static register(options: LoggingModuleOptions = {}): DynamicModule {
    const {
      config = {},
      global = false,
      middleware = false,
      interceptor = false,
    } = options;

    const moduleConfig: DynamicModule = {
      module: LoggingModule,
      imports: [
        EventEmitterModule.forRoot(),
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            setup: (cls, req) => {
              // 设置请求上下文
              cls.set(
                'requestId',
                req.headers['x-request-id'] || cls.get('requestId')
              );
              cls.set(
                'tenantId',
                req.headers['x-tenant-id'] || cls.get('tenantId')
              );
              cls.set('userId', req.headers['x-user-id'] || cls.get('userId'));
              cls.set(
                'sessionId',
                req.headers['x-session-id'] || cls.get('sessionId')
              );
            },
          },
        }),
      ],
      providers: [
        {
          provide: 'LOGGING_CONFIG',
          useValue: config,
        },
        PinoLoggerConfigService,
        PinoLoggerService,
        PinoLoggerFactory,
      ],
      exports: [PinoLoggerService, PinoLoggerConfigService, PinoLoggerFactory],
    };

    // 根据配置添加中间件和拦截器
    if (middleware) {
      moduleConfig.providers!.push(PinoLoggingMiddleware);
      moduleConfig.exports!.push(PinoLoggingMiddleware);
    }

    if (interceptor) {
      moduleConfig.providers!.push(PinoLoggingInterceptor);
      moduleConfig.exports!.push(PinoLoggingInterceptor);
    }

    // 设置为全局模块
    if (global) {
      moduleConfig.global = true;
    }

    return moduleConfig;
  }

  /**
   * @function forRoot
   * @description
   * 注册日志模块的便捷方法，使用默认配置。
   *
   * @param {LoggingModuleOptions} options - 模块配置选项
   * @returns {DynamicModule} 动态模块配置
   */
  static forRoot(options: LoggingModuleOptions = {}): DynamicModule {
    return this.register({
      global: true,
      middleware: true,
      interceptor: true,
      ...options,
    });
  }

  /**
   * @function forFeature
   * @description
   * 注册日志模块的特性版本，不包含中间件和拦截器。
   *
   * @param {LoggingModuleOptions} options - 模块配置选项
   * @returns {DynamicModule} 动态模块配置
   */
  static forFeature(options: LoggingModuleOptions = {}): DynamicModule {
    return this.register({
      global: false,
      middleware: false,
      interceptor: false,
      ...options,
    });
  }
}
