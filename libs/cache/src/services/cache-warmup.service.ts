/**
 * @file cache-warmup.service.ts
 * @description 缓存预热服务
 *
 * 该文件实现了缓存预热功能，包括：
 * - 应用启动时预热常用缓存
 * - 定时预热缓存
 * - 条件预热缓存
 * - 预热进度监控
 *
 * 提高应用启动后的缓存命中率。
 */

import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { ICacheService } from '../interfaces/cache.interface';

import type { CacheKey } from '../interfaces/cache.interface';
import { PinoLoggerService, LogContext } from '@aiofix/logging';

/**
 * @interface WarmupItem
 * @description 预热项接口
 */
export interface WarmupItem {
  /** 预热项ID */
  id: string;
  /** 缓存键 */
  key: CacheKey;
  /** 数据获取函数 */
  dataProvider: () => Promise<any>;
  /** 优先级（数字越小优先级越高） */
  priority: number;
  /** 是否启用 */
  enabled: boolean;
  /** 预热条件 */
  condition?: () => boolean | Promise<boolean>;
  /** 重试次数 */
  retries?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * @interface WarmupResult
 * @description 预热结果接口
 */
export interface WarmupResult {
  /** 预热项ID */
  itemId: string;
  /** 是否成功 */
  success: boolean;
  /** 执行时间（毫秒） */
  executionTime: number;
  /** 错误信息 */
  error?: string;
  /** 预热时间 */
  warmedAt: Date;
}

/**
 * @interface WarmupStats
 * @description 预热统计接口
 */
export interface WarmupStats {
  /** 总预热项数 */
  totalItems: number;
  /** 成功预热项数 */
  successfulItems: number;
  /** 失败预热项数 */
  failedItems: number;
  /** 平均执行时间 */
  averageExecutionTime: number;
  /** 最后预热时间 */
  lastWarmup: Date;
  /** 预热历史 */
  history: WarmupResult[];
}

/**
 * @interface CacheWarmupConfig
 * @description 缓存预热配置接口
 */
export interface CacheWarmupConfig {
  /** 是否启用预热 */
  enabled?: boolean;
  /** 启动时预热 */
  startupWarmup?: boolean;
  /** 定时预热 */
  scheduledWarmup?: boolean;
  /** 预热间隔（毫秒） */
  warmupInterval?: number;
  /** 并发预热数 */
  concurrency?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retries?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  /** 是否记录预热日志 */
  logWarmup?: boolean;
}

/**
 * @class CacheWarmupService
 * @description 缓存预热服务
 *
 * 提供缓存预热功能，包括：
 * 1. 应用启动时预热常用缓存
 * 2. 定时预热缓存
 * 3. 条件预热缓存
 * 4. 预热进度监控
 * 5. 预热统计和分析
 */
@Injectable()
export class CacheWarmupService implements OnModuleInit {
  private readonly logger: PinoLoggerService;

  /** 预热项列表 */
  private readonly warmupItems = new Map<string, WarmupItem>();

  /** 预热统计 */
  private stats: WarmupStats = {
    totalItems: 0,
    successfulItems: 0,
    failedItems: 0,
    averageExecutionTime: 0,
    lastWarmup: new Date(),
    history: [],
  };

  /** 是否正在预热 */
  private isWarmingUp = false;

  /** 预热配置 */
  private readonly config: Required<CacheWarmupConfig>;

  constructor(
    @Inject('ICacheService') private readonly cacheService: ICacheService,

    @Inject('CACHE_WARMUP_CONFIG') config: CacheWarmupConfig,
    private readonly eventEmitter: EventEmitter2,
    logger: PinoLoggerService
  ) {
    this.logger = logger;
    this.config = {
      enabled: true,
      startupWarmup: true,
      scheduledWarmup: false,
      warmupInterval: 300000, // 5分钟
      concurrency: 5,
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      logWarmup: true,
      ...config,
    };
  }

  /**
   * @method onModuleInit
   * @description 模块初始化时执行启动预热
   */
  async onModuleInit(): Promise<void> {
    if (this.config.enabled && this.config.startupWarmup) {
      this.logger.info('Starting cache warmup...', LogContext.CACHE);
      await this.warmup();
    }
  }

