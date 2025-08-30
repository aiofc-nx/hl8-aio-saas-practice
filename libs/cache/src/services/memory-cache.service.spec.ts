import { Test, TestingModule } from '@nestjs/testing';
import { MemoryCacheService, MemoryCacheConfig } from './memory-cache.service';
import { CacheKeyFactory } from '../factories/cache-key.factory';
import { CacheStrategy } from '../interfaces/cache.interface';
import { PinoLoggerService } from '@aiofix/logging';

describe('MemoryCacheService', () => {
  let service: MemoryCacheService;
  let keyFactory: CacheKeyFactory;

  const mockConfig: MemoryCacheConfig = {
    defaultTtl: 300000, // 5分钟
    maxSize: 100,
    defaultStrategy: CacheStrategy.LRU,
    cleanupInterval: 60000, // 1分钟
    enableCompression: false,
    enableEncryption: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryCacheService,
        {
          provide: 'MEMORY_CACHE_CONFIG',
          useValue: mockConfig,
        },
        {
          provide: 'ICacheKeyFactory',
          useClass: CacheKeyFactory,
        },
        {
          provide: PinoLoggerService,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            trace: jest.fn(),
            fatal: jest.fn(),
            child: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MemoryCacheService>(MemoryCacheService);
    keyFactory = module.get<CacheKeyFactory>('ICacheKeyFactory');
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('basic operations', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should set and get cache value', async () => {
      const key = keyFactory.create('test-key');
      const value = { data: 'test-value' };

      const setResult = await service.set(key, value);
      expect(setResult).toBe(true);

      const retrieved = await service.get(key);
      expect(retrieved).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const key = keyFactory.create('non-existent');
      const result = await service.get(key);
      expect(result).toBeNull();
    });

    it('should delete cache value', async () => {
      const key = keyFactory.create('test-key');
      const value = { data: 'test-value' };

      await service.set(key, value);
      const deleteResult = await service.delete(key);
      expect(deleteResult).toBe(true);

      const retrieved = await service.get(key);
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent key', async () => {
      const key = keyFactory.create('non-existent');
      const result = await service.delete(key);
      expect(result).toBe(false);
    });

    it('should check if key exists', async () => {
      const key = keyFactory.create('test-key');
      const value = { data: 'test-value' };

      expect(await service.exists(key)).toBe(false);

      await service.set(key, value);
      expect(await service.exists(key)).toBe(true);

      await service.delete(key);
      expect(await service.exists(key)).toBe(false);
    });

    it('should clear all cache', async () => {
      const key1 = keyFactory.create('key1');
      const key2 = keyFactory.create('key2');

      await service.set(key1, 'value1');
      await service.set(key2, 'value2');

      const clearResult = await service.clear();
      expect(clearResult).toBe(true);

      expect(await service.get(key1)).toBeNull();
      expect(await service.get(key2)).toBeNull();
    });

    it('should clear cache by namespace', async () => {
      const key1 = keyFactory.createNamespace('ns1', 'key1');
      const key2 = keyFactory.createNamespace('ns2', 'key2');

      await service.set(key1, 'value1');
      await service.set(key2, 'value2');

      const clearResult = await service.clear('ns1');
      expect(clearResult).toBe(true);

      expect(await service.get(key1)).toBeNull();
      expect(await service.get(key2)).toEqual('value2');
    });
  });

  describe('TTL and expiration', () => {
    it('should respect TTL setting', async () => {
      const key = keyFactory.create('test-key');
      const value = { data: 'test-value' };

      await service.set(key, value, { ttl: 100 }); // 100ms TTL

      // 立即获取应该成功
      expect(await service.get(key)).toEqual(value);

      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 过期后应该返回null
      expect(await service.get(key)).toBeNull();
    });

    it('should handle zero TTL (no expiration)', async () => {
      const key = keyFactory.create('test-key');
      const value = { data: 'test-value' };

      await service.set(key, value, { ttl: 0 });

      // 等待一段时间后仍然应该能获取到
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(await service.get(key)).toEqual(value);
    });

    it('should clean up expired entries automatically', async () => {
      const key = keyFactory.create('test-key');
      const value = { data: 'test-value' };

      await service.set(key, value, { ttl: 50 }); // 50ms TTL

      // 等待过期
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 手动触发清理（通过访问来触发过期检查）
      await service.get(key);

      // 检查统计信息
      const stats = await service.getStats();
      expect(stats.expiredEntries).toBeGreaterThan(0);
    });
  });

  describe('cache strategies', () => {
    it('should use LRU strategy for eviction', async () => {
      // 设置最大大小为2
      const config: MemoryCacheConfig = { ...mockConfig, maxSize: 2 };
      const module = await Test.createTestingModule({
        providers: [
          MemoryCacheService,
          { provide: 'MEMORY_CACHE_CONFIG', useValue: config },
          { provide: 'ICacheKeyFactory', useClass: CacheKeyFactory },
          {
            provide: PinoLoggerService,
            useValue: {
              info: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
              warn: jest.fn(),
              trace: jest.fn(),
              fatal: jest.fn(),
              child: jest.fn(),
            },
          },
        ],
      }).compile();
      const lruService = module.get<MemoryCacheService>(MemoryCacheService);

      const key1 = keyFactory.create('key1');
      const key2 = keyFactory.create('key2');
      const key3 = keyFactory.create('key3');

      // 添加3个键，应该驱逐第一个
      await lruService.set(key1, 'value1');
      await lruService.set(key2, 'value2');
      await lruService.set(key3, 'value3');

      // key1应该被驱逐
      expect(await lruService.get(key1)).toBeNull();
      expect(await lruService.get(key2)).toEqual('value2');
      expect(await lruService.get(key3)).toEqual('value3');

      await lruService.onModuleDestroy();
    });

    it('should use LFU strategy for eviction', async () => {
      const config: MemoryCacheConfig = {
        ...mockConfig,
        maxSize: 2,
        defaultStrategy: CacheStrategy.LFU,
      };
      const module = await Test.createTestingModule({
        providers: [
          MemoryCacheService,
          { provide: 'MEMORY_CACHE_CONFIG', useValue: config },
          { provide: 'ICacheKeyFactory', useClass: CacheKeyFactory },
          {
            provide: PinoLoggerService,
            useValue: {
              info: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
              warn: jest.fn(),
              trace: jest.fn(),
              fatal: jest.fn(),
              child: jest.fn(),
            },
          },
        ],
      }).compile();
      const lfuService = module.get<MemoryCacheService>(MemoryCacheService);

      const key1 = keyFactory.create('key1');
      const key2 = keyFactory.create('key2');
      const key3 = keyFactory.create('key3');

      // 添加2个键
      await lfuService.set(key1, 'value1');
      await lfuService.set(key2, 'value2');

      // 访问key1多次，key2一次
      await lfuService.get(key1);
      await lfuService.get(key1);
      await lfuService.get(key2);

      // 添加第3个键，应该驱逐key2（访问频率最低）
      await lfuService.set(key3, 'value3');

      // key1和key3应该存在，key2被驱逐
      expect(await lfuService.get(key1)).toEqual('value1');
      expect(await lfuService.get(key2)).toBeNull();
      expect(await lfuService.get(key3)).toEqual('value3');

      await lfuService.onModuleDestroy();
    });

    it('should use FIFO strategy for eviction', async () => {
      const config: MemoryCacheConfig = {
        ...mockConfig,
        maxSize: 2,
        defaultStrategy: CacheStrategy.FIFO,
      };
      const module = await Test.createTestingModule({
        providers: [
          MemoryCacheService,
          { provide: 'MEMORY_CACHE_CONFIG', useValue: config },
          { provide: 'ICacheKeyFactory', useClass: CacheKeyFactory },
          {
            provide: PinoLoggerService,
            useValue: {
              info: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
              warn: jest.fn(),
              trace: jest.fn(),
              fatal: jest.fn(),
              child: jest.fn(),
            },
          },
        ],
      }).compile();
      const fifoService = module.get<MemoryCacheService>(MemoryCacheService);

      const key1 = keyFactory.create('key1');
      const key2 = keyFactory.create('key2');
      const key3 = keyFactory.create('key3');

      // 按顺序添加3个键
      await fifoService.set(key1, 'value1');
      await fifoService.set(key2, 'value2');
      await fifoService.set(key3, 'value3');

      // key1应该被驱逐（最早添加）
      expect(await fifoService.get(key1)).toBeNull();
      expect(await fifoService.get(key2)).toEqual('value2');
      expect(await fifoService.get(key3)).toEqual('value3');

      await fifoService.onModuleDestroy();
    });
  });

  describe('statistics', () => {
    it('should track cache statistics', async () => {
      const key1 = keyFactory.create('key1');
      const key2 = keyFactory.create('key2');

      // 初始统计
      let stats = await service.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);

      // 设置缓存
      await service.set(key1, 'value1');
      await service.set(key2, 'value2');

      stats = await service.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.averageSize).toBeGreaterThan(0);

      // 命中
      await service.get(key1);
      await service.get(key1);

      // 未命中
      await service.get(keyFactory.create('non-existent'));

      stats = await service.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(2 / 3);
    });

    it('should reset statistics', async () => {
      const key = keyFactory.create('test-key');
      await service.set(key, 'value');
      await service.get(key);

      await service.resetStats();

      const stats = await service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.lastReset).toBeGreaterThan(0);
    });
  });

  describe('health check', () => {
    it('should return healthy status', async () => {
      const health = await service.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.connected).toBe(true);
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
      expect(health.lastCheck).toBeGreaterThan(0);
      expect(health.error).toBeUndefined();
    });

    it('should handle health check errors', async () => {
      // 模拟错误情况（通过破坏keyFactory的create方法）
      const module = await Test.createTestingModule({
        providers: [
          MemoryCacheService,
          { provide: 'MEMORY_CACHE_CONFIG', useValue: mockConfig },
          {
            provide: 'ICacheKeyFactory',
            useValue: {
              create: () => {
                throw new Error('Mock error');
              },
              toString: () => 'test',
              parse: () => ({ key: 'test' }),
            },
          },
          {
            provide: PinoLoggerService,
            useValue: {
              info: jest.fn(),
              error: jest.fn(),
              debug: jest.fn(),
              warn: jest.fn(),
              trace: jest.fn(),
              fatal: jest.fn(),
              child: jest.fn(),
            },
          },
        ],
      }).compile();
      const errorService = module.get<MemoryCacheService>(MemoryCacheService);

      const health = await errorService.getHealth();
      expect(health.healthy).toBe(false);
      expect(health.connected).toBe(false);
      expect(health.error).toBeDefined();

      await errorService.onModuleDestroy();
    });
  });

  describe('complex data types', () => {
    it('should handle complex objects', async () => {
      const key = keyFactory.create('complex-key');
      const value = {
        user: {
          id: '123',
          name: 'John Doe',
          email: 'john@example.com',
          roles: ['admin', 'user'],
        },
        metadata: {
          createdAt: new Date(),
          version: '1.0.0',
        },
      };

      await service.set(key, value);
      const retrieved = await service.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should handle arrays', async () => {
      const key = keyFactory.create('array-key');
      const value = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' },
      ];

      await service.set(key, value);
      const retrieved = await service.get(key);

      expect(retrieved).toEqual(value);
    });

    it('should handle primitive values', async () => {
      const stringKey = keyFactory.create('string-key');
      const numberKey = keyFactory.create('number-key');
      const booleanKey = keyFactory.create('boolean-key');

      await service.set(stringKey, 'test string');
      await service.set(numberKey, 42);
      await service.set(booleanKey, true);

      expect(await service.get(stringKey)).toBe('test string');
      expect(await service.get(numberKey)).toBe(42);
      expect(await service.get(booleanKey)).toBe(true);
    });
  });

  describe('concurrent access', () => {
    it('should handle concurrent set operations', async () => {
      const promises: Promise<boolean>[] = [];
      const keyPrefix = 'concurrent-key';

      for (let i = 0; i < 10; i++) {
        const key = keyFactory.create(`${keyPrefix}-${i}`);
        promises.push(service.set(key, `value-${i}`));
      }

      await Promise.all(promises);

      // 验证所有值都被正确设置
      for (let i = 0; i < 10; i++) {
        const key = keyFactory.create(`${keyPrefix}-${i}`);
        expect(await service.get(key)).toBe(`value-${i}`);
      }
    });

    it('should handle concurrent get operations', async () => {
      const key = keyFactory.create('concurrent-get-key');
      await service.set(key, 'test-value');

      const promises: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(service.get(key));
      }

      const results = await Promise.all(promises);
      results.forEach((result) => {
        expect(result).toBe('test-value');
      });
    });
  });

  describe('module lifecycle', () => {
    it('should clean up resources on destroy', async () => {
      const key = keyFactory.create('lifecycle-key');
      await service.set(key, 'test-value');

      // 验证缓存中有数据
      expect(await service.get(key)).toBe('test-value');

      // 销毁模块
      await service.onModuleDestroy();

      // 验证缓存被清空
      expect(await service.get(key)).toBeNull();
    });
  });
});
