import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import type { ICacheService } from '../interfaces/cache.interface';

import type {
  CacheOptions,
  CacheKey,
  CacheStats,
  CacheHealth,
} from '../interfaces/cache.interface';
import { CacheStrategy } from '../interfaces/cache.interface';
import { PinoLoggerService, LogContext } from '@aiofix/logging';

/**
 * @interface CacheManagerConfig
 * @description
 * 缓存管理器配置接口，定义缓存管理器的配置选项。
 */
export interface CacheManagerConfig {
  /** 默认缓存选项 */
  defaultOptions?: CacheOptions;
  /** 默认缓存策略 */
  defaultStrategy?: CacheStrategy;
  /** 是否启用缓存 */
  enabled?: boolean;
  /** 缓存层配置 */
  layers?: CacheLayerConfig[];
  /** 监控间隔（毫秒） */
  monitoringInterval?: number;
  /** 自动清理间隔（毫秒） */
  cleanupInterval?: number;
  /** 最大缓存大小 */
  maxSize?: number;
  /** 是否启用统计 */
  enableStats?: boolean;
  /** 是否启用事件 */
  enableEvents?: boolean;
}

/**
 * @interface CacheLayerConfig
 * @description
 * 缓存层配置接口，定义单个缓存层的配置。
 */
export interface CacheLayerConfig {
  /** 缓存层名称 */
  name: string;
  /** 缓存层优先级（数字越小优先级越高） */
  priority: number;
  /** 缓存服务实例 */
  service: ICacheService;
  /** 缓存层选项 */
  options?: CacheOptions;
  /** 是否启用 */
  enabled?: boolean;
  /** 是否只读 */
  readOnly?: boolean;
  /** 是否作为后备缓存 */
  fallback?: boolean;
}

/**
 * @interface CacheManagerStats
 * @description
 * 缓存管理器统计信息接口。
 */
export interface CacheManagerStats extends CacheStats {
  /** 活跃缓存层数量 */
  activeLayers: number;
  /** 各层统计信息 */
  layerStats: Record<string, any>;
  /** 最后更新时间 */
  lastUpdated: Date;
}

/**
 * @class CacheManagerService
 * @description
 * 缓存管理器服务，作为缓存系统的核心协调器。
 *
 * 主要功能包括：
 * 1. 管理多个缓存层（L1、L2、L3等）
 * 2. 实现缓存策略（LRU、LFU、FIFO等）
 * 3. 提供统一的缓存接口
 * 4. 监控缓存性能和健康状态
 * 5. 处理缓存失效和更新
 * 6. 提供缓存统计和分析
 *
 * @implements {ICacheService}
 */
@Injectable()
export class CacheManagerService implements ICacheService {
  private readonly logger: PinoLoggerService;

  /**
   * 缓存层映射，按优先级排序
   */
  private readonly layers = new Map<string, CacheLayerConfig>();

  /**
   * 缓存管理器配置
   */
  private config: CacheManagerConfig;

  /**
   * 统计信息
   */
  private stats: CacheManagerStats;

  /**
   * 监控定时器
   */
  private monitoringTimer?: NodeJS.Timeout;

  /**
   * 清理定时器
   */
  private cleanupTimer?: NodeJS.Timeout;

  /**
   * 请求计数器
   */
  private requestCount = 0;

  /**
   * 命中计数器
   */
  private hitCount = 0;

  /**
   * 响应时间累计
   */
  private totalResponseTime = 0;

  constructor(
    @Inject('CACHE_MANAGER_CONFIG') config: CacheManagerConfig,

    private readonly eventEmitter: EventEmitter2,
    logger: PinoLoggerService
  ) {
    this.logger = logger;
    this.config = {
      enabled: true,
      defaultStrategy: CacheStrategy.LRU,
      monitoringInterval: 30000,
      cleanupInterval: 60000,
      maxSize: 10000,
      enableStats: true,
      enableEvents: true,
      ...config,
    };

    this.stats = this.initializeStats();
    this.initializeLayers();
    this.startMonitoring();
    this.startCleanup();

    this.logger.info('CacheManagerService initialized', LogContext.CACHE);
  }

