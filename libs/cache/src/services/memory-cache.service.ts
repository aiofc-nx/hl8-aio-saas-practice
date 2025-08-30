import { Injectable, OnModuleDestroy, Inject } from '@nestjs/common';
import {
  ICacheService,
  CacheKey,
  CacheValue,
  CacheOptions,
  CacheStats,
  CacheHealth,
  CacheStrategy,
} from '../interfaces/cache.interface';
import type { ICacheKeyFactory } from '../interfaces/cache.interface';
import { PinoLoggerService, LogContext } from '@aiofix/logging';

/**
 * @interface MemoryCacheConfig
 * @description 内存缓存配置接口
 */
export interface MemoryCacheConfig {
  /** 默认过期时间（毫秒） */
  defaultTtl?: number;
  /** 最大缓存项数量 */
  maxSize?: number;
  /** 默认缓存策略 */
  defaultStrategy?: CacheStrategy;
  /** 清理间隔（毫秒） */
  cleanupInterval?: number;
  /** 是否启用压缩 */
  enableCompression?: boolean;
  /** 是否启用加密 */
  enableEncryption?: boolean;
}

/**
 * @interface MemoryCacheEntry<T>
 * @description 内存缓存条目接口
 */
interface MemoryCacheEntry<T = any> {
  /** 缓存值 */
  value: CacheValue<T>;
  /** 大小（字节） */
  size: number;
  /** 创建时间 */
  createdAt: number;
  /** 最后访问时间 */
  lastAccessed: number;
  /** 访问次数 */
  accessCount: number;
  /** 访问频率（用于LFU策略） */
  accessFrequency: number;
}

/**
 * @class MemoryCacheService
 * @description 内存缓存服务实现
 *
 * 该服务提供高性能的内存缓存功能，支持多种缓存策略：
 * - LRU (Least Recently Used): 最近最少使用策略
 * - LFU (Least Frequently Used): 最少使用频率策略
 * - FIFO (First In First Out): 先进先出策略
 * - TTL (Time To Live): 基于时间过期策略
 *
 * 主要特性：
 * 1. 支持多种缓存策略，可根据业务需求选择
 * 2. 自动过期清理和内存管理
 * 3. 完整的统计信息和健康检查
 * 4. 线程安全的并发访问
 * 5. 可配置的压缩和加密功能
 */
@Injectable()
export class MemoryCacheService implements ICacheService, OnModuleDestroy {
  private readonly logger: PinoLoggerService;

  /** 内存存储 */
  private readonly cache = new Map<string, MemoryCacheEntry>();

  /** 访问顺序队列（用于LRU策略） */
  private readonly accessOrder: string[] = [];

  /** 访问频率映射（用于LFU策略） */
  private readonly accessFrequency = new Map<string, number>();

  /** 配置选项 */
  private readonly config: Required<MemoryCacheConfig>;

  /** 统计信息 */
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

  /** 清理定时器 */
  private cleanupTimer?: NodeJS.Timeout;

  /** 是否已销毁 */
  private isDestroyed = false;

  constructor(
    @Inject('MEMORY_CACHE_CONFIG')
    @Inject('ICacheKeyFactory')
    private readonly keyFactory: ICacheKeyFactory,
    logger: PinoLoggerService
  ) {
    this.logger = logger;
    // 设置默认配置
    this.config = {
      defaultTtl: 300000, // 5分钟
      maxSize: 1000,
      defaultStrategy: CacheStrategy.LRU,
      cleanupInterval: 60000, // 1分钟
      enableCompression: false,
      enableEncryption: false,
    };

    // 启动清理定时器
    this.startCleanupTimer();

    this.logger.info(
      `MemoryCacheService initialized with config: ${JSON.stringify(
        this.config
      )}`,
      LogContext.CACHE
    );
  }

  /**
   * @method onModuleDestroy
   * @description 模块销毁时的清理工作
   */
  async onModuleDestroy(): Promise<void> {
    this.isDestroyed = true;

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    this.cache.clear();
    this.accessOrder.length = 0;
    this.accessFrequency.clear();

    this.logger.info('MemoryCacheService destroyed', LogContext.CACHE);
  }

