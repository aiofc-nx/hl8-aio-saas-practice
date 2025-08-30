import { Injectable } from '@nestjs/common';
import { PinoLoggerService, LogContext } from '@aiofix/logging';

/**
 * @interface CacheKeyConfig
 * @description
 * 缓存键配置接口。
 */
export interface CacheKeyConfig {
  /** 默认命名空间 */
  defaultNamespace?: string;
  /** 键分隔符 */
  separator?: string;
  /** 是否启用键压缩 */
  enableCompression?: boolean;
  /** 最大键长度 */
  maxKeyLength?: number;
  /** 是否启用键验证 */
  enableValidation?: boolean;
}

/**
 * @interface CacheKeyOptions
 * @description
 * 缓存键选项接口。
 */
export interface CacheKeyOptions {
  /** 命名空间 */
  namespace?: string;
  /** 版本 */
  version?: string;
  /** 租户ID */
  tenantId?: string;
  /** 用户ID */
  userId?: string;
  /** 过期时间 */
  ttl?: number;
  /** 标签 */
  tags?: string[];
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * @class CacheKeyFactory
 * @description
 * 缓存键工厂服务，用于生成标准化的缓存键。
 *
 * 主要功能包括：
 * 1. 生成标准化的缓存键
 * 2. 支持命名空间和版本控制
 * 3. 支持多租户和用户隔离
 * 4. 支持键压缩和验证
 * 5. 支持标签和元数据
 *
 * 设计原则：
 * - 一致性：所有缓存键都遵循相同的格式
 * - 可读性：键名具有清晰的语义
 * - 唯一性：确保键的唯一性
 * - 性能：高效的键生成算法
 * - 扩展性：支持未来的扩展需求
 */
@Injectable()
export class CacheKeyFactory {
  private readonly logger: PinoLoggerService;

  /**
   * 服务配置
   */
  private config: Required<CacheKeyConfig>;

  /**
   * 键生成统计
   */
  private stats: {
    totalKeys: number;
    keysByNamespace: Record<string, number>;
    keysByType: Record<string, number>;
    compressionRatio: number;
    averageKeyLength: number;
  };

  constructor(logger: PinoLoggerService) {
    this.logger = logger;
    this.config = {
      defaultNamespace: 'cache',
      separator: ':',
      enableCompression: false,
      maxKeyLength: 250,
      enableValidation: true,
    };

    this.stats = {
      totalKeys: 0,
      keysByNamespace: {},
      keysByType: {},
      compressionRatio: 0,
      averageKeyLength: 0,
    };

    this.logger.info('CacheKeyFactory initialized', LogContext.CACHE);
  }

  /**
   * @method createKey
   * @description 创建标准缓存键
   * @param namespace 命名空间
   * @param type 类型
   * @param id 标识符
   * @param options 选项
   * @returns {string} 缓存键
   */
  createKey(
    namespace: string,
    type: string,
    id: string,
    options?: CacheKeyOptions
  ): string {
    const parts = [
      options?.namespace || this.config.defaultNamespace,
      namespace,
      type,
      id,
    ];

    if (options?.version) {
      parts.push('v', options.version);
    }

    if (options?.tenantId) {
      parts.push('tenant', options.tenantId);
    }

    if (options?.userId) {
      parts.push('user', options.userId);
    }

    let key = parts.join(this.config.separator);

    // 应用压缩（如果需要）
    if (this.config.enableCompression) {
      key = this.compressKey(key);
    }

    // 验证键长度
    if (this.config.enableValidation && key.length > this.config.maxKeyLength) {
      this.logger.warn(
        `Cache key too long: ${key.length} > ${this.config.maxKeyLength}`,
        LogContext.CACHE
      );
      key = this.truncateKey(key);
    }

    // 更新统计
    this.updateStats(namespace, type, key);

    return key;
  }

  /**
   * @method createUserKey
   * @description 创建用户相关缓存键
   * @param userId 用户ID
   * @param tenantId 租户ID
   * @param type 类型
   * @param id 标识符
   * @param options 选项
   * @returns {string} 缓存键
   */
  createUserKey(
    userId: string,
    tenantId: string,
    type: string,
    id: string,
    options?: CacheKeyOptions
  ): string {
    return this.createKey('user', type, id, {
      ...options,
      userId,
      tenantId,
    });
  }