  /**
   * @method addWarmupItem
   * @description 添加预热项
   * @param item 预热项
   * @returns 是否成功
   */
  addWarmupItem(item: WarmupItem): boolean {
    try {
      if (this.warmupItems.has(item.id)) {
        this.logger.warn(
          `Warmup item already exists: ${item.id}`,
          LogContext.CACHE
        );
        return false;
      }

      this.warmupItems.set(item.id, {
        retries: this.config.retries,
        retryDelay: this.config.retryDelay,
        timeout: this.config.timeout,
        ...item,
      });

      this.stats.totalItems = this.warmupItems.size;
      this.logger.debug(`Added warmup item: ${item.id}`, LogContext.CACHE);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add warmup item: ${item.id}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return false;
    }
  }

  /**
   * @method removeWarmupItem
   * @description 移除预热项
   * @param itemId 预热项ID
   * @returns 是否成功
   */
  removeWarmupItem(itemId: string): boolean {
    try {
      if (!this.warmupItems.has(itemId)) {
        this.logger.warn(`Warmup item not found: ${itemId}`, LogContext.CACHE);
        return false;
      }

      this.warmupItems.delete(itemId);
      this.stats.totalItems = this.warmupItems.size;
      this.logger.debug(`Removed warmup item: ${itemId}`, LogContext.CACHE);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to remove warmup item: ${itemId}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return false;
    }
  }

  /**
   * @method getWarmupItem
   * @description 获取预热项
   * @param itemId 预热项ID
   * @returns 预热项
   */
  getWarmupItem(itemId: string): WarmupItem | undefined {
    return this.warmupItems.get(itemId);
  }

  /**
   * @method getAllWarmupItems
   * @description 获取所有预热项
   * @returns 预热项列表
   */
  getAllWarmupItems(): WarmupItem[] {
    return Array.from(this.warmupItems.values()).sort(
      (a, b) => a.priority - b.priority
    );
  }

  /**
   * @method warmup
   * @description 执行预热
   * @param itemIds 指定预热项ID列表（可选）
   * @returns 预热结果列表
   */
  async warmup(itemIds?: string[]): Promise<WarmupResult[]> {
    if (this.isWarmingUp) {
      this.logger.warn('Warmup already in progress', LogContext.CACHE);
      return [];
    }

    this.isWarmingUp = true;
    const startTime = Date.now();

    try {
      const items = itemIds
        ? (itemIds
            .map((id) => this.warmupItems.get(id))
            .filter(Boolean) as WarmupItem[])
        : this.getAllWarmupItems().filter((item) => item.enabled);

      if (items.length === 0) {
        this.logger.info('No warmup items to process', LogContext.CACHE);
        return [];
      }

      this.logger.info(
        `Starting warmup for ${items.length} items`,
        LogContext.CACHE
      );

      // 并发执行预热
      const results = await this.executeWarmupConcurrently(items);

      // 更新统计
      this.updateStats(results);

      const totalTime = Date.now() - startTime;
      this.logger.info(
        `Warmup completed in ${totalTime}ms. Success: ${
          results.filter((r) => r.success).length
        }/${results.length}`,
        LogContext.CACHE
      );

      // 发送预热完成事件
      this.eventEmitter.emit('cache.warmup.completed', {
        results,
        totalTime,
        stats: this.stats,
      });

      return results;
    } catch (error) {
      this.logger.error(
        'Warmup failed',
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return [];
    } finally {
      this.isWarmingUp = false;
    }
  }

  /**
   * @method warmupItem
   * @description 预热单个项
   * @param itemId 预热项ID
   * @returns 预热结果
   */
  async warmupItem(itemId: string): Promise<WarmupResult | null> {
    const item = this.warmupItems.get(itemId);
    if (!item) {
      this.logger.warn(`Warmup item not found: ${itemId}`, LogContext.CACHE);
      return null;
    }

    return this.executeWarmupItem(item);
  }

  /**
   * @method getStats
   * @description 获取预热统计
   * @returns 预热统计
   */
  getStats(): WarmupStats {
    return { ...this.stats };
  }

  /**
   * @method resetStats
   * @description 重置预热统计
   */
  resetStats(): void {
    this.stats = {
      totalItems: this.warmupItems.size,
      successfulItems: 0,
      failedItems: 0,
      averageExecutionTime: 0,
      lastWarmup: new Date(),
      history: [],
    };
    this.logger.info('Warmup stats reset', LogContext.CACHE);
  }

  /**
   * @method isWarmingUp
   * @description 检查是否正在预热
   * @returns 是否正在预热
   */
  isWarmingUpNow(): boolean {
    return this.isWarmingUp;
  }

  /**
   * @Cron
   * @description 定时预热任务
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledWarmup(): Promise<void> {
    if (
      this.config.enabled &&
      this.config.scheduledWarmup &&
      !this.isWarmingUp
    ) {
      this.logger.debug('Executing scheduled warmup', LogContext.CACHE);
      await this.warmup();
    }
  }

  // 私有方法

  /**
   * @private
   * @method executeWarmupConcurrently
   * @description 并发执行预热
   * @param items 预热项列表
   * @returns 预热结果列表
   */
  private async executeWarmupConcurrently(
    items: WarmupItem[]
  ): Promise<WarmupResult[]> {
    const results: WarmupResult[] = [];
    const concurrency = this.config.concurrency;

    // 分批执行
    for (let i = 0; i < items.length; i += concurrency) {
      const batch = items.slice(i, i + concurrency);
      const batchPromises = batch.map((item) => this.executeWarmupItem(item));

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(Boolean));
    }

    return results;
  }

