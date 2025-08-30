/**
 * @file redis-cache.service.ts
 * @description Redis缓存服务
 *
 * 该文件实现了基于Redis的缓存服务，包括：
 * - 基础的CRUD操作
 * - 缓存统计和健康检查
 * - 连接管理和错误处理
 * - 序列化和反序列化
 *
 * 遵循DDD和Clean Architecture原则，提供高性能的分布式缓存。
 */

import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import Redis, { Cluster } from 'ioredis';
import {
  ICacheService,
  CacheKey,
  CacheValue,
  CacheOptions,
  CacheStats,
  CacheHealth,
  CacheType,
  CacheStrategy,
} from '../interfaces/cache.interface';
import type { ICacheKeyFactory } from '../interfaces/cache.interface';
import { PinoLoggerService, LogContext } from '@aiofix/logging';

/**
 * @interface RedisConfig
 * @description Redis配置接口
 */
export interface RedisConfig {
  /** Redis主机地址 */
  host: string;
  /** Redis端口 */
  port: number;
  /** Redis密码 */
  password?: string;
  /** 数据库索引 */
  db?: number;
  /** 连接超时时间（毫秒） */
  connectTimeout?: number;
  /** 命令超时时间（毫秒） */
  commandTimeout?: number;
  /** 重试次数 */
  retries?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  /** 是否启用集群模式 */
  cluster?: boolean;
  /** 集群节点 */
  nodes?: Array<{ host: string; port: number }>;
  /** 是否启用哨兵模式 */
  sentinel?: boolean;
  /** 哨兵配置 */
  sentinels?: Array<{ host: string; port: number }>;
  /** 主节点名称 */
  name?: string;
}

/**
 * @class RedisCacheService
 * @description Redis缓存服务实现
 *
 * 提供基于Redis的分布式缓存功能，包括：
 * - 基础的CRUD操作
 * - 缓存统计和健康检查
 * - 连接管理和错误处理
 * - 序列化和反序列化
 */
