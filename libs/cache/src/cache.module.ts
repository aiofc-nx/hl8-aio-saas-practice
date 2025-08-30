/**
 * @file cache.module.ts
 * @description 缓存管理模块
 *
 * 该模块整合了所有缓存相关的服务，包括：
 * - Redis缓存服务
 * - 内存缓存服务
 * - 缓存管理器
 * - 缓存键工厂
 * - 缓存失效服务
 * - 缓存预热服务
 * - 缓存装饰器和拦截器
 *
 * 遵循DDD和Clean Architecture原则，提供统一的缓存管理功能。
 */

import { DynamicModule, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ClsModule } from 'nestjs-cls';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';

// 导入配置
import { cacheConfig, CacheConfig } from './config/cache.config';

// 导入服务
import { RedisCacheService } from './services/redis-cache.service';
import { MemoryCacheService } from './services/memory-cache.service';
import { CacheManagerService } from './services/cache-manager.service';
import { CacheInvalidationService } from './services/cache-invalidation.service';
import { CacheWarmupService } from './services/cache-warmup.service';

// 导入工厂
import { CacheKeyFactory } from './factories/cache-key.factory';

// 导入拦截器
import {
  CacheInterceptor,
  CacheGetInterceptor,
  CacheSetInterceptor,
} from './interceptors/cache.interceptor';

// 导入接口

/**
 * @interface CacheModuleOptions
 * @description 缓存模块配置选项
 */
export interface CacheModuleOptions {
  /** 缓存配置 */
  config?: Partial<CacheConfig>;
  /** 是否全局模块 */
  global?: boolean;
  /** 是否启用Redis */
  redis?: boolean;
  /** 是否启用内存缓存 */
  memory?: boolean;
  /** 是否启用缓存管理器 */
  manager?: boolean;
  /** 是否启用缓存失效服务 */
  invalidation?: boolean;
  /** 是否启用缓存预热服务 */
  warmup?: boolean;
  /** 是否启用拦截器 */
  interceptors?: boolean;
}

/**
 * @class CacheModule
 * @description 缓存管理模块
 *
 * 提供统一的缓存管理功能，包括：
 * - 多级缓存支持
 * - 分布式缓存
 * - 缓存策略管理
 * - 缓存键管理
 * - 缓存失效策略
 * - 缓存性能监控
 * - 缓存预热机制
 * - AOP缓存支持
 */
