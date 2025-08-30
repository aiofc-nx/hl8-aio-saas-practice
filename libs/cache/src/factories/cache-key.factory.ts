/**
 * @file cache-key.factory.ts
 * @description 缓存键工厂
 *
 * 该文件实现了缓存键的创建和管理功能，包括：
 * - 缓存键的创建和解析
 * - 命名空间管理
 * - 租户和用户隔离
 * - 标签支持
 * - 版本控制
 *
 * 遵循DDD和Clean Architecture原则，提供统一的缓存键管理。
 */

import { Injectable } from '@nestjs/common';
import { ICacheKeyFactory, CacheKey } from '../interfaces/cache.interface';
import { minimatch } from 'minimatch';

/**
 * @class CacheKeyFactory
 * @description 缓存键工厂实现
 *
 * 提供缓存键的创建和管理功能，包括：
 * - 基础键创建
 * - 命名空间键创建
 * - 租户隔离键创建
 * - 用户隔离键创建
 * - 标签键创建
 * - 键字符串转换
 */
@Injectable()
export class CacheKeyFactory implements ICacheKeyFactory {
  /** 默认命名空间分隔符 */
  private readonly DEFAULT_SEPARATOR = ':';
  /** 默认版本号 */
  private readonly DEFAULT_VERSION = 'v1';

  /**
   * @method create
   * @description 创建缓存键
   * @param key 基础键名
   * @param options 键选项
   * @returns 缓存键
   */
  create(key: string, options?: Partial<CacheKey>): CacheKey {
    return {
      key: this.sanitizeKey(key),
      namespace: options?.namespace,
      version: options?.version,
      tenantId: options?.tenantId,
      userId: options?.userId,
      tags: options?.tags || [],
    };
  }

  /**
   * @method createNamespace
   * @description 创建命名空间键
   * @param namespace 命名空间
   * @param key 键名
   * @param options 键选项
   * @returns 缓存键
   */
  createNamespace(
    namespace: string,
    key: string,
    options?: Partial<CacheKey>
  ): CacheKey {
    return this.create(key, {
      ...options,
      namespace: this.sanitizeNamespace(namespace),
    });
  }

  /**
   * @method createTenant
   * @description 创建租户键
   * @param tenantId 租户ID
   * @param key 键名
   * @param options 键选项
   * @returns 缓存键
   */
  createTenant(
    tenantId: string,
    key: string,
    options?: Partial<CacheKey>
  ): CacheKey {
    return this.create(key, {
      ...options,
      tenantId: this.sanitizeId(tenantId),
    });
  }

  /**
   * @method createUser
   * @description 创建用户键
   * @param userId 用户ID
   * @param key 键名
   * @param options 键选项
   * @returns 缓存键
   */
  createUser(
    userId: string,
    key: string,
    options?: Partial<CacheKey>
  ): CacheKey {
    return this.create(key, {
      ...options,
      userId: this.sanitizeId(userId),
    });
  }

  /**
   * @method createTagged
   * @description 创建带标签的键
   * @param key 键名
   * @param tags 标签数组
   * @param options 键选项
   * @returns 缓存键
   */
  createTagged(
    key: string,
    tags: string[],
    options?: Partial<CacheKey>
  ): CacheKey {
    return this.create(key, {
      ...options,
      tags: this.sanitizeTags(tags),
    });
  }

  /**
   * @method toString
   * @description 将缓存键转换为字符串
   * @param cacheKey 缓存键
   * @returns 字符串形式的键
   */
  toString(cacheKey: CacheKey): string {
    const parts: string[] = [];

    // 添加版本号（只有当明确指定时才添加）
    if (cacheKey.version) {
      parts.push(cacheKey.version);
    }

    // 添加命名空间
    if (cacheKey.namespace) {
      parts.push(cacheKey.namespace);
    }

    // 添加租户ID
    if (cacheKey.tenantId) {
      parts.push(`tenant:${cacheKey.tenantId}`);
    }

    // 添加用户ID
    if (cacheKey.userId) {
      parts.push(`user:${cacheKey.userId}`);
    }

    // 添加标签
    if (cacheKey.tags && cacheKey.tags.length > 0) {
      parts.push(`tags:${cacheKey.tags.sort().join(',')}`);
    }

    // 添加基础键名
    parts.push(cacheKey.key);

    return parts.join(this.DEFAULT_SEPARATOR);
  }

  /**
   * @method parse
   * @description 解析字符串为缓存键
   * @param keyString 键字符串
   * @returns 缓存键
   */
  parse(keyString: string): CacheKey {
    const parts = keyString.split(this.DEFAULT_SEPARATOR);
    const cacheKey: CacheKey = {
      key: '',
      tags: [],
    };

    let currentIndex = 0;

    // 解析版本号（第一个部分）
    if (parts.length > 0 && parts[0].startsWith('v')) {
      cacheKey.version = parts[currentIndex];
      currentIndex++;
    }

    // 解析命名空间（如果存在且不是特殊前缀）
    if (
      currentIndex < parts.length &&
      parts[currentIndex] !== 'tenant' &&
      parts[currentIndex] !== 'user' &&
      parts[currentIndex] !== 'tags' &&
      currentIndex < parts.length - 1
    ) {
      // 确保不是最后一个部分（键名）
      cacheKey.namespace = parts[currentIndex];
      currentIndex++;
    }

    // 解析租户ID
    if (currentIndex < parts.length && parts[currentIndex] === 'tenant') {
      currentIndex++; // 跳过 'tenant'
      if (currentIndex < parts.length) {
        cacheKey.tenantId = parts[currentIndex];
        currentIndex++;
      }
    }

    // 解析用户ID
    if (currentIndex < parts.length && parts[currentIndex] === 'user') {
      currentIndex++; // 跳过 'user'
      if (currentIndex < parts.length) {
        cacheKey.userId = parts[currentIndex];
        currentIndex++;
      }
    }

    // 解析标签
    if (currentIndex < parts.length && parts[currentIndex] === 'tags') {
      currentIndex++; // 跳过 'tags'
      if (currentIndex < parts.length) {
        const tagsString = parts[currentIndex];
        cacheKey.tags = tagsString.split(',').filter((tag) => tag.length > 0);
        currentIndex++;
      }
    }

    // 剩余部分作为基础键名
    if (currentIndex < parts.length) {
      cacheKey.key = parts.slice(currentIndex).join(this.DEFAULT_SEPARATOR);
    }

    return cacheKey;
  }

