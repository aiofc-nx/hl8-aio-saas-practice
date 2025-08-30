/**
 * @file redis-cache.service.spec.ts
 * @description Redis缓存服务单元测试
 *
 * 该文件包含RedisCacheService的完整单元测试，包括：
 * - 基础的CRUD操作测试
 * - 缓存统计和健康检查测试
 * - 连接管理和错误处理测试
 * - 边界情况和异常情况测试
 */

import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { RedisCacheService, RedisConfig } from './redis-cache.service';
import { CacheKeyFactory } from '../factories/cache-key.factory';
import { CacheType, CacheStrategy } from '../interfaces/cache.interface';
import { PinoLoggerService } from '@aiofix/logging';

// Mock ioredis
jest.mock('ioredis');

describe('RedisCacheService', () => {
  let service: RedisCacheService;
  let mockRedis: jest.Mocked<Redis>;
  let keyFactory: CacheKeyFactory;

  const mockConfig: RedisConfig = {
    host: 'localhost',
    port: 6379,
    password: 'test-password',
    db: 0,
    connectTimeout: 10000,
    commandTimeout: 5000,
    retries: 3,
    retryDelay: 100,
  };

  beforeEach(async () => {
    // 创建模拟的Redis实例
    mockRedis = {
      ping: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      keys: jest.fn(),
      flushdb: jest.fn(),
      info: jest.fn(),
      quit: jest.fn(),
      on: jest.fn(),
    } as any;

    // 模拟Redis构造函数
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(
      () => mockRedis
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: 'REDIS_CONFIG',
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
        CacheKeyFactory,
        RedisCacheService,
      ],
    }).compile();

    service = module.get<RedisCacheService>(RedisCacheService);
    keyFactory = module.get<CacheKeyFactory>(CacheKeyFactory);

    // 设置默认的mock返回值
    mockRedis.ping.mockResolvedValue('PONG');
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.setex.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(1);
    mockRedis.keys.mockResolvedValue([]);
    mockRedis.flushdb.mockResolvedValue('OK');
    mockRedis.info.mockResolvedValue(
      'redis_version:6.0.0\r\nconnected_clients:1\r\nused_memory:1000000\r\n'
    );
    mockRedis.quit.mockResolvedValue('OK');
    mockRedis.on.mockImplementation((event, callback) => {
      if (event === 'connect' || event === 'ready') {
        callback();
      }
      return mockRedis;
    });

    // 手动设置Redis实例，避免连接失败
    (service as any).redis = mockRedis;
    (service as any).isConnected = true;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should connect to Redis successfully', async () => {
      await service.onModuleInit();

      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: 'test-password',
        db: 0,
        connectTimeout: 10000,
        commandTimeout: 5000,
        maxRetriesPerRequest: 3,
      });
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it('should handle connection error', async () => {
      const error = new Error('Connection failed');
      mockRedis.ping.mockRejectedValue(error);

      await expect(service.onModuleInit()).rejects.toThrow('Connection failed');
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from Redis', async () => {
      await service.onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('should get cache value successfully', async () => {
      const key = keyFactory.create('test-key');
      const cacheValue = {
        value: { data: 'test-data' },
        createdAt: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now(),
        version: 'v1',
        tags: ['test'],
        metadata: {
          type: CacheType.REDIS,
          strategy: CacheStrategy.TTL,
        },
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cacheValue));
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.get(key);

      expect(result).toEqual({ data: 'test-data' });
      expect(mockRedis.get).toHaveBeenCalledWith(keyFactory.toString(key));
      expect(mockRedis.set).toHaveBeenCalledWith(
        keyFactory.toString(key),
        expect.stringContaining('"accessCount":1')
      );
    });

    it('should return null for non-existent key', async () => {
      const key = keyFactory.create('non-existent-key');
      mockRedis.get.mockResolvedValue(null);

      const result = await service.get(key);

      expect(result).toBeNull();
    });

    it('should return null for expired cache', async () => {
      const key = keyFactory.create('expired-key');
      const expiredValue = {
        value: { data: 'expired-data' },
        createdAt: Date.now() - 2000,
        expiresAt: Date.now() - 1000, // 已过期
        accessCount: 0,
        lastAccessed: Date.now() - 2000,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(expiredValue));
      mockRedis.del.mockResolvedValue(1);

      const result = await service.get(key);

      expect(result).toBeNull();
      expect(mockRedis.del).toHaveBeenCalledWith(keyFactory.toString(key));
    });

    it('should handle Redis error', async () => {
      const key = keyFactory.create('error-key');
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await service.get(key);

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should set cache value successfully', async () => {
      const key = keyFactory.create('test-key');
      const value = { data: 'test-data' };
      const options = { ttl: 60000, strategy: CacheStrategy.TTL };

      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.set(key, value, options);

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        keyFactory.toString(key),
        60, // TTL in seconds
        expect.stringContaining('"data":"test-data"')
      );
    });

    it('should set cache value without TTL', async () => {
      const key = keyFactory.create('test-key');
      const value = { data: 'test-data' };

      mockRedis.set.mockResolvedValue('OK');

      const result = await service.set(key, value);

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        keyFactory.toString(key),
        expect.stringContaining('"data":"test-data"')
      );
    });

    it('should handle Redis error', async () => {
      const key = keyFactory.create('error-key');
      const value = { data: 'test-data' };

      mockRedis.set.mockRejectedValue(new Error('Redis error'));

      const result = await service.set(key, value);

      expect(result).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete cache value successfully', async () => {
      const key = keyFactory.create('test-key');
      mockRedis.del.mockResolvedValue(1);

      const result = await service.delete(key);

      expect(result).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith(keyFactory.toString(key));
    });

    it('should return false for non-existent key', async () => {
      const key = keyFactory.create('non-existent-key');
      mockRedis.del.mockResolvedValue(0);

      const result = await service.delete(key);

      expect(result).toBe(false);
    });

    it('should handle Redis error', async () => {
      const key = keyFactory.create('error-key');
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      const result = await service.delete(key);

      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      const key = keyFactory.create('existing-key');
      mockRedis.exists.mockResolvedValue(1);

      const result = await service.exists(key);

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith(keyFactory.toString(key));
    });

    it('should return false for non-existing key', async () => {
      const key = keyFactory.create('non-existing-key');
      mockRedis.exists.mockResolvedValue(0);

      const result = await service.exists(key);

      expect(result).toBe(false);
    });

    it('should handle Redis error', async () => {
      const key = keyFactory.create('error-key');
      mockRedis.exists.mockRejectedValue(new Error('Redis error'));

      const result = await service.exists(key);

      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all cache', async () => {
      mockRedis.flushdb.mockResolvedValue('OK');

      const result = await service.clear();

      expect(result).toBe(true);
      expect(mockRedis.flushdb).toHaveBeenCalled();
    });

    it('should clear cache by namespace', async () => {
      const namespace = 'test-namespace';
      const keys = ['test-namespace:key1', 'test-namespace:key2'];

      mockRedis.keys.mockResolvedValue(keys);
      mockRedis.del.mockResolvedValue(2);

      const result = await service.clear(namespace);

      expect(result).toBe(true);
      expect(mockRedis.keys).toHaveBeenCalledWith(`${namespace}:*`);
      expect(mockRedis.del).toHaveBeenCalledWith(...keys);
    });

    it('should handle Redis error', async () => {
      mockRedis.flushdb.mockRejectedValue(new Error('Redis error'));

      const result = await service.clear();

      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const redisInfo = `
# Keyspace
db0:keys=100,expires=10,avg_ttl=3600000
      `.trim();

      mockRedis.info.mockResolvedValue(redisInfo);

      const stats = await service.getStats();

      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(mockRedis.info).toHaveBeenCalled();
    });

    it('should handle Redis error', async () => {
      mockRedis.info.mockRejectedValue(new Error('Redis error'));

      const stats = await service.getStats();

      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
    });
  });

  describe('getHealth', () => {
    it('should return healthy status', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const health = await service.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.connected).toBe(true);
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
      expect(health.lastCheck).toBeGreaterThan(0);
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it('should return unhealthy status on error', async () => {
      const error = new Error('Connection failed');
      mockRedis.ping.mockRejectedValue(error);

      const health = await service.getHealth();

      expect(health.healthy).toBe(false);
      expect(health.connected).toBe(false);
      expect(health.error).toBe('Connection failed');
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('resetStats', () => {
    it('should reset cache statistics', async () => {
      await service.resetStats();

      const stats = await service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.totalEntries).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.averageSize).toBe(0);
    });
  });
});