  /**
   * @private
   * @method executeWarmupItem
   * @description 执行单个预热项
   * @param item 预热项
   * @returns 预热结果
   */
  private async executeWarmupItem(item: WarmupItem): Promise<WarmupResult> {
    const startTime = Date.now();
    const result: WarmupResult = {
      itemId: item.id,
      success: false,
      executionTime: 0,
      warmedAt: new Date(),
    };

    try {
      // 检查条件
      if (item.condition) {
        const conditionResult = await item.condition();
        if (!conditionResult) {
          result.executionTime = Date.now() - startTime;
          if (this.config.logWarmup) {
            this.logger.debug(
              `Warmup item condition not met: ${item.id}`,
              LogContext.CACHE
            );
          }
          return result;
        }
      }

      // 获取数据
      const data = await this.withTimeout(
        item.dataProvider(),
        item.timeout || this.config.timeout
      );

      if (data !== null && data !== undefined) {
        // 设置缓存
        await this.cacheService.set(item.key, data);
        result.success = true;

        if (this.config.logWarmup) {
          this.logger.debug(
            `Warmup item completed: ${item.id}`,
            LogContext.CACHE
          );
        }
      } else {
        result.error = 'Data provider returned null or undefined';
        if (this.config.logWarmup) {
          this.logger.warn(
            `Warmup item failed - no data: ${item.id}`,
            LogContext.CACHE
          );
        }
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Warmup item failed: ${item.id}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
    }

    result.executionTime = Date.now() - startTime;
    return result;
  }

  /**
   * @private
   * @method withTimeout
   * @description 带超时的Promise
   * @param promise Promise
   * @param timeout 超时时间
   * @returns Promise
   */
  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout)
      ),
    ]);
  }

  /**
   * @private
   * @method updateStats
   * @description 更新统计信息
   * @param results 预热结果列表
   */
  private updateStats(results: WarmupResult[]): void {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    this.stats.successfulItems += successful.length;
    this.stats.failedItems += failed.length;
    this.stats.lastWarmup = new Date();

    // 更新平均执行时间
    const totalExecutionTime = results.reduce(
      (sum, r) => sum + r.executionTime,
      0
    );
    const totalResults = this.stats.successfulItems + this.stats.failedItems;
    this.stats.averageExecutionTime =
      totalResults > 0 ? totalExecutionTime / totalResults : 0;

    // 添加到历史记录（保留最近100条）
    this.stats.history.push(...results);
    if (this.stats.history.length > 100) {
      this.stats.history = this.stats.history.slice(-100);
    }
  }
}
