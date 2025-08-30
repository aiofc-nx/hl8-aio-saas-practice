import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';

import type { ICacheService } from '../interfaces/cache.interface';
import type { ICacheKeyFactory } from '../interfaces/cache.interface';
import type { InvalidationResult } from '../interfaces/cache.interface';
import { PinoLoggerService, LogContext } from '@aiofix/logging';

/**
 * @enum InvalidationStrategy
 * @description
 * 缓存失效策略枚举，定义不同的失效策略。
 */
export enum InvalidationStrategy {
  /** 精确匹配 */
  EXACT = 'exact',
  /** 前缀匹配 */
  PREFIX = 'prefix',
  /** 后缀匹配 */
  SUFFIX = 'suffix',
  /** 通配符匹配 */
  WILDCARD = 'wildcard',
  /** 正则表达式匹配 */
  REGEX = 'regex',
  /** 标签匹配 */
  TAG = 'tag',
  /** 命名空间匹配 */
  NAMESPACE = 'namespace',
  /** 批量失效 */
  BATCH = 'batch',
}

/**
 * @enum InvalidationTrigger
 * @description
 * 缓存失效触发器枚举，定义失效的触发方式。
 */
export enum InvalidationTrigger {
  /** 手动触发 */
  MANUAL = 'manual',
  /** 定时触发 */
  SCHEDULED = 'scheduled',
  /** 事件触发 */
  EVENT = 'event',
  /** 条件触发 */
  CONDITIONAL = 'conditional',
  /** 依赖触发 */
  DEPENDENCY = 'dependency',
}

/**
 * @interface InvalidationRule
 * @description
 * 缓存失效规则接口，定义失效规则的信息。
 */
export interface InvalidationRule {
  /** 规则ID */
  readonly id: string;
  /** 规则名称 */
  readonly name: string;
  /** 规则描述 */
  readonly description?: string;
  /** 失效策略 */
  readonly strategy: InvalidationStrategy;
  /** 匹配模式 */
  readonly pattern: string;
  /** 触发器 */
  readonly trigger: InvalidationTrigger;
  /** 是否启用 */
  readonly enabled: boolean;
  /** 优先级 */
  readonly priority: number;
  /** 条件表达式 */
  readonly condition?: string;
  /** 依赖规则 */
  readonly dependencies?: string[];
  /** 定时表达式 */
  readonly schedule?: string;
  /** 事件类型 */
  readonly eventType?: string;
  /** 标签 */
  readonly tags?: string[];
  /** 元数据 */
  readonly metadata?: Record<string, unknown>;
  /** 创建时间 */
  readonly createdAt: Date;
  /** 更新时间 */
  readonly updatedAt: Date;
}

/**
 * @interface InvalidationStats
 * @description
 * 缓存失效统计信息接口。
 */
export interface InvalidationStats {
  /** 总失效次数 */
  totalInvalidations: number;
  /** 成功失效次数 */
  successfulInvalidations: number;
  /** 失败失效次数 */
  failedInvalidations: number;
  /** 平均执行时间 */
  averageExecutionTime: number;
  /** 总失效键数 */
  totalInvalidatedKeys: number;
  /** 活跃规则数 */
  activeRules: number;
  /** 最后失效时间 */
  lastInvalidation: Date;
  /** 各策略使用统计 */
  strategyUsage: Record<InvalidationStrategy, number>;
  /** 各触发器使用统计 */
  triggerUsage: Record<InvalidationTrigger, number>;
}

/**
 * @interface CacheInvalidationConfig
 * @description
 * 缓存失效服务配置接口。
 */
export interface CacheInvalidationConfig {
  /** 是否启用自动失效 */
  enabled?: boolean;
  /** 默认失效策略 */
  defaultStrategy?: InvalidationStrategy;
  /** 批量失效大小 */
  batchSize?: number;
  /** 并发失效数 */
  concurrency?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 重试次数 */
  retries?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  /** 是否启用统计 */
  enableStats?: boolean;
  /** 是否启用事件 */
  enableEvents?: boolean;
  /** 监控间隔（毫秒） */
  monitoringInterval?: number;
}

