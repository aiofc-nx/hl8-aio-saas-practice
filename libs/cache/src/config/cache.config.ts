/**
 * @file cache.config.ts
 * @description 缓存配置管理
 *
 * 该文件定义了缓存系统的所有配置选项，包括：
 * - Redis配置
 * - 内存缓存配置
 * - 缓存管理器配置
 * - 缓存失效配置
 * - 缓存键配置
 *
 * 遵循配置管理最佳实践，支持环境变量和默认值。
 */

import { registerAs } from '@nestjs/config';
import { CacheStrategy } from '../interfaces/cache.interface';

/**
 * @interface CacheConfig
 * @description 缓存配置接口
 */
export interface CacheConfig {
  /** Redis配置 */
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    connectTimeout: number;
    commandTimeout: number;
    retries: number;
    retryDelay: number;
    cluster: boolean;
    sentinel: boolean;
    sentinels?: Array<{ host: string; port: number }>;
    name?: string;
  };

  /** 内存缓存配置 */
  memory: {
    defaultTtl: number;
    maxSize: number;
    cleanupInterval: number;
    enableCompression: boolean;
    enableEncryption: boolean;
  };

  /** 缓存管理器配置 */
  manager: {
    enabled: boolean;
    defaultStrategy: CacheStrategy;
    monitoringInterval: number;
    cleanupInterval: number;
    maxSize: number;
    enableStats: boolean;
    enableEvents: boolean;
  };

  /** 缓存失效配置 */
  invalidation: {
    enabled: boolean;
    defaultStrategy: string;
    batchSize: number;
    concurrency: number;
    timeout: number;
    retries: number;
    retryDelay: number;
    enableStats: boolean;
    enableEvents: boolean;
    monitoringInterval: number;
  };

  /** 缓存键配置 */
  key: {
    defaultNamespace: string;
    separator: string;
    enableCompression: boolean;
    maxKeyLength: number;
    enableValidation: boolean;
  };

  /** 缓存TTL配置 */
  ttl: {
    userPermissions: number;
    userProfile: number;
    userSessions: number;
    orgTree: number;
    orgInfo: number;
    tenantInfo: number;
    tenantConfig: number;
    rolePermissions: number;
    roleTemplates: number;
    systemConfig: number;
    apiRateLimit: number;
  };

  /** 缓存前缀配置 */
  prefix: {
    user: string;
    org: string;
    tenant: string;
    role: string;
    system: string;
    session: string;
    lock: string;
  };
}

/**
 * @function createCacheConfig
 * @description 创建缓存配置
 * @returns {CacheConfig} 缓存配置对象
 */