  /**
   * @method get
   * @description 从缓存中获取值
   * @param key 缓存键
   * @returns {Promise<T | null>} 缓存值
   */
  async get<T = any>(key: CacheKey): Promise<T | null> {
    const startTime = Date.now();
    this.requestCount++;

    try {
      // 按优先级遍历缓存层
      for (const layer of this.getSortedLayers()) {
        if (!layer.enabled) continue;

        const value = await layer.service.get<T>(key);

        if (value !== null) {
          // 缓存命中，更新统计
          this.hitCount++;
          this.updateStats(startTime);

          // 如果命中的是低优先级层，尝试提升到高优先级层
          if (layer.priority > 1) {
            this.promoteToHigherLayer(key, value, layer.priority);
          }

          this.emitEvent('cache_hit', { key, layer: layer.name, value });
          return value;
        }
      }

      // 缓存未命中
      this.updateStats(startTime);
      this.emitEvent('cache_miss', { key });
      return null;
    } catch (error) {
      this.logger.error(
        `Error getting cache value: ${key.key}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      this.emitEvent('cache_error', { key, error });
      return null;
    }
  }

  /**
   * @method set
   * @description 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   * @param options 缓存选项
   * @returns {Promise<boolean>} 是否成功
   */
  async set<T = any>(
    key: CacheKey,
    value: T,
    options?: Partial<CacheOptions>
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      const mergedOptions = { ...this.config.defaultOptions, ...options };
      let success = false;

      // 按优先级设置到所有启用的缓存层
      for (const layer of this.getSortedLayers()) {
        if (!layer.enabled || layer.readOnly) continue;

        try {
          const layerSuccess = await layer.service.set(key, value, {
            ...layer.options,
            ...mergedOptions,
          });
          if (layerSuccess) {
            success = true;
            this.emitEvent('cache_set', { key, layer: layer.name, value });
          }
        } catch (error) {
          this.logger.warn(
            `Failed to set cache in layer ${layer.name}: ${key.key}`,
            LogContext.CACHE,
            undefined,
            error as Error
          );
        }
      }

      this.updateStats(startTime);
      return success;
    } catch (error) {
      this.logger.error(
        `Error setting cache value: ${key.key}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      this.emitEvent('cache_error', { key, error });
      return false;
    }
  }

  /**
   * @method delete
   * @description 删除缓存值
   * @param key 缓存键
   * @returns {Promise<boolean>} 是否成功
   */
  async delete(key: CacheKey): Promise<boolean> {
    const startTime = Date.now();

    try {
      let success = false;

      // 从所有缓存层删除
      for (const layer of this.getSortedLayers()) {
        if (!layer.enabled || layer.readOnly) continue;

        try {
          const layerSuccess = await layer.service.delete(key);
          if (layerSuccess) {
            success = true;
            this.emitEvent('cache_delete', { key, layer: layer.name });
          }
        } catch (error) {
          this.logger.warn(
            `Failed to delete cache from layer ${layer.name}: ${key.key}`,
            LogContext.CACHE,
            undefined,
            error as Error
          );
        }
      }

      this.updateStats(startTime);
      return success;
    } catch (error) {
      this.logger.error(
        `Error deleting cache value: ${key.key}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      this.emitEvent('cache_error', { key, error });
      return false;
    }
  }

  /**
   * @method exists
   * @description 检查缓存键是否存在
   * @param key 缓存键
   * @returns {Promise<boolean>} 是否存在
   */
  async exists(key: CacheKey): Promise<boolean> {
    const startTime = Date.now();
    this.requestCount++;

    try {
      // 检查所有缓存层
      for (const layer of this.getSortedLayers()) {
        if (!layer.enabled) continue;

        const exists = await layer.service.exists(key);
        if (exists) {
          this.hitCount++;
          this.updateStats(startTime);
          this.emitEvent('cache_exists', { key, layer: layer.name });
          return true;
        }
      }

      this.updateStats(startTime);
      return false;
    } catch (error) {
      this.logger.error(
        `Error checking cache existence: ${key.key}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      this.emitEvent('cache_error', { key, error });
      return false;
    }
  }

  /**
   * @method clear
   * @description 清空缓存
   * @param namespace 命名空间
   * @returns {Promise<boolean>} 是否成功
   */
  async clear(namespace?: string): Promise<boolean> {
    const startTime = Date.now();

    try {
      let success = false;

      // 清空所有缓存层
      for (const layer of this.getSortedLayers()) {
        if (!layer.enabled || layer.readOnly) continue;

        try {
          const layerSuccess = await layer.service.clear(namespace);
          if (layerSuccess) {
            success = true;
            this.emitEvent('cache_clear', { layer: layer.name, namespace });
          }
        } catch (error) {
          this.logger.warn(
            `Failed to clear cache layer ${layer.name}`,
            LogContext.CACHE,
            undefined,
            error as Error
          );
        }
      }

      this.updateStats(startTime);
      return success;
    } catch (error) {
      this.logger.error(
        'Error clearing cache',
        LogContext.CACHE,
        undefined,
        error as Error
      );
      this.emitEvent('cache_error', { error });
      return false;
    }
  }

  /**
   * @method getStats
   * @description 获取缓存统计信息
   * @returns {Promise<CacheStats>} 统计信息
   */
  async getStats(): Promise<CacheStats> {
    try {
      // 更新各层统计信息
      const layerStats: Record<string, any> = {};
      for (const [name, layer] of this.layers) {
        if (layer.enabled) {
          try {
            layerStats[name] = await layer.service.getStats();
          } catch (error) {
            this.logger.warn(
              `Failed to get stats for layer ${name}`,
              LogContext.CACHE,
              undefined,
              error as Error
            );
            layerStats[name] = null;
          }
        }
      }

      // 计算总体统计
      this.stats.hitRate =
        this.requestCount > 0 ? this.hitCount / this.requestCount : 0;
      this.stats.activeLayers = Array.from(this.layers.values()).filter(
        (layer) => layer.enabled
      ).length;
      this.stats.layerStats = layerStats;
      this.stats.lastUpdated = new Date();

      return { ...this.stats };
    } catch (error) {
      this.logger.error(
        'Error getting cache stats',
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return this.stats;
    }
  }

  /**
   * @method getHealth
   * @description 获取缓存健康状态
   * @returns {Promise<CacheHealth>} 健康状态
   */
  async getHealth(): Promise<CacheHealth> {
    try {
      let healthyLayers = 0;
      let totalResponseTime = 0;
      let hasError = false;
      let errorMessage = '';

      // 检查各层健康状态
      for (const [, layer] of this.layers) {
        if (layer.enabled) {
          try {
            const layerHealth = await layer.service.getHealth();
            totalResponseTime += layerHealth.responseTime;
            if (layerHealth.healthy) {
              healthyLayers++;
            } else {
              hasError = true;
              errorMessage = layerHealth.error || 'Layer unhealthy';
            }
          } catch (error) {
            hasError = true;
            errorMessage = (error as Error).message;
          }
        }
      }

      const activeLayers = Array.from(this.layers.values()).filter(
        (layer) => layer.enabled
      ).length;
      const averageResponseTime =
        activeLayers > 0 ? totalResponseTime / activeLayers : 0;

      return {
        healthy: !hasError && healthyLayers === activeLayers,
        connected: healthyLayers > 0,
        responseTime: averageResponseTime,
        error: hasError ? errorMessage : undefined,
        lastCheck: Date.now(),
      };
    } catch (error) {
      this.logger.error(
        'Error getting cache health',
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return {
        healthy: false,
        connected: false,
        responseTime: 0,
        error: (error as Error).message,
        lastCheck: Date.now(),
      };
    }
  }

  /**
   * @method addLayer
   * @description 添加缓存层
   * @param config 缓存层配置
   * @returns {boolean} 是否成功
   */
  addLayer(config: CacheLayerConfig): boolean {
    try {
      if (this.layers.has(config.name)) {
        this.logger.warn(
          `Cache layer ${config.name} already exists, replacing...`,
          LogContext.CACHE
        );
      }

      this.layers.set(config.name, {
        enabled: true,
        readOnly: false,
        fallback: false,
        ...config,
      });

      this.logger.info(
        `Added cache layer: ${config.name} with priority ${config.priority}`,
        LogContext.CACHE
      );
      this.emitEvent('layer_added', {
        layer: config.name,
        priority: config.priority,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add cache layer: ${config.name}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return false;
    }
  }

  /**
   * @method removeLayer
   * @description 移除缓存层
   * @param name 缓存层名称
   * @returns {boolean} 是否成功
   */
  removeLayer(name: string): boolean {
    try {
      if (!this.layers.has(name)) {
        this.logger.warn(
          `Cache layer ${name} does not exist`,
          LogContext.CACHE
        );
        return false;
      }

      this.layers.delete(name);
      this.logger.info(`Removed cache layer: ${name}`, LogContext.CACHE);
      this.emitEvent('layer_removed', { layer: name });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to remove cache layer: ${name}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return false;
    }
  }

  /**
   * @method enableLayer
   * @description 启用缓存层
   * @param name 缓存层名称
   * @param enabled 是否启用
   * @returns {boolean} 是否成功
   */
  enableLayer(name: string, enabled: boolean): boolean {
    try {
      const layer = this.layers.get(name);
      if (!layer) {
        this.logger.warn(
          `Cache layer ${name} does not exist`,
          LogContext.CACHE
        );
        return false;
      }

      layer.enabled = enabled;
      this.logger.info(
        `${enabled ? 'Enabled' : 'Disabled'} cache layer: ${name}`,
        LogContext.CACHE
      );
      this.emitEvent('layer_toggled', { layer: name, enabled });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to toggle cache layer: ${name}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return false;
    }
  }

  /**
   * @method getLayers
   * @description 获取所有缓存层信息
   * @returns {CacheLayerConfig[]} 缓存层配置列表
   */
  getLayers(): CacheLayerConfig[] {
    return Array.from(this.layers.values()).map((layer) => ({ ...layer }));
  }

  /**
   * @method resetStats
   * @description 重置缓存统计信息
   */
  async resetStats(): Promise<void> {
    try {
      // 重置各层统计
      for (const [name, layer] of this.layers) {
        if (layer.enabled) {
          try {
            await layer.service.resetStats();
          } catch (error) {
            this.logger.warn(
              `Failed to reset stats for layer ${name}`,
              LogContext.CACHE,
              undefined,
              error as Error
            );
          }
        }
      }

      // 重置管理器统计
      this.requestCount = 0;
      this.hitCount = 0;
      this.totalResponseTime = 0;
      this.stats = this.initializeStats();

      this.logger.info('Cache stats reset successfully', LogContext.CACHE);
      this.emitEvent('stats_reset', {});
    } catch (error) {
      this.logger.error(
        'Failed to reset cache stats',
        LogContext.CACHE,
        undefined,
        error as Error
      );
    }
  }

  /**
   * @method onDestroy
   * @description 销毁时清理资源
   */
  onDestroy(): void {
    this.stopMonitoring();
    this.stopCleanup();
    this.logger.info('CacheManagerService destroyed', LogContext.CACHE);
  }

  // 私有方法

  /**
   * @private
   * @method initializeStats
   * @description 初始化统计信息
   * @returns {CacheManagerStats} 初始统计信息
   */
  private initializeStats(): CacheManagerStats {
    return {
      totalEntries: 0,
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalSize: 0,
      averageSize: 0,
      expiredEntries: 0,
      evictedEntries: 0,
      lastReset: Date.now(),
      activeLayers: 0,
      layerStats: {},
      lastUpdated: new Date(),
    };
  }

  /**
   * @private
   * @method initializeLayers
   * @description 初始化缓存层
   */
  private initializeLayers(): void {
    if (this.config.layers) {
      for (const layerConfig of this.config.layers) {
        this.addLayer(layerConfig);
      }
    }
  }

  /**
   * @private
   * @method getSortedLayers
   * @description 获取按优先级排序的缓存层
   * @returns {CacheLayerConfig[]} 排序后的缓存层
   */
  private getSortedLayers(): CacheLayerConfig[] {
    return Array.from(this.layers.values())
      .filter((layer) => layer.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * @private
   * @method promoteToHigherLayer
   * @description 将缓存值提升到更高优先级的层
   * @param key 缓存键
   * @param value 缓存值
   * @param currentPriority 当前优先级
   */
  private async promoteToHigherLayer<T>(
    key: CacheKey,
    value: T,
    currentPriority: number
  ): Promise<void> {
    try {
      const higherLayers = Array.from(this.layers.values())
        .filter(
          (layer) =>
            layer.enabled && !layer.readOnly && layer.priority < currentPriority
        )
        .sort((a, b) => a.priority - b.priority);

      for (const layer of higherLayers) {
        try {
          await layer.service.set(key, value);
          this.emitEvent('cache_promoted', {
            key,
            fromPriority: currentPriority,
            toPriority: layer.priority,
            layer: layer.name,
          });
        } catch (error) {
          this.logger.warn(
            `Failed to promote cache to layer ${layer.name}: ${key.key}`,
            LogContext.CACHE,
            undefined,
            error as Error
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error promoting cache: ${key.key}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
    }
  }

  /**
   * @private
   * @method updateStats
   * @description 更新统计信息
   * @param startTime 开始时间
   */
  private updateStats(startTime: number): void {
    const responseTime = Date.now() - startTime;
    this.totalResponseTime += responseTime;
    this.stats.hits = this.hitCount;
    this.stats.misses = this.requestCount - this.hitCount;
  }

  /**
   * @private
   * @method emitEvent
   * @description 发送缓存事件
   * @param type 事件类型
   * @param data 事件数据
   */
  private emitEvent(type: string, data: any): void {
    if (this.config.enableEvents) {
      try {
        this.eventEmitter.emit(`cache.${type}`, {
          type,
          data,
          timestamp: new Date(),
          managerId: 'cache-manager',
        });
      } catch (error) {
        this.logger.warn(
          `Failed to emit cache event: ${type}`,
          LogContext.CACHE,
          undefined,
          error as Error
        );
      }
    }
  }

  /**
   * @private
   * @method startMonitoring
   * @description 开始监控
   */
  private startMonitoring(): void {
    if (this.config.monitoringInterval && this.config.monitoringInterval > 0) {
      this.monitoringTimer = setInterval(async () => {
        try {
          await this.performMonitoring();
        } catch (error) {
          this.logger.error(
            'Cache monitoring failed',
            LogContext.CACHE,
            undefined,
            error as Error
          );
        }
      }, this.config.monitoringInterval);

      this.logger.info(
        `Started cache monitoring, interval: ${this.config.monitoringInterval}ms`,
        LogContext.CACHE
      );
    }
  }

  /**
   * @private
   * @method stopMonitoring
   * @description 停止监控
   */
  private stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
      this.logger.info('Stopped cache monitoring', LogContext.CACHE);
    }
  }

  /**
   * @private
   * @method startCleanup
   * @description 开始清理
   */
  private startCleanup(): void {
    if (this.config.cleanupInterval && this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(async () => {
        try {
          await this.performCleanup();
        } catch (error) {
          this.logger.error(
            'Cache cleanup failed',
            LogContext.CACHE,
            undefined,
            error as Error
          );
        }
      }, this.config.cleanupInterval);

      this.logger.info(
        `Started cache cleanup, interval: ${this.config.cleanupInterval}ms`,
        LogContext.CACHE
      );
    }
  }

  /**
   * @private
   * @method stopCleanup
   * @description 停止清理
   */
  private stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
      this.logger.info('Stopped cache cleanup', LogContext.CACHE);
    }
  }

  /**
   * @private
   * @method performMonitoring
   * @description 执行监控
   */
  private async performMonitoring(): Promise<void> {
    try {
      const health = await this.getHealth();
      const stats = await this.getStats();

      this.emitEvent('monitoring', { health, stats });

      // 检查健康状态
      if (!health.healthy) {
        this.logger.warn('Cache health check failed', LogContext.CACHE);
      }
    } catch (error) {
      this.logger.error(
        'Cache monitoring execution failed',
        LogContext.CACHE,
        undefined,
        error as Error
      );
    }
  }

  /**
   * @private
   * @method performCleanup
   * @description 执行清理
   */
  private async performCleanup(): Promise<void> {
    try {
      // 清理过期的缓存项
      for (const layer of this.getSortedLayers()) {
        if (layer.enabled && !layer.readOnly) {
          try {
            // 这里可以调用各层的清理方法，如果有的话
            this.emitEvent('cleanup', { layer: layer.name });
          } catch (error) {
            this.logger.warn(
              `Failed to cleanup layer ${layer.name}`,
              LogContext.CACHE,
              undefined,
              error as Error
            );
          }
        }
      }

      this.logger.debug('Cache cleanup completed', LogContext.CACHE);
    } catch (error) {
      this.logger.error(
        'Cache cleanup execution failed',
        LogContext.CACHE,
        undefined,
        error as Error
      );
    }
  }
}