/**
 * @class CacheInvalidationService
 * @description
 * 缓存失效服务，提供灵活的缓存失效管理功能。
 *
 * 主要功能包括：
 * 1. 支持多种失效策略（精确匹配、通配符、正则表达式等）
 * 2. 支持多种触发方式（手动、定时、事件、条件等）
 * 3. 提供规则管理和优先级控制
 * 4. 支持批量失效和并发处理
 * 5. 提供详细的统计和监控
 * 6. 支持依赖关系和条件表达式
 *
 * @implements {ICacheService}
 */
@Injectable()
export class CacheInvalidationService {
  private readonly logger: PinoLoggerService;

  /**
   * 失效规则映射
   */
  private readonly rules = new Map<string, InvalidationRule>();

  /**
   * 缓存服务实例
   */
  private cacheService: ICacheService | null = null;

  /**
   * 服务配置
   */
  private config: CacheInvalidationConfig;

  /**
   * 统计信息
   */
  private stats: InvalidationStats;

  /**
   * 监控定时器
   */
  private monitoringTimer?: NodeJS.Timeout;



  constructor(
    @Inject('CACHE_INVALIDATION_CONFIG') config: CacheInvalidationConfig,
    @Inject('ICacheKeyFactory') private readonly keyFactory: ICacheKeyFactory,
    private readonly eventEmitter: EventEmitter2,
    logger: PinoLoggerService
  ) {
    this.logger = logger;
    this.config = {
      enabled: true,
      defaultStrategy: InvalidationStrategy.EXACT,
      batchSize: 100,
      concurrency: 5,
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      enableStats: true,
      enableEvents: true,
      monitoringInterval: 60000,
      ...config,
    };

    this.stats = this.initializeStats();
    this.startMonitoring();

    this.logger.info('CacheInvalidationService initialized', LogContext.CACHE);
  }

  /**
   * @method setCacheService
   * @description 设置缓存服务实例
   * @param cacheService 缓存服务实例
   */
  setCacheService(cacheService: ICacheService): void {
    this.cacheService = cacheService;
    this.logger.info(
      'Cache service set for invalidation service',
      LogContext.CACHE
    );
  }