  /**
   * @method createTenantKey
   * @description 创建租户相关缓存键
   * @param tenantId 租户ID
   * @param type 类型
   * @param id 标识符
   * @param options 选项
   * @returns {string} 缓存键
   */
  createTenantKey(
    tenantId: string,
    type: string,
    id: string,
    options?: CacheKeyOptions
  ): string {
    return this.createKey('tenant', type, id, {
      ...options,
      tenantId,
    });
  }

  /**
   * @method createPermissionKey
   * @description 创建权限相关缓存键
   * @param userId 用户ID
   * @param tenantId 租户ID
   * @param resource 资源
   * @param action 操作
   * @param options 选项
   * @returns {string} 缓存键
   */
  createPermissionKey(
    userId: string,
    tenantId: string,
    resource: string,
    action: string,
    options?: CacheKeyOptions
  ): string {
    const id = `${resource}:${action}`;
    return this.createKey('permission', 'access', id, {
      ...options,
      userId,
      tenantId,
    });
  }

  /**
   * @method createSessionKey
   * @description 创建会话相关缓存键
   * @param sessionId 会话ID
   * @param userId 用户ID
   * @param tenantId 租户ID
   * @param options 选项
   * @returns {string} 缓存键
   */
  createSessionKey(
    sessionId: string,
    userId: string,
    tenantId: string,
    options?: CacheKeyOptions
  ): string {
    return this.createKey('session', 'data', sessionId, {
      ...options,
      userId,
      tenantId,
    });
  }

  /**
   * @method createEventKey
   * @description 创建事件相关缓存键
   * @param eventId 事件ID
   * @param aggregateId 聚合根ID
   * @param eventType 事件类型
   * @param options 选项
   * @returns {string} 缓存键
   */
  createEventKey(
    eventId: string,
    aggregateId: string,
    eventType: string,
    options?: CacheKeyOptions
  ): string {
    return this.createKey('event', eventType, eventId, {
      ...options,
      metadata: {
        ...options?.metadata,
        aggregateId,
      },
    });
  }

  /**
   * @method createAggregateKey
   * @description 创建聚合根相关缓存键
   * @param aggregateId 聚合根ID
   * @param aggregateType 聚合根类型
   * @param options 选项
   * @returns {string} 缓存键
   */
  createAggregateKey(
    aggregateId: string,
    aggregateType: string,
    options?: CacheKeyOptions
  ): string {
    return this.createKey('aggregate', aggregateType, aggregateId, options);
  }

  /**
   * @method createSnapshotKey
   * @description 创建快照相关缓存键
   * @param aggregateId 聚合根ID
   * @param version 版本
   * @param options 选项
   * @returns {string} 缓存键
   */
  createSnapshotKey(
    aggregateId: string,
    version: number,
    options?: CacheKeyOptions
  ): string {
    return this.createKey('snapshot', 'state', aggregateId, {
      ...options,
      version: version.toString(),
    });
  }

  /**
   * @method createProjectionKey
   * @description 创建投影相关缓存键
   * @param projectionName 投影名称
   * @param projectionType 投影类型
   * @param options 选项
   * @returns {string} 缓存键
   */
  createProjectionKey(
    projectionName: string,
    projectionType: string,
    options?: CacheKeyOptions
  ): string {
    return this.createKey(
      'projection',
      projectionType,
      projectionName,
      options
    );
  }

  /**
   * @method createPatternKey
   * @description 创建模式匹配键
   * @param namespace 命名空间
   * @param type 类型
   * @param pattern 模式
   * @param options 选项
   * @returns {string} 模式键
   */
  createPatternKey(
    namespace: string,
    type: string,
    pattern: string,
    options?: CacheKeyOptions
  ): string {
    const parts = [
      options?.namespace || this.config.defaultNamespace,
      namespace,
      type,
      pattern,
    ];

    if (options?.version) {
      parts.push('v', options.version);
    }

    if (options?.tenantId) {
      parts.push('tenant', options.tenantId);
    }

    return parts.join(this.config.separator) + '*';
  }