  /**
   * @method get
   * @description 获取缓存值
   * @param {CacheKey} key 缓存键
   * @returns {Promise<T | null>} 缓存值或null
   */
  async get<T = any>(key: CacheKey): Promise<T | null> {
    try {
      const keyString = this.keyFactory.toString(key);
      const entry = this.cache.get(keyString);

      if (!entry) {
        this.updateStats(false);
        return null;
      }

      // 检查是否过期
      if (this.isExpired(entry.value)) {
        this.cache.delete(keyString);
        this.removeFromAccessOrder(keyString);
        this.accessFrequency.delete(keyString);
        this.stats.expiredEntries++;
        this.updateStats(false);
        return null;
      }

      // 更新访问信息
      this.updateAccessInfo(keyString, entry);

      // 更新统计
      this.updateStats(true);

      return entry.value.value as T;
    } catch (error) {
      this.logger.error(
        `Error getting cache value: ${(error as Error).message}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      this.updateStats(false);
      return null;
    }
  }

  /**
   * @method set
   * @description 设置缓存值
   * @param {CacheKey} key 缓存键
   * @param {T} value 缓存值
   * @param {Partial<CacheOptions>} options 缓存选项
   * @returns {Promise<boolean>} 是否成功
   */
  async set<T = any>(
    key: CacheKey,
    value: T,
    options?: Partial<CacheOptions>
  ): Promise<boolean> {
    try {
      const keyString = this.keyFactory.toString(key);
      const strategy = options?.strategy ?? this.config.defaultStrategy;
      const ttl = options?.ttl ?? this.config.defaultTtl;

      // 计算值大小
      const valueSize = this.calculateSize(value);

      // 创建缓存值
      const cacheValue: CacheValue<T> = {
        value,
        createdAt: Date.now(),
        expiresAt: ttl > 0 ? Date.now() + ttl : undefined,
        accessCount: 0,
        lastAccessed: Date.now(),
        version: key.version,
        tags: key.tags,
        metadata: {
          strategy,
          compressed: this.config.enableCompression,
          encrypted: this.config.enableEncryption,
        },
      };

      // 检查是否需要驱逐旧条目
      if (this.cache.size >= this.config.maxSize) {
        this.evictEntry(strategy);
      }

      // 存储新条目
      const entry: MemoryCacheEntry<T> = {
        value: cacheValue,
        size: valueSize,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        accessFrequency: 0,
      };

      this.cache.set(keyString, entry);
      this.addToAccessOrder(keyString);
      this.accessFrequency.set(keyString, 0);

      // 更新统计
      this.stats.totalEntries = this.cache.size;
      this.stats.totalSize += valueSize;
      this.stats.averageSize = this.stats.totalSize / this.stats.totalEntries;

      return true;
    } catch (error) {
      this.logger.error(
        `Error setting cache value: ${(error as Error).message}`,
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
   * @param {CacheKey} key 缓存键
   * @returns {Promise<boolean>} 是否成功
   */
  async delete(key: CacheKey): Promise<boolean> {
    try {
      const keyString = this.keyFactory.toString(key);
      const entry = this.cache.get(keyString);

      if (!entry) {
        return false;
      }

      // 从缓存中删除
      this.cache.delete(keyString);
      this.removeFromAccessOrder(keyString);
      this.accessFrequency.delete(keyString);

      // 更新统计
      this.stats.totalEntries = this.cache.size;
      this.stats.totalSize -= entry.size;
      this.stats.averageSize =
        this.stats.totalEntries > 0
          ? this.stats.totalSize / this.stats.totalEntries
          : 0;

      return true;
    } catch (error) {
      this.logger.error(
        `Error deleting cache value: ${(error as Error).message}`,
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
   * @param {CacheKey} key 缓存键
   * @returns {Promise<boolean>} 是否存在
   */
  async exists(key: CacheKey): Promise<boolean> {
    try {
      const keyString = this.keyFactory.toString(key);
      const entry = this.cache.get(keyString);

      if (!entry) {
        return false;
      }

      // 检查是否过期
      if (this.isExpired(entry.value)) {
        this.cache.delete(keyString);
        this.removeFromAccessOrder(keyString);
        this.accessFrequency.delete(keyString);
        this.stats.expiredEntries++;
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Error checking cache key existence: ${(error as Error).message}`,
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
   * @param {string} namespace 命名空间（可选）
   * @returns {Promise<boolean>} 是否成功
   */
  async clear(namespace?: string): Promise<boolean> {
    try {
      if (namespace) {
        // 清空指定命名空间
        const keysToDelete: string[] = [];

        for (const [keyString] of this.cache.entries()) {
          const parsedKey = this.keyFactory.parse(keyString);
          if (parsedKey.namespace === namespace) {
            keysToDelete.push(keyString);
          }
        }

        for (const keyString of keysToDelete) {
          const entry = this.cache.get(keyString);
          if (entry) {
            this.cache.delete(keyString);
            this.removeFromAccessOrder(keyString);
            this.accessFrequency.delete(keyString);
            this.stats.totalSize -= entry.size;
          }
        }

        this.stats.totalEntries = this.cache.size;
        this.stats.averageSize =
          this.stats.totalEntries > 0
            ? this.stats.totalSize / this.stats.totalEntries
            : 0;
      } else {
        // 清空所有缓存
        this.cache.clear();
        this.accessOrder.length = 0;
        this.accessFrequency.clear();
        this.stats.totalEntries = 0;
        this.stats.totalSize = 0;
        this.stats.averageSize = 0;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Error clearing cache: ${(error as Error).message}`,
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
   * @returns {Promise<CacheStats>} 缓存统计
   */
  async getStats(): Promise<CacheStats> {
    return { ...this.stats };
  }

  /**
   * @method getHealth
   * @description 获取缓存健康状态
   * @returns {Promise<CacheHealth>} 缓存健康状态
   */
  async getHealth(): Promise<CacheHealth> {
    const startTime = Date.now();

    try {
      // 简单的健康检查：尝试设置和获取一个测试值
      const testKey = this.keyFactory.create('health-check');
      const testValue = { timestamp: Date.now() };

      await this.set(testKey, testValue, { ttl: 1000 });
      const retrieved = await this.get(testKey);

      const responseTime = Date.now() - startTime;

      return {
        healthy:
          retrieved !== null && retrieved.timestamp === testValue.timestamp,
        connected: true,
        responseTime,
        lastCheck: Date.now(),
      };
    } catch (error) {
      return {
        healthy: false,
        connected: false,
        responseTime: Date.now() - startTime,
        error: (error as Error).message,
        lastCheck: Date.now(),
      };
    }
  }

  /**
   * @method resetStats
   * @description 重置缓存统计
   * @returns {Promise<void>}
   */
  async resetStats(): Promise<void> {
    this.stats = {
      totalEntries: this.cache.size,
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalSize: this.stats.totalSize,
      averageSize: this.stats.averageSize,
      expiredEntries: 0,
      evictedEntries: 0,
      lastReset: Date.now(),
    };
  }

  /**
   * @private
   * @method startCleanupTimer
   * @description 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval);
  }

  /**
   * @private
   * @method cleanupExpiredEntries
   * @description 清理过期条目
   */
  private cleanupExpiredEntries(): void {
    if (this.isDestroyed) return;

    const keysToDelete: string[] = [];

    for (const [keyString, entry] of this.cache.entries()) {
      if (this.isExpired(entry.value)) {
        keysToDelete.push(keyString);
      }
    }

    for (const keyString of keysToDelete) {
      const entry = this.cache.get(keyString);
      if (entry) {
        this.cache.delete(keyString);
        this.removeFromAccessOrder(keyString);
        this.accessFrequency.delete(keyString);
        this.stats.totalSize -= entry.size;
        this.stats.expiredEntries++;
      }
    }

    this.stats.totalEntries = this.cache.size;
    this.stats.averageSize =
      this.stats.totalEntries > 0
        ? this.stats.totalSize / this.stats.totalEntries
        : 0;

    if (keysToDelete.length > 0) {
      this.logger.debug(
        `Cleaned up ${keysToDelete.length} expired entries`,
        LogContext.CACHE
      );
    }
  }

  /**
   * @private
   * @method isExpired
   * @description 检查缓存值是否过期
   * @param {CacheValue} value 缓存值
   * @returns {boolean} 是否过期
   */
  private isExpired(value: CacheValue): boolean {
    return value.expiresAt !== undefined && Date.now() > value.expiresAt;
  }

  /**
   * @private
   * @method calculateSize
   * @description 计算值大小
   * @param {any} value 值
   * @returns {number} 大小（字节）
   */
  private calculateSize(value: any): number {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8');
    } catch {
      return 0;
    }
  }

  /**
   * @private
   * @method updateAccessInfo
   * @description 更新访问信息
   * @param {string} keyString 键字符串
   * @param {MemoryCacheEntry} entry 缓存条目
   */
  private updateAccessInfo(keyString: string, entry: MemoryCacheEntry): void {
    const now = Date.now();

    // 更新访问次数和时间
    entry.value.accessCount++;
    entry.value.lastAccessed = now;
    entry.lastAccessed = now;
    entry.accessCount++;

    // 更新访问频率（用于LFU策略）
    const currentFreq = this.accessFrequency.get(keyString) ?? 0;
    const newFreq = currentFreq + 1;
    this.accessFrequency.set(keyString, newFreq);
    entry.accessFrequency = newFreq;

    // 更新访问顺序（用于LRU策略）
    this.removeFromAccessOrder(keyString);
    this.accessOrder.push(keyString);
  }

  /**
   * @private
   * @method addToAccessOrder
   * @description 添加到访问顺序
   * @param {string} keyString 键字符串
   */
  private addToAccessOrder(keyString: string): void {
    this.accessOrder.push(keyString);
  }

  /**
   * @private
   * @method removeFromAccessOrder
   * @description 从访问顺序中移除
   * @param {string} keyString 键字符串
   */
  private removeFromAccessOrder(keyString: string): void {
    const index = this.accessOrder.indexOf(keyString);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * @private
   * @method evictEntry
   * @description 驱逐缓存条目
   * @param {CacheStrategy} strategy 缓存策略
   */
  private evictEntry(strategy: CacheStrategy): void {
    let keyToEvict: string | undefined;

    switch (strategy) {
      case CacheStrategy.LRU:
        // 驱逐最近最少使用的条目
        keyToEvict = this.accessOrder.shift();
        break;

      case CacheStrategy.LFU: {
        // 驱逐最少使用频率的条目
        let minFreq = Infinity;
        for (const [key, freq] of this.accessFrequency.entries()) {
          if (freq < minFreq) {
            minFreq = freq;
            keyToEvict = key;
          }
        }
        break;
      }

      case CacheStrategy.FIFO: {
        // 驱逐最早创建的条目
        let oldestTime = Infinity;
        for (const [key, entry] of this.cache.entries()) {
          if (entry.createdAt < oldestTime) {
            oldestTime = entry.createdAt;
            keyToEvict = key;
          }
        }
        break;
      }

      case CacheStrategy.TTL: {
        // 驱逐最早过期的条目
        let earliestExpiry = Infinity;
        for (const [key, entry] of this.cache.entries()) {
          if (entry.value.expiresAt && entry.value.expiresAt < earliestExpiry) {
            earliestExpiry = entry.value.expiresAt;
            keyToEvict = key;
          }
        }
        break;
      }
    }

    if (keyToEvict) {
      const entry = this.cache.get(keyToEvict);
      if (entry) {
        this.cache.delete(keyToEvict);
        this.removeFromAccessOrder(keyToEvict);
        this.accessFrequency.delete(keyToEvict);
        this.stats.totalSize -= entry.size;
        this.stats.evictedEntries++;
        this.stats.totalEntries = this.cache.size;
        this.stats.averageSize =
          this.stats.totalEntries > 0
            ? this.stats.totalSize / this.stats.totalEntries
            : 0;
      }
    }
  }

  /**
   * @private
   * @method updateStats
   * @description 更新统计信息
   * @param {boolean} isHit 是否命中
   */
  private updateStats(isHit: boolean): void {
    if (isHit) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }

    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}