  /**
   * @method addRule
   * @description 添加失效规则
   * @param rule 失效规则
   * @returns {boolean} 是否成功
   */
  addRule(
    rule: Omit<InvalidationRule, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
    }
  ): boolean {
    try {
      const ruleId = rule.id || uuidv4();
      const now = new Date();

      const { id: _, ...rest } = rule;
      const fullRule: InvalidationRule = {
        ...rest,
        id: ruleId,
        createdAt: now,
        updatedAt: now,
      };

      this.rules.set(ruleId, fullRule);

      this.logger.info(
        `Added invalidation rule: ${rule.name}`,
        LogContext.CACHE
      );
      this.emitEvent('rule_added', { rule: fullRule });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to add invalidation rule: ${rule.name}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return false;
    }
  }

  /**
   * @method removeRule
   * @description 移除失效规则
   * @param ruleId 规则ID
   * @returns {boolean} 是否成功
   */
  removeRule(ruleId: string): boolean {
    try {
      if (!this.rules.has(ruleId)) {
        this.logger.warn(
          `Invalidation rule not found: ${ruleId}`,
          LogContext.CACHE
        );
        return false;
      }

      const rule = this.rules.get(ruleId);
      if (!rule) {
        throw new Error(`Invalidation rule not found: ${ruleId}`);
      }
      this.rules.delete(ruleId);

      this.logger.info(
        `Removed invalidation rule: ${rule.name}`,
        LogContext.CACHE
      );
      this.emitEvent('rule_removed', { rule });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to remove invalidation rule: ${ruleId}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return false;
    }
  }

  /**
   * @method updateRule
   * @description 更新失效规则
   * @param ruleId 规则ID
   * @param updates 更新内容
   * @returns {boolean} 是否成功
   */
  updateRule(
    ruleId: string,
    updates: Partial<Omit<InvalidationRule, 'id' | 'createdAt'>>
  ): boolean {
    try {
      if (!this.rules.has(ruleId)) {
        this.logger.warn(
          `Invalidation rule not found: ${ruleId}`,
          LogContext.CACHE
        );
        return false;
      }

      const existingRule = this.rules.get(ruleId)!;
      const updatedRule: InvalidationRule = {
        ...existingRule,
        ...updates,
        updatedAt: new Date(),
      };

      this.rules.set(ruleId, updatedRule);

      this.logger.info(
        `Updated invalidation rule: ${updatedRule.name}`,
        LogContext.CACHE
      );
      this.emitEvent('rule_updated', { rule: updatedRule });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to update invalidation rule: ${ruleId}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return false;
    }
  }

  /**
   * @method getRule
   * @description 获取失效规则
   * @param ruleId 规则ID
   * @returns {InvalidationRule | null} 失效规则
   */
  getRule(ruleId: string): InvalidationRule | null {
    return this.rules.get(ruleId) || null;
  }

  /**
   * @method getAllRules
   * @description 获取所有失效规则
   * @param enabledOnly 是否只返回启用的规则
   * @returns {InvalidationRule[]} 失效规则列表
   */
  getAllRules(enabledOnly?: boolean): InvalidationRule[] {
    const rules = Array.from(this.rules.values());

    if (enabledOnly) {
      return rules.filter((rule) => rule.enabled);
    }

    return rules;
  }

  /**
   * @method invalidate
   * @description 执行缓存失效
   * @param target 失效目标（键、模式、标签等）
   * @param strategy 失效策略
   * @param options 失效选项
   * @returns {Promise<InvalidationResult>} 失效结果
   */
  async invalidate(
    target: string | string[],
    strategy: InvalidationStrategy = this.config.defaultStrategy!,
    options?: {
      namespace?: string;
      tags?: string[];
      timeout?: number;
      retries?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<InvalidationResult> {
    const startTime = Date.now();
    const targets = Array.isArray(target) ? target : [target];

    try {
      if (!this.cacheService) {
        throw new Error('Cache service not set');
      }

      const result: InvalidationResult = {
        invalidatedKeys: 0,
        invalidatedNamespaces: 0,
        invalidatedTags: 0,
        keys: [],
        namespaces: [],
        tags: [],
        invalidatedAt: new Date(),
        executionTime: 0,
        success: false,
        metadata: options?.metadata || {},
      };

      // 根据策略执行失效
      switch (strategy) {
        case InvalidationStrategy.EXACT:
          result.keys = await this.invalidateExact(targets);
          break;
        case InvalidationStrategy.PREFIX:
          result.namespaces = await this.invalidatePrefix(targets);
          break;
        case InvalidationStrategy.SUFFIX:
          result.keys = await this.invalidateSuffix(targets);
          break;
        case InvalidationStrategy.WILDCARD:
          result.keys = await this.invalidateWildcard(targets);
          break;
        case InvalidationStrategy.REGEX:
          result.keys = await this.invalidateRegex(targets);
          break;
        case InvalidationStrategy.TAG:
          result.tags = await this.invalidateTags(targets);
          break;
        case InvalidationStrategy.NAMESPACE:
          result.namespaces = await this.invalidateNamespaces(targets);
          break;
        case InvalidationStrategy.BATCH:
          result.keys = await this.invalidateBatch(targets);
          break;
        default:
          throw new Error(`Unsupported invalidation strategy: ${strategy}`);
      }

      result.invalidatedKeys = result.keys.length;
      result.invalidatedNamespaces = result.namespaces.length;
      result.invalidatedTags = result.tags.length;
      result.executionTime = Date.now() - startTime;
      result.success = true;

      // 更新统计
      this.updateStats(strategy, result.executionTime, result.invalidatedKeys);

      this.logger.info(
        `Cache invalidation completed: ${result.invalidatedKeys} keys, ${result.executionTime}ms`,
        LogContext.CACHE
      );
      this.emitEvent('invalidation_completed', { result, strategy });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateStats(strategy, executionTime, 0, true);

      this.logger.error(
        `Cache invalidation failed: ${(error as Error).message}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      this.emitEvent('invalidation_failed', { error, strategy, targets });

      return {
        invalidatedKeys: 0,
        invalidatedNamespaces: 0,
        invalidatedTags: 0,
        keys: [],
        namespaces: [],
        tags: [],
        invalidatedAt: new Date(),
        executionTime,
        success: false,
        error: (error as Error).message,
        metadata: options?.metadata || {},
      };
    }
  }

  /**
   * @method invalidateByRule
   * @description 根据规则执行缓存失效
   * @param ruleId 规则ID
   * @param context 执行上下文
   * @returns {Promise<InvalidationResult>} 失效结果
   */
  async invalidateByRule(
    ruleId: string,
    context?: Record<string, any>
  ): Promise<InvalidationResult> {
    const rule = this.getRule(ruleId);
    if (!rule) {
      throw new Error(`Invalidation rule not found: ${ruleId}`);
    }

    if (!rule.enabled) {
      this.logger.warn(
        `Invalidation rule is disabled: ${rule.name}`,
        LogContext.CACHE
      );
      return {
        invalidatedKeys: 0,
        invalidatedNamespaces: 0,
        invalidatedTags: 0,
        keys: [],
        namespaces: [],
        tags: [],
        invalidatedAt: new Date(),
        executionTime: 0,
        success: false,
        error: 'Rule is disabled',
      };
    }

    // 检查条件
    if (rule.condition && !this.evaluateCondition(rule.condition, context)) {
      this.logger.debug(
        `Invalidation rule condition not met: ${rule.name}`,
        LogContext.CACHE
      );
      return {
        invalidatedKeys: 0,
        invalidatedNamespaces: 0,
        invalidatedTags: 0,
        keys: [],
        namespaces: [],
        tags: [],
        invalidatedAt: new Date(),
        executionTime: 0,
        success: false,
        error: 'Condition not met',
      };
    }

    // 检查依赖
    if (rule.dependencies && rule.dependencies.length > 0) {
      for (const depId of rule.dependencies) {
        const depRule = this.getRule(depId);
        if (!depRule || !depRule.enabled) {
          this.logger.warn(
            `Dependency rule not found or disabled: ${depId}`,
            LogContext.CACHE
          );
          return {
            invalidatedKeys: 0,
            invalidatedNamespaces: 0,
            invalidatedTags: 0,
            keys: [],
            namespaces: [],
            tags: [],
            invalidatedAt: new Date(),
            executionTime: 0,
            success: false,
            error: 'Dependency not satisfied',
          };
        }
      }
    }

    return this.invalidate(rule.pattern, rule.strategy, {
      metadata: { ruleId, ruleName: rule.name, context },
    });
  }

  /**
   * @method getStats
   * @description 获取失效统计信息
   * @returns {InvalidationStats} 统计信息
   */
  getStats(): InvalidationStats {
    return { ...this.stats };
  }

  /**
   * @method resetStats
   * @description 重置失效统计信息
   */
  resetStats(): void {
    this.stats = this.initializeStats();
    this.logger.info('Invalidation stats reset', LogContext.CACHE);
  }

  /**
   * @method onDestroy
   * @description 销毁时清理资源
   */
  onDestroy(): void {
    this.stopMonitoring();
    this.logger.info('CacheInvalidationService destroyed', LogContext.CACHE);
  }

  // 私有方法

  /**
   * @private
   * @method initializeStats
   * @description 初始化统计信息
   * @returns {InvalidationStats} 初始统计信息
   */
  private initializeStats(): InvalidationStats {
    return {
      totalInvalidations: 0,
      successfulInvalidations: 0,
      failedInvalidations: 0,
      averageExecutionTime: 0,
      totalInvalidatedKeys: 0,
      activeRules: 0,
      lastInvalidation: new Date(),
      strategyUsage: Object.values(InvalidationStrategy).reduce(
        (acc, strategy) => {
          acc[strategy] = 0;
          return acc;
        },
        {} as Record<InvalidationStrategy, number>
      ),
      triggerUsage: Object.values(InvalidationTrigger).reduce(
        (acc, trigger) => {
          acc[trigger] = 0;
          return acc;
        },
        {} as Record<InvalidationTrigger, number>
      ),
    };
  }

  /**
   * @private
   * @method invalidateExact
   * @description 精确匹配失效
   * @param keys 缓存键列表
   * @returns {Promise<string[]>} 失效的键列表
   */
  private async invalidateExact(keys: string[]): Promise<string[]> {
    const invalidatedKeys: string[] = [];

    for (const key of keys) {
      try {
        // 解析完整的键字符串
        const cacheKey = this.keyFactory.parse(key);
        const deleted = await this.cacheService!.delete(cacheKey);
        if (deleted) {
          invalidatedKeys.push(key);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to invalidate exact key: ${key}`,
          LogContext.CACHE,
          undefined,
          error as Error
        );
      }
    }

    return invalidatedKeys;
  }

  /**
   * @private
   * @method invalidatePrefix
   * @description 前缀匹配失效
   * @param prefixes 前缀列表
   * @returns {Promise<string[]>} 失效的键列表
   */
  private async invalidatePrefix(prefixes: string[]): Promise<string[]> {
    // 这里需要缓存服务支持前缀查询，简化实现
    const invalidatedKeys: string[] = [];

    for (const prefix of prefixes) {
      try {
        // 假设缓存服务支持按命名空间清除
        const cleared = await this.cacheService!.clear(prefix);
        if (cleared) {
          invalidatedKeys.push(prefix);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to invalidate prefix: ${prefix}`,
          LogContext.CACHE,
          undefined,
          error as Error
        );
      }
    }

    return invalidatedKeys;
  }

  /**
   * @private
   * @method invalidateSuffix
   * @description 后缀匹配失效
   * @param suffixes 后缀列表
   * @returns {Promise<string[]>} 失效的键列表
   */
  private async invalidateSuffix(suffixes: string[]): Promise<string[]> {
    // 简化实现，实际需要缓存服务支持后缀查询
    const invalidatedKeys: string[] = [];

    // 这里需要遍历所有缓存键来匹配后缀
    // 实际实现中可能需要缓存服务提供键列表查询功能

    return invalidatedKeys;
  }

  /**
   * @private
   * @method invalidateWildcard
   * @description 通配符匹配失效
   * @param patterns 通配符模式列表
   * @returns {Promise<string[]>} 失效的键列表
   */
  private async invalidateWildcard(patterns: string[]): Promise<string[]> {
    const invalidatedKeys: string[] = [];

    for (const pattern of patterns) {
      try {
        // 仅记录模式，实际匹配依赖具体缓存实现
        this.logger.debug(
          `Wildcard invalidation pattern: ${pattern}`,
          LogContext.CACHE
        );
      } catch (error) {
        this.logger.warn(
          `Failed to invalidate wildcard pattern: ${pattern}`,
          LogContext.CACHE,
          undefined,
          error as Error
        );
      }
    }

    return invalidatedKeys;
  }

  /**
   * @private
   * @method invalidateRegex
   * @description 正则表达式匹配失效
   * @param patterns 正则表达式模式列表
   * @returns {Promise<string[]>} 失效的键列表
   */
  private async invalidateRegex(patterns: string[]): Promise<string[]> {
    const invalidatedKeys: string[] = [];

    for (const pattern of patterns) {
      try {
        // 仅记录模式，实际匹配依赖具体缓存实现
        this.logger.debug(
          `Regex invalidation pattern: ${pattern}`,
          LogContext.CACHE
        );
      } catch (error) {
        this.logger.warn(
          `Failed to invalidate regex pattern: ${pattern}`,
          LogContext.CACHE,
          undefined,
          error as Error
        );
      }
    }

    return invalidatedKeys;
  }

  /**
   * @private
   * @method invalidateTags
   * @description 标签匹配失效
   * @param tags 标签列表
   * @returns {Promise<string[]>} 失效的标签列表
   */
  private async invalidateTags(tags: string[]): Promise<string[]> {
    // 简化实现，实际需要缓存服务支持标签查询
    const invalidatedTags: string[] = [];

    for (const tag of tags) {
      try {
        // 这里需要缓存服务支持标签失效
        this.logger.debug(`Tag invalidation: ${tag}`, LogContext.CACHE);
        invalidatedTags.push(tag);
      } catch (error) {
        this.logger.warn(
          `Failed to invalidate tag: ${tag}`,
          LogContext.CACHE,
          undefined,
          error as Error
        );
      }
    }

    return invalidatedTags;
  }

  /**
   * @private
   * @method invalidateNamespaces
   * @description 命名空间匹配失效
   * @param namespaces 命名空间列表
   * @returns {Promise<string[]>} 失效的命名空间列表
   */
  private async invalidateNamespaces(namespaces: string[]): Promise<string[]> {
    const invalidatedNamespaces: string[] = [];

    for (const namespace of namespaces) {
      try {
        const cleared = await this.cacheService!.clear(namespace);
        if (cleared) {
          invalidatedNamespaces.push(namespace);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to invalidate namespace: ${namespace}`,
          LogContext.CACHE,
          undefined,
          error as Error
        );
      }
    }

    return invalidatedNamespaces;
  }

  /**
   * @private
   * @method invalidateBatch
   * @description 批量失效
   * @param targets 目标列表
   * @returns {Promise<string[]>} 失效的键列表
   */
  private async invalidateBatch(targets: string[]): Promise<string[]> {
    const invalidatedKeys: string[] = [];
    const batchSize = this.config.batchSize || 100;

    // 分批处理
    for (let i = 0; i < targets.length; i += batchSize) {
      const batch = targets.slice(i, i + batchSize);

      try {
        const batchKeys = await this.invalidateExact(batch);
        invalidatedKeys.push(...batchKeys);
      } catch (error) {
        this.logger.warn(
          `Failed to invalidate batch ${i / batchSize + 1}`,
          LogContext.CACHE,
          undefined,
          error as Error
        );
      }
    }

    return invalidatedKeys;
  }

  /**
   * @private
   * @method evaluateCondition
   * @description 评估条件表达式
   * @param condition 条件表达式
   * @param context 执行上下文
   * @returns {boolean} 条件是否满足
   */
  private evaluateCondition(
    condition: string,
    context?: Record<string, any>
  ): boolean {
    try {
      // 简化实现，实际可以使用表达式引擎
      // 这里只是示例，实际实现需要更复杂的表达式解析
      return true;
    } catch (error) {
      this.logger.warn(
        `Failed to evaluate condition: ${condition}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return false;
    }
  }

  /**
   * @private
   * @method updateStats
   * @description 更新统计信息
   * @param strategy 失效策略
   * @param executionTime 执行时间
   * @param invalidatedKeys 失效键数
   * @param failed 是否失败
   */
  private updateStats(
    strategy: InvalidationStrategy,
    executionTime: number,
    invalidatedKeys: number,
    failed = false
  ): void {
    this.stats.totalInvalidations++;

    if (failed) {
      this.stats.failedInvalidations++;
    } else {
      this.stats.successfulInvalidations++;
      this.stats.totalInvalidatedKeys += invalidatedKeys;
    }

    this.stats.averageExecutionTime =
      (this.stats.averageExecutionTime * (this.stats.totalInvalidations - 1) +
        executionTime) /
      this.stats.totalInvalidations;

    this.stats.lastInvalidation = new Date();
    this.stats.activeRules = Array.from(this.rules.values()).filter(
      (rule) => rule.enabled
    ).length;

    if (this.stats.strategyUsage[strategy] !== undefined) {
      this.stats.strategyUsage[strategy]++;
    }
  }

  /**
   * @private
   * @method emitEvent
   * @description 发送失效事件
   * @param type 事件类型
   * @param data 事件数据
   */
  private emitEvent(type: string, data: any): void {
    if (this.config.enableEvents) {
      try {
        this.eventEmitter.emit(`cache.invalidation.${type}`, {
          type,
          data,
          timestamp: new Date(),
          serviceId: 'cache-invalidation',
        });
      } catch (error) {
        this.logger.warn(
          `Failed to emit invalidation event: ${type}`,
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
            'Invalidation monitoring failed',
            LogContext.CACHE,
            undefined,
            error as Error
          );
        }
      }, this.config.monitoringInterval);

      this.logger.info(
        `Started invalidation monitoring, interval: ${this.config.monitoringInterval}ms`,
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
      this.logger.info('Stopped invalidation monitoring', LogContext.CACHE);
    }
  }

  /**
   * @private
   * @method performMonitoring
   * @description 执行监控
   */
  private async performMonitoring(): Promise<void> {
    try {
      const stats = this.getStats();
      this.emitEvent('monitoring', { stats });

      // 检查活跃规则
      const activeRules = Array.from(this.rules.values()).filter(
        (rule) => rule.enabled
      );
      this.logger.debug(
        `Active invalidation rules: ${activeRules.length}`,
        LogContext.CACHE
      );
    } catch (error) {
      this.logger.error(
        'Invalidation monitoring execution failed',
        LogContext.CACHE,
        undefined,
        error as Error
      );
    }
  }
}