  /**
   * @method parseKey
   * @description 解析缓存键
   * @param key 缓存键
   * @returns {object} 解析结果
   */
  parseKey(key: string): {
    namespace: string;
    type: string;
    id: string;
    version?: string;
    tenantId?: string;
    userId?: string;
  } {
    const parts = key.split(this.config.separator);
    const result: any = {};

    if (parts.length >= 4) {
      result.namespace = parts[1];
      result.type = parts[2];
      result.id = parts[3];

      // 解析版本
      const versionIndex = parts.indexOf('v');
      if (versionIndex > 0 && versionIndex + 1 < parts.length) {
        result.version = parts[versionIndex + 1];
      }

      // 解析租户ID
      const tenantIndex = parts.indexOf('tenant');
      if (tenantIndex > 0 && tenantIndex + 1 < parts.length) {
        result.tenantId = parts[tenantIndex + 1];
      }

      // 解析用户ID
      const userIndex = parts.indexOf('user');
      if (userIndex > 0 && userIndex + 1 < parts.length) {
        result.userId = parts[userIndex + 1];
      }
    }

    return result;
  }

  /**
   * @method validateKey
   * @description 验证缓存键
   * @param key 缓存键
   * @returns {boolean} 是否有效
   */
  validateKey(key: string): boolean {
    if (!key || typeof key !== 'string') {
      return false;
    }

    if (key.length > this.config.maxKeyLength) {
      return false;
    }

    // 检查是否包含无效字符
    const invalidChars = /[^\w\-:]/;
    if (invalidChars.test(key)) {
      return false;
    }

    return true;
  }

  /**
   * @method compressKey
   * @description 压缩缓存键
   * @param key 原始键
   * @returns {string} 压缩后的键
   */
  private compressKey(key: string): string {
    // 简单的压缩算法：移除重复的分隔符和空段
    return key
      .split(this.config.separator)
      .filter((part) => part.length > 0)
      .join(this.config.separator);
  }

  /**
   * @method truncateKey
   * @description 截断过长的键
   * @param key 原始键
   * @returns {string} 截断后的键
   */
  private truncateKey(key: string): string {
    if (key.length <= this.config.maxKeyLength) {
      return key;
    }

    // 保留前缀和后缀，截断中间部分
    const prefixLength = Math.floor(this.config.maxKeyLength * 0.3);
    const suffixLength = Math.floor(this.config.maxKeyLength * 0.2);
    const middleLength =
      this.config.maxKeyLength - prefixLength - suffixLength - 3; // 3 for "..."

    const prefix = key.substring(0, prefixLength);
    const suffix = key.substring(key.length - suffixLength);
    const hash = this.simpleHash(
      key.substring(prefixLength, key.length - suffixLength)
    );

    return `${prefix}...${hash.substring(0, middleLength)}...${suffix}`;
  }

  /**
   * @method simpleHash
   * @description 简单哈希函数
   * @param str 输入字符串
   * @returns {string} 哈希值
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * @method updateStats
   * @description 更新统计信息
   * @param namespace 命名空间
   * @param type 类型
   * @param key 键
   */
  private updateStats(namespace: string, type: string, key: string): void {
    this.stats.totalKeys++;
    this.stats.keysByNamespace[namespace] =
      (this.stats.keysByNamespace[namespace] || 0) + 1;
    this.stats.keysByType[type] = (this.stats.keysByType[type] || 0) + 1;

    // 更新平均键长度
    const totalLength =
      this.stats.averageKeyLength * (this.stats.totalKeys - 1) + key.length;
    this.stats.averageKeyLength = totalLength / this.stats.totalKeys;
  }

  /**
   * @method getStats
   * @description 获取统计信息
   * @returns {object} 统计信息
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * @method resetStats
   * @description 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalKeys: 0,
      keysByNamespace: {},
      keysByType: {},
      compressionRatio: 0,
      averageKeyLength: 0,
    };
  }

  /**
   * @method getHealth
   * @description 获取健康状态
   * @returns {object} 健康状态
   */
  getHealth(): {
    status: 'healthy' | 'unhealthy';
    timestamp: Date;
    stats: ReturnType<CacheKeyFactory['getStats']>;
  } {
    return {
      status: 'healthy',
      timestamp: new Date(),
      stats: this.getStats(),
    };
  }
}