@Module({})
export class CacheModule {
  static register(options: CacheModuleOptions = {}): DynamicModule {
    const {
      config = {},
      global = false,
      redis = true,
      memory = true,

      warmup = true,
      interceptors = true,
    } = options;

    const moduleConfig: DynamicModule = {
      module: CacheModule,
      imports: [
        ConfigModule.forFeature(cacheConfig),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(),
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            setup: (cls, req) => {
              // 从请求头或JWT中提取租户ID和用户ID
              const tenantId = req.headers['x-tenant-id'] || 'system';
              const userId = req.headers['x-user-id'] || 'anonymous';
              cls.set('tenantId', tenantId);
              cls.set('userId', userId);
            },
          },
        }),
      ],
      providers: [
        // 配置提供者
        {
          provide: 'CACHE_CONFIG',
          useFactory: (defaultConfig: CacheConfig) => ({
            ...defaultConfig,
            ...config,
          }),
          inject: [cacheConfig.KEY],
        },

        // Redis配置
        {
          provide: 'REDIS_CONFIG',
          useFactory: (defaultConfig: CacheConfig) => ({
            ...defaultConfig.redis,
            ...config.redis,
          }),
          inject: [cacheConfig.KEY],
        },

        // 内存缓存配置
        {
          provide: 'MEMORY_CACHE_CONFIG',
          useFactory: (defaultConfig: CacheConfig) => ({
            ...defaultConfig.memory,
            ...config.memory,
          }),
          inject: [cacheConfig.KEY],
        },

        // 缓存管理器配置
        {
          provide: 'CACHE_MANAGER_CONFIG',
          useFactory: (
            defaultConfig: CacheConfig,
            memoryService: MemoryCacheService,
            redisService: RedisCacheService
          ) => ({
            ...defaultConfig.manager,
            ...config.manager,
            layers: [
              {
                name: 'memory',
                priority: 1,
                service: memoryService,
                enabled: memory,
                readOnly: false,
                fallback: false,
              },
              {
                name: 'redis',
                priority: 2,
                service: redisService,
                enabled: redis,
                readOnly: false,
                fallback: true,
              },
            ],
          }),
          inject: [cacheConfig.KEY, MemoryCacheService, RedisCacheService],
        },

        // 缓存失效配置
        {
          provide: 'CACHE_INVALIDATION_CONFIG',
          useFactory: (defaultConfig: CacheConfig) => ({
            ...defaultConfig.invalidation,
            ...config.invalidation,
          }),
          inject: [cacheConfig.KEY],
        },

        // 缓存预热配置
        {
          provide: 'CACHE_WARMUP_CONFIG',
          useFactory: (defaultConfig: CacheConfig) => ({
            enabled: warmup,
            startupWarmup: true,
            scheduledWarmup: false,
            warmupInterval: 300000, // 5分钟
            concurrency: 5,
            timeout: 30000,
            retries: 3,
            retryDelay: 1000,
            logWarmup: true,
          }),
          inject: [cacheConfig.KEY],
        },

        // 缓存拦截器配置
        {
          provide: 'CACHE_INTERCEPTOR_OPTIONS',
          useFactory: (defaultConfig: CacheConfig) => ({
            enabled: interceptors,
            defaultTtl: defaultConfig.memory?.defaultTtl || 3600000,
            logCacheOperations: true,
          }),
          inject: [cacheConfig.KEY],
        },

        // 缓存键工厂
        {
          provide: 'ICacheKeyFactory',
          useClass: CacheKeyFactory,
        },

        // 缓存服务
        {
          provide: 'ICacheService',
          useClass: RedisCacheService,
        },

        // 缓存管理器
        {
          provide: 'ICacheManager',
          useClass: CacheManagerService,
        },

        // 缓存失效服务
        {
          provide: 'ICacheInvalidationService',
          useClass: CacheInvalidationService,
        },

        // 具体实现类
        CacheKeyFactory,
        RedisCacheService,
        MemoryCacheService,
        CacheManagerService,
        CacheInvalidationService,
        CacheWarmupService,

        // 拦截器
        ...(interceptors
          ? [CacheInterceptor, CacheGetInterceptor, CacheSetInterceptor]
          : []),
      ],
      exports: [
        // 导出接口
        'ICacheService',
        'ICacheManager',
        'ICacheKeyFactory',
        'ICacheInvalidationService',

        // 导出配置
        'CACHE_CONFIG',
        'REDIS_CONFIG',
        'MEMORY_CACHE_CONFIG',
        'CACHE_MANAGER_CONFIG',
        'CACHE_INVALIDATION_CONFIG',
        'CACHE_WARMUP_CONFIG',
        'CACHE_INTERCEPTOR_OPTIONS',

        // 导出具体实现
        RedisCacheService,
        MemoryCacheService,
        CacheManagerService,
        CacheKeyFactory,
        CacheInvalidationService,
        CacheWarmupService,

        // 导出拦截器
        ...(interceptors
          ? [CacheInterceptor, CacheGetInterceptor, CacheSetInterceptor]
          : []),
      ],
    };

    if (global) {
      moduleConfig.global = true;
    }

    return moduleConfig;
  }

  static forRoot(options: CacheModuleOptions = {}): DynamicModule {
    return this.register({
      global: true,
      redis: true,
      memory: true,
      manager: true,
      invalidation: true,
      warmup: true,
      interceptors: true,
      ...options,
    });
  }

  static forFeature(options: CacheModuleOptions = {}): DynamicModule {
    return this.register({
      global: false,
      redis: true,
      memory: true,
      manager: false,
      invalidation: false,
      warmup: false,
      interceptors: false,
      ...options,
    });
  }
}
