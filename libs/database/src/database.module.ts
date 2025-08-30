/**
 * @file database.module.ts
 * @description 数据库适配器模块
 *
 * 该模块整合了所有数据库相关的服务，包括：
 * - PostgreSQL适配器
 * - 数据库管理器
 * - 数据库工厂
 * - 健康检查服务
 * - 配置管理
 *
 * 遵循DDD和Clean Architecture原则，提供统一的数据库管理功能。
 */

import { DynamicModule, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { LoggingModule, PinoLoggerService } from '@aiofix/logging';

// 导入配置
import { databaseConfig, DatabaseConfig } from './config/database.config';

// 导入适配器
import { PostgreSQLAdapter } from './adapters/postgresql.adapter';

// 导入接口
// import type {
//   IDatabaseAdapter,
//   IDatabaseManager,
//   IDatabaseFactory,
// } from "./interfaces/database.interface";

/**
 * @interface DatabaseModuleOptions
 * @description 数据库模块配置选项
 */
export interface DatabaseModuleOptions {
  /** 数据库配置 */
  config?: Partial<DatabaseConfig>;
  /** 是否全局模块 */
  global?: boolean;
  /** 是否启用PostgreSQL */
  postgresql?: boolean;
  /** 是否启用健康检查 */
  healthCheck?: boolean;
  /** 是否启用监控 */
  monitoring?: boolean;
}

/**
 * @class DatabaseModule
 * @description 数据库适配器模块
 *
 * 提供统一的数据库管理功能，包括：
 * - 多数据库支持
 * - 连接池管理
 * - 健康检查
 * - 性能监控
 * - 事件通知
 */
@Module({})
export class DatabaseModule {
  static register(options: DatabaseModuleOptions = {}): DynamicModule {
    const { config = {}, global = false, postgresql = true } = options;

    const moduleConfig: DynamicModule = {
      module: DatabaseModule,
      imports: [
        ConfigModule.forFeature(databaseConfig),
        EventEmitterModule.forRoot(),
        LoggingModule,
      ],
      providers: [
        // 配置提供者
        {
          provide: 'DATABASE_CONFIG',
          useFactory: (defaultConfig: DatabaseConfig) => ({
            ...defaultConfig,
            ...config,
          }),
          inject: [databaseConfig.KEY],
        },

        // 数据库名称提供者
        {
          provide: 'DATABASE_NAME',
          useValue: 'postgresql',
        },

        // PostgreSQL适配器
        ...(postgresql
          ? [
              {
                provide: 'POSTGRESQL_ADAPTER',
                useFactory: (
                  config: DatabaseConfig,
                  eventEmitter: EventEmitter2,
                  logger: PinoLoggerService
                ) => {
                  return new PostgreSQLAdapter(
                    config,
                    'postgresql',
                    eventEmitter,
                    logger
                  );
                },
                inject: ['DATABASE_CONFIG', EventEmitter2, PinoLoggerService],
              },
            ]
          : []),

        // 数据库适配器接口
        {
          provide: 'IDatabaseAdapter',
          useExisting: 'POSTGRESQL_ADAPTER',
        },

        // 具体实现类
        ...(postgresql ? [PostgreSQLAdapter] : []),
      ],
      exports: [
        // 导出接口
        'IDatabaseAdapter',

        // 导出配置
        'DATABASE_CONFIG',

        // 导出具体实现
        ...(postgresql ? ['POSTGRESQL_ADAPTER', PostgreSQLAdapter] : []),
      ],
    };

    if (global) {
      moduleConfig.global = true;
    }

    return moduleConfig;
  }

  static forRoot(options: DatabaseModuleOptions = {}): DynamicModule {
    return this.register({
      ...options,
      global: true,
    });
  }

  static forFeature(options: DatabaseModuleOptions = {}): DynamicModule {
    return this.register({
      ...options,
      global: false,
    });
  }
}
