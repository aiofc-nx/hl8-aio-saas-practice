/**
 * @file cache-key.factory.spec.ts
 * @description 缓存键工厂单元测试
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CacheKeyFactory } from './cache-key.factory';
import { CacheKey } from '../interfaces/cache.interface';

describe('CacheKeyFactory', () => {
  let factory: CacheKeyFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheKeyFactory],
    }).compile();

    factory = module.get<CacheKeyFactory>(CacheKeyFactory);
  });

  describe('create', () => {
    it('should create basic cache key', () => {
      const result = factory.create('test-key');

      expect(result).toEqual({
        key: 'test-key',
        tags: [],
      });
    });

    it('should create cache key with options', () => {
      const options: Partial<CacheKey> = {
        namespace: 'test-namespace',
        version: 'v2',
        tenantId: 'tenant-123',
        userId: 'user-456',
        tags: ['tag1', 'tag2'],
      };

      const result = factory.create('test-key', options);

      expect(result).toEqual({
        key: 'test-key',
        namespace: 'test-namespace',
        version: 'v2',
        tenantId: 'tenant-123',
        userId: 'user-456',
        tags: ['tag1', 'tag2'],
      });
    });

    it('should sanitize key name', () => {
      const result = factory.create('test key with spaces!@#');

      expect(result.key).toBe('test_key_with_spaces___');
    });

    it('should throw error for empty key', () => {
      expect(() => factory.create('')).toThrow(
        'Cache key must be a non-empty string',
      );
    });

    it('should throw error for null key', () => {
      expect(() => factory.create(null as any)).toThrow(
        'Cache key must be a non-empty string',
      );
    });
  });

  describe('createNamespace', () => {
    it('should create namespace cache key', () => {
      const result = factory.createNamespace('test-namespace', 'test-key');

      expect(result).toEqual({
        key: 'test-key',
        namespace: 'test-namespace',
        tags: [],
      });
    });

    it('should sanitize namespace', () => {
      const result = factory.createNamespace('Test Namespace!@#', 'test-key');

      expect(result.namespace).toBe('test_namespace___');
    });
  });

  describe('createTenant', () => {
    it('should create tenant cache key', () => {
      const result = factory.createTenant('tenant-123', 'test-key');

      expect(result).toEqual({
        key: 'test-key',
        tenantId: 'tenant-123',
        tags: [],
      });
    });

    it('should sanitize tenant ID', () => {
      const result = factory.createTenant('tenant 123!@#', 'test-key');

      expect(result.tenantId).toBe('tenant_123___');
    });
  });

  describe('createUser', () => {
    it('should create user cache key', () => {
      const result = factory.createUser('user-456', 'test-key');

      expect(result).toEqual({
        key: 'test-key',
        userId: 'user-456',
        tags: [],
      });
    });

    it('should sanitize user ID', () => {
      const result = factory.createUser('user 456!@#', 'test-key');

      expect(result.userId).toBe('user_456___');
    });
  });

  describe('createTagged', () => {
    it('should create tagged cache key', () => {
      const result = factory.createTagged('test-key', ['tag1', 'tag2']);

      expect(result).toEqual({
        key: 'test-key',
        tags: ['tag1', 'tag2'],
      });
    });

    it('should sanitize and deduplicate tags', () => {
      const result = factory.createTagged('test-key', [
        'tag1',
        'tag 1!@#',
        'tag1',
        'tag2',
      ]);

      expect(result.tags).toEqual(['tag1', 'tag_1___', 'tag2']);
    });

    it('should handle empty tags array', () => {
      const result = factory.createTagged('test-key', []);

      expect(result.tags).toEqual([]);
    });
  });

  describe('toString', () => {
    it('should convert basic cache key to string', () => {
      const cacheKey: CacheKey = {
        key: 'test-key',
        tags: [],
      };

      const result = factory.toString(cacheKey);

      expect(result).toBe('test-key');
    });

    it('should convert complex cache key to string', () => {
      const cacheKey: CacheKey = {
        key: 'test-key',
        namespace: 'test-namespace',
        version: 'v2',
        tenantId: 'tenant-123',
        userId: 'user-456',
        tags: ['tag1', 'tag2'],
      };

      const result = factory.toString(cacheKey);

      expect(result).toBe(
        'v2:test-namespace:tenant:tenant-123:user:user-456:tags:tag1,tag2:test-key',
      );
    });

    it('should handle cache key without version', () => {
      const cacheKey: CacheKey = {
        key: 'test-key',
        tags: [],
      };
      delete cacheKey.version;

      const result = factory.toString(cacheKey);

      expect(result).toBe('test-key');
    });

    it('should handle cache key with only namespace', () => {
      const cacheKey: CacheKey = {
        key: 'test-key',
        namespace: 'test-namespace',
        tags: [],
      };

      const result = factory.toString(cacheKey);

      expect(result).toBe('test-namespace:test-key');
    });
  });

  describe('parse', () => {
    it('should parse basic cache key string', () => {
      const keyString = 'test-key';
      const result = factory.parse(keyString);

      expect(result).toEqual({
        key: 'test-key',
        tags: [],
      });
    });

    it('should parse complex cache key string', () => {
      const keyString =
        'v2:test-namespace:tenant:tenant-123:user:user-456:tags:tag1,tag2:test-key';
      const result = factory.parse(keyString);

      expect(result).toEqual({
        key: 'test-key',
        namespace: 'test-namespace',
        version: 'v2',
        tenantId: 'tenant-123',
        userId: 'user-456',
        tags: ['tag1', 'tag2'],
      });
    });

    it('should parse cache key without version', () => {
      const keyString = 'test-key';
      const result = factory.parse(keyString);

      expect(result).toEqual({
        key: 'test-key',
        tags: [],
      });
    });

    it('should parse cache key with only namespace', () => {
      const keyString = 'test-namespace:test-key';
      const result = factory.parse(keyString);

      expect(result).toEqual({
        key: 'test-key',
        namespace: 'test-namespace',
        tags: [],
      });
    });
  });

  describe('createPattern', () => {
    it('should create pattern for wildcard matching', () => {
      const result = factory.createPattern('user:*:profile', {
        namespace: 'test-namespace',
        tenantId: 'tenant-123',
      });

      expect(result).toBe('v1:test-namespace:tenant:tenant-123:user:*:profile');
    });
  });

  describe('matchPattern', () => {
    it('should match exact pattern', () => {
      const cacheKey: CacheKey = {
        key: 'user-123-profile',
        namespace: 'test-namespace',
        tenantId: 'tenant-123',
        tags: [],
      };

      const pattern = 'test-namespace:tenant:tenant-123:user-123-profile';
      const result = factory.matchPattern(cacheKey, pattern);

      expect(result).toBe(true);
    });

    it('should match wildcard pattern', () => {
      const cacheKey: CacheKey = {
        key: 'user-123-profile',
        namespace: 'test-namespace',
        tenantId: 'tenant-123',
        tags: [],
      };

      const pattern = 'test-namespace:tenant:tenant-123:user-*-profile';
      const result = factory.matchPattern(cacheKey, pattern);

      expect(result).toBe(true);
    });

    it('should not match different pattern', () => {
      const cacheKey: CacheKey = {
        key: 'user-123-profile',
        namespace: 'test-namespace',
        tenantId: 'tenant-123',
        tags: [],
      };

      const pattern = 'test-namespace:tenant:tenant-123:user-456-profile';
      const result = factory.matchPattern(cacheKey, pattern);

      expect(result).toBe(false);
    });
  });

  describe('extract methods', () => {
    const cacheKey: CacheKey = {
      key: 'test-key',
      namespace: 'test-namespace',
      version: 'v2',
      tenantId: 'tenant-123',
      userId: 'user-456',
      tags: ['tag1', 'tag2'],
    };

    it('should extract namespace', () => {
      const result = factory.extractNamespace(cacheKey);
      expect(result).toBe('test-namespace');
    });

    it('should extract tenant ID', () => {
      const result = factory.extractTenantId(cacheKey);
      expect(result).toBe('tenant-123');
    });

    it('should extract user ID', () => {
      const result = factory.extractUserId(cacheKey);
      expect(result).toBe('user-456');
    });

    it('should extract tags', () => {
      const result = factory.extractTags(cacheKey);
      expect(result).toEqual(['tag1', 'tag2']);
    });
  });

  describe('edge cases', () => {
    it('should handle cache key with special characters in key', () => {
      const result = factory.create('test@key#with$special%chars');

      expect(result.key).toBe('test_key_with_special_chars');
    });

    it('should handle cache key with multiple spaces', () => {
      const result = factory.create('test   key   with   spaces');

      expect(result.key).toBe('test___key___with___spaces');
    });

    it('should handle empty tags array', () => {
      const result = factory.create('test-key', { tags: [] });

      expect(result.tags).toEqual([]);
    });

    it('should handle undefined tags', () => {
      const result = factory.create('test-key', { tags: undefined });

      expect(result.tags).toEqual([]);
    });
  });
});