export const createCacheConfig = (): CacheConfig => ({
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
    retries: parseInt(process.env.REDIS_RETRIES || '3'),
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000'),
    cluster: process.env.REDIS_CLUSTER === 'true',
    sentinel: process.env.REDIS_SENTINEL === 'true',
    sentinels: process.env.REDIS_SENTINELS
      ? JSON.parse(process.env.REDIS_SENTINELS)
      : undefined,
    name: process.env.REDIS_NAME || 'mymaster',
  },

  memory: {
    defaultTtl: parseInt(process.env.MEMORY_CACHE_TTL || '300000'), // 5分钟
    maxSize: parseInt(process.env.MEMORY_CACHE_MAX_SIZE || '1000'),
    cleanupInterval: parseInt(
      process.env.MEMORY_CACHE_CLEANUP_INTERVAL || '60000',
    ), // 1分钟
    enableCompression: process.env.MEMORY_CACHE_COMPRESSION === 'true',
    enableEncryption: process.env.MEMORY_CACHE_ENCRYPTION === 'true',
  },

  manager: {
    enabled: process.env.CACHE_MANAGER_ENABLED !== 'false',
    defaultStrategy:
      (process.env.CACHE_MANAGER_STRATEGY as CacheStrategy) ||
      CacheStrategy.LRU,
    monitoringInterval: parseInt(
      process.env.CACHE_MANAGER_MONITORING_INTERVAL || '30000',
    ),
    cleanupInterval: parseInt(
      process.env.CACHE_MANAGER_CLEANUP_INTERVAL || '60000',
    ),
    maxSize: parseInt(process.env.CACHE_MANAGER_MAX_SIZE || '10000'),
    enableStats: process.env.CACHE_MANAGER_STATS !== 'false',
    enableEvents: process.env.CACHE_MANAGER_EVENTS !== 'false',
  },

  invalidation: {
    enabled: process.env.CACHE_INVALIDATION_ENABLED !== 'false',
    defaultStrategy: process.env.CACHE_INVALIDATION_STRATEGY || 'exact',
    batchSize: parseInt(process.env.CACHE_INVALIDATION_BATCH_SIZE || '100'),
    concurrency: parseInt(process.env.CACHE_INVALIDATION_CONCURRENCY || '5'),
    timeout: parseInt(process.env.CACHE_INVALIDATION_TIMEOUT || '30000'),
    retries: parseInt(process.env.CACHE_INVALIDATION_RETRIES || '3'),
    retryDelay: parseInt(process.env.CACHE_INVALIDATION_RETRY_DELAY || '1000'),
    enableStats: process.env.CACHE_INVALIDATION_STATS !== 'false',
    enableEvents: process.env.CACHE_INVALIDATION_EVENTS !== 'false',
    monitoringInterval: parseInt(
      process.env.CACHE_INVALIDATION_MONITORING_INTERVAL || '60000',
    ),
  },

  key: {
    defaultNamespace: process.env.CACHE_KEY_NAMESPACE || 'cache',
    separator: process.env.CACHE_KEY_SEPARATOR || ':',
    enableCompression: process.env.CACHE_KEY_COMPRESSION === 'true',
    maxKeyLength: parseInt(process.env.CACHE_KEY_MAX_LENGTH || '250'),
    enableValidation: process.env.CACHE_KEY_VALIDATION !== 'false',
  },

  ttl: {
    userPermissions: parseInt(
      process.env.CACHE_TTL_USER_PERMISSIONS || '3600000',
    ), // 1小时
    userProfile: parseInt(process.env.CACHE_TTL_USER_PROFILE || '1800000'), // 30分钟
    userSessions: parseInt(process.env.CACHE_TTL_USER_SESSIONS || '7200000'), // 2小时
    orgTree: parseInt(process.env.CACHE_TTL_ORG_TREE || '1800000'), // 30分钟
    orgInfo: parseInt(process.env.CACHE_TTL_ORG_INFO || '3600000'), // 1小时
    tenantInfo: parseInt(process.env.CACHE_TTL_TENANT_INFO || '7200000'), // 2小时
    tenantConfig: parseInt(process.env.CACHE_TTL_TENANT_CONFIG || '3600000'), // 1小时
    rolePermissions: parseInt(
      process.env.CACHE_TTL_ROLE_PERMISSIONS || '3600000',
    ), // 1小时
    roleTemplates: parseInt(process.env.CACHE_TTL_ROLE_TEMPLATES || '86400000'), // 24小时
    systemConfig: parseInt(process.env.CACHE_TTL_SYSTEM_CONFIG || '86400000'), // 24小时
    apiRateLimit: parseInt(process.env.CACHE_TTL_API_RATE_LIMIT || '60000'), // 1分钟
  },

  prefix: {
    user: process.env.CACHE_PREFIX_USER || 'user',
    org: process.env.CACHE_PREFIX_ORG || 'org',
    tenant: process.env.CACHE_PREFIX_TENANT || 'tenant',
    role: process.env.CACHE_PREFIX_ROLE || 'role',
    system: process.env.CACHE_PREFIX_SYSTEM || 'system',
    session: process.env.CACHE_PREFIX_SESSION || 'session',
    lock: process.env.CACHE_PREFIX_LOCK || 'lock',
  },
});

/**
 * @constant CACHE_CONFIG_KEY
 * @description 缓存配置键名
 */
export const CACHE_CONFIG_KEY = 'cache';

/**
 * @function cacheConfig
 * @description 缓存配置注册函数
 */
export const cacheConfig = registerAs(CACHE_CONFIG_KEY, createCacheConfig);