  /**
   * @method createPattern
   * @description 创建模式匹配键
   * @param pattern 模式字符串
   * @param options 键选项
   * @returns 模式键
   */
  createPattern(pattern: string, options?: Partial<CacheKey>): string {
    const parts: string[] = [];

    // 添加版本号
    if (options?.version) {
      parts.push(options.version);
    } else {
      parts.push(this.DEFAULT_VERSION);
    }

    // 添加命名空间
    if (options?.namespace) {
      parts.push(this.sanitizeNamespace(options.namespace));
    }

    // 添加租户ID
    if (options?.tenantId) {
      parts.push(`tenant:${this.sanitizeId(options.tenantId)}`);
    }

    // 添加用户ID
    if (options?.userId) {
      parts.push(`user:${this.sanitizeId(options.userId)}`);
    }

    // 添加标签
    if (options?.tags && options.tags.length > 0) {
      parts.push(`tags:${this.sanitizeTags(options.tags).sort().join(',')}`);
    }

    // 添加模式（不清理特殊字符）
    parts.push(pattern);

    return parts.join(this.DEFAULT_SEPARATOR);
  }

  /**
   * @method matchPattern
   * @description 检查键是否匹配模式
   * @param key 缓存键
   * @param pattern 模式字符串
   * @returns 是否匹配
   */
  matchPattern(key: CacheKey, pattern: string): boolean {
    const keyString = this.toString(key);

    // 使用 minimatch 进行模式匹配
    return minimatch(keyString, pattern);
  }

  /**
   * @method extractNamespace
   * @description 从键中提取命名空间
   * @param cacheKey 缓存键
   * @returns 命名空间
   */
  extractNamespace(cacheKey: CacheKey): string | undefined {
    return cacheKey.namespace;
  }

  /**
   * @method extractTenantId
   * @description 从键中提取租户ID
   * @param cacheKey 缓存键
   * @returns 租户ID
   */
  extractTenantId(cacheKey: CacheKey): string | undefined {
    return cacheKey.tenantId;
  }

  /**
   * @method extractUserId
   * @description 从键中提取用户ID
   * @param cacheKey 缓存键
   * @returns 用户ID
   */
  extractUserId(cacheKey: CacheKey): string | undefined {
    return cacheKey.userId;
  }

  /**
   * @method extractTags
   * @description 从键中提取标签
   * @param cacheKey 缓存键
   * @returns 标签数组
   */
  extractTags(cacheKey: CacheKey): string[] {
    return cacheKey.tags || [];
  }

  /**
   * @private sanitizeKey
   * @description 清理键名
   * @param key 原始键名
   * @returns 清理后的键名
   */
  private sanitizeKey(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new Error('Cache key must be a non-empty string');
    }

    // 移除首尾空格
    let sanitized = key.trim();

    // 替换特殊字符
    sanitized = sanitized.replace(/[^a-zA-Z0-9\-_.]/g, '_');

    // 确保不为空
    if (sanitized.length === 0) {
      throw new Error('Cache key cannot be empty after sanitization');
    }

    return sanitized;
  }

  /**
   * @private sanitizeNamespace
   * @description 清理命名空间
   * @param namespace 原始命名空间
   * @returns 清理后的命名空间
   */
  private sanitizeNamespace(namespace: string): string {
    if (!namespace || typeof namespace !== 'string') {
      throw new Error('Namespace must be a non-empty string');
    }

    // 移除首尾空格
    let sanitized = namespace.trim();

    // 替换特殊字符
    sanitized = sanitized.replace(/[^a-zA-Z0-9\-_.]/g, '_');

    // 确保不为空
    if (sanitized.length === 0) {
      throw new Error('Namespace cannot be empty after sanitization');
    }

    return sanitized.toLowerCase();
  }

  /**
   * @private sanitizeId
   * @description 清理ID
   * @param id 原始ID
   * @returns 清理后的ID
   */
  private sanitizeId(id: string): string {
    if (!id || typeof id !== 'string') {
      throw new Error('ID must be a non-empty string');
    }

    // 移除首尾空格
    let sanitized = id.trim();

    // 替换特殊字符
    sanitized = sanitized.replace(/[^a-zA-Z0-9\-_]/g, '_');

    // 确保不为空
    if (sanitized.length === 0) {
      throw new Error('ID cannot be empty after sanitization');
    }

    return sanitized;
  }

  /**
   * @private sanitizeTags
   * @description 清理标签数组
   * @param tags 原始标签数组
   * @returns 清理后的标签数组
   */
  private sanitizeTags(tags: string[]): string[] {
    if (!Array.isArray(tags)) {
      return [];
    }

    return tags
      .filter((tag) => tag && typeof tag === 'string')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
      .map((tag) => tag.replace(/[^a-zA-Z0-9\-_]/g, '_'))
      .filter((tag, index, array) => array.indexOf(tag) === index); // 去重
  }
}