@Injectable()
export class RedisCacheService
  implements ICacheService, OnModuleInit, OnModuleDestroy
{
  private readonly logger: PinoLoggerService;
  private redis: Redis | Cluster = {} as Redis | Cluster;
  private isConnected = false;
  private stats: CacheStats = {
    totalEntries: 0,
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalSize: 0,
    averageSize: 0,
    expiredEntries: 0,
    evictedEntries: 0,
    lastReset: Date.now(),
  };

  constructor(
    @Inject('REDIS_CONFIG') private readonly config: RedisConfig,
    @Inject('ICacheKeyFactory') private readonly keyFactory: ICacheKeyFactory,
    logger: PinoLoggerService
  ) {
    this.logger = logger;
  }

  /**
   * @method onModuleInit
   * @description 模块初始化时连接Redis
   */
  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  /**
   * @method onModuleDestroy
   * @description 模块销毁时断开Redis连接
   */
  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  /**
   * @method connect
   * @description 连接到Redis
   */
  private async connect(): Promise<void> {
    try {
      if (this.config.cluster && this.config.nodes) {
        this.redis = new Redis.Cluster(this.config.nodes, {
          redisOptions: {
            password: this.config.password,
            db: this.config.db || 0,
            connectTimeout: this.config.connectTimeout || 10000,
            commandTimeout: this.config.commandTimeout || 5000,
            maxRetriesPerRequest: this.config.retries || 3,
          },
        });
      } else if (this.config.sentinel && this.config.sentinels) {
        this.redis = new Redis({
          sentinels: this.config.sentinels,
          name: this.config.name || 'mymaster',
          password: this.config.password,
          db: this.config.db || 0,
          connectTimeout: this.config.connectTimeout || 10000,
          commandTimeout: this.config.commandTimeout || 5000,
          maxRetriesPerRequest: this.config.retries || 3,
        });
      } else {
        this.redis = new Redis({
          host: this.config.host,
          port: this.config.port,
          password: this.config.password,
          db: this.config.db || 0,
          connectTimeout: this.config.connectTimeout || 10000,
          commandTimeout: this.config.commandTimeout || 5000,
          maxRetriesPerRequest: this.config.retries || 3,
        });
      }

      // 监听连接事件
      this.redis.on('connect', () => {
        this.logger.info('Redis connected', LogContext.CACHE);
        this.isConnected = true;
      });

      this.redis.on('ready', () => {
        this.logger.info('Redis ready', LogContext.CACHE);
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        this.logger.error('Redis error', LogContext.CACHE, undefined, error as Error);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        this.logger.warn('Redis connection closed', LogContext.CACHE);
        this.isConnected = false;
      });

      this.redis.on('reconnecting', () => {
        this.logger.info('Redis reconnecting...', LogContext.CACHE);
      });

      // 等待连接建立
      await this.redis.ping();
      this.logger.info(
        'Redis connection established successfully',
        LogContext.CACHE
      );
    } catch (error) {
      this.logger.error(
        'Failed to connect to Redis',
        LogContext.CACHE,
        undefined,
        error as Error
      );
      throw error;
    }
  }

  /**
   * @method disconnect
   * @description 断开Redis连接
   */
  private async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      this.logger.info('Redis connection closed', LogContext.CACHE);
    }
  }

  /**
   * @method get
   * @description 获取缓存值
   * @param key 缓存键
   * @returns 缓存值或null
   */
  async get<T = any>(key: CacheKey): Promise<T | null> {
    try {
      const keyString = this.keyFactory.toString(key);
      const result = await this.redis.get(keyString);

      if (result === null) {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();

      const cacheValue: CacheValue<T> = JSON.parse(result);

      // 检查是否过期
      if (cacheValue.expiresAt && Date.now() > cacheValue.expiresAt) {
        await this.delete(key);
        this.stats.expiredEntries++;
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      // 更新访问统计
      cacheValue.accessCount++;
      cacheValue.lastAccessed = Date.now();
      await this.redis.set(keyString, JSON.stringify(cacheValue));

      return cacheValue.value;
    } catch (error) {
      this.logger.error(
        'Error getting cache value',
        LogContext.CACHE,
        undefined,
        error as Error
      );
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * @method set
   * @description 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   * @param options 缓存选项
   * @returns 是否成功
   */
  async set<T = any>(
    key: CacheKey,
    value: T,
    options?: Partial<CacheOptions>
  ): Promise<boolean> {
    try {
      const keyString = this.keyFactory.toString(key);
      const now = Date.now();

      const cacheValue: CacheValue<T> = {
        value,
        createdAt: now,
        accessCount: 0,
        lastAccessed: now,
        version: key.version,
        tags: key.tags,
        metadata: {
          type: CacheType.REDIS,
          strategy: options?.strategy || CacheStrategy.TTL,
        },
      };

      // 设置过期时间
      if (options?.ttl) {
        cacheValue.expiresAt = now + options.ttl;
      }

      const serializedValue = JSON.stringify(cacheValue);
      const valueSize = Buffer.byteLength(serializedValue, 'utf8');

      // 使用Redis的EXPIRE命令设置过期时间
      if (options?.ttl) {
        await this.redis.setex(
          keyString,
          Math.ceil(options.ttl / 1000),
          serializedValue
        );
      } else {
        await this.redis.set(keyString, serializedValue);
      }

      // 更新统计
      this.stats.totalEntries++;
      this.stats.totalSize += valueSize;
      this.stats.averageSize = this.stats.totalSize / this.stats.totalEntries;

      return true;
    } catch (error) {
      this.logger.error(
        'Error setting cache value',
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return false;
    }
  }

  /**
   * @method delete
   * @description 删除缓存值
   * @param key 缓存键
   * @returns 是否成功
   */
  async delete(key: CacheKey): Promise<boolean> {
    try {
      const keyString = this.keyFactory.toString(key);
      const result = await this.redis.del(keyString);

      if (result > 0) {
        this.stats.totalEntries--;
        // 注意：这里无法准确更新totalSize，因为我们需要获取被删除项的大小
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(
        'Error deleting cache value',
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return false;
    }
  }

  /**
   * @method exists
   * @description 检查缓存键是否存在
   * @param key 缓存键
   * @returns 是否存在
   */
  async exists(key: CacheKey): Promise<boolean> {
    try {
      const keyString = this.keyFactory.toString(key);
      const result = await this.redis.exists(keyString);
      return result === 1;
    } catch (error) {
      this.logger.error(
        'Error checking cache key existence',
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return false;
    }
  }

  /**
   * @method clear
   * @description 清空缓存
   * @param namespace 命名空间（可选）
   * @returns 是否成功
   */
  async clear(namespace?: string): Promise<boolean> {
    try {
      if (namespace) {
        // 使用模式匹配删除指定命名空间的所有键
        const pattern = `${namespace}:*`;
        const keys = await this.redis.keys(pattern);

        if (keys.length > 0) {
          await this.redis.del(...keys);
          this.stats.totalEntries -= keys.length;
        }
      } else {
        // 清空整个数据库
        await this.redis.flushdb();
        this.stats.totalEntries = 0;
        this.stats.totalSize = 0;
        this.stats.averageSize = 0;
      }

      return true;
    } catch (error) {
      this.logger.error(
        'Error clearing cache',
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return false;
    }
  }

  /**
   * @method getStats
   * @description 获取缓存统计
   * @returns 缓存统计
   */
  async getStats(): Promise<CacheStats> {
    try {
      // 获取Redis信息
      const info = await this.redis.info();
      const lines = info.split('\r\n');

      // 解析Redis统计信息
      for (const line of lines) {
        if (line.startsWith('keyspace:')) {
          const match = line.match(/keys=(\d+)/);
          if (match) {
            this.stats.totalEntries = parseInt(match[1], 10);
            break;
          }
        }
      }

      return { ...this.stats };
    } catch (error) {
      this.logger.error(
        'Error getting cache stats',
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return { ...this.stats };
    }
  }

  /**
   * @method getHealth
   * @description 获取缓存健康状态
   * @returns 缓存健康状态
   */
  async getHealth(): Promise<CacheHealth> {
    const startTime = Date.now();

    try {
      await this.redis.ping();
      const responseTime = Date.now() - startTime;

      return {
        healthy: true,
        connected: this.isConnected,
        responseTime,
        lastCheck: Date.now(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        healthy: false,
        connected: false,
        responseTime,
        error: (error as Error).message,
        lastCheck: Date.now(),
      };
    }
  }

  /**
   * @method resetStats
   * @description 重置缓存统计
   */
  async resetStats(): Promise<void> {
    this.stats = {
      totalEntries: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalSize: 0,
      averageSize: 0,
      expiredEntries: 0,
      evictedEntries: 0,
      lastReset: Date.now(),
    };
  }

  /**
   * @private updateHitRate
   * @description 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}
