import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CacheManagerService,
  CacheManagerConfig,
  CacheLayerConfig,
} from './cache-manager.service';
import { ICacheService } from '../interfaces/cache.interface';
import { ICacheKeyFactory } from '../interfaces/cache.interface';
import {
  CacheStrategy,
  CacheType,
  CacheKey,
} from '../interfaces/cache.interface';
import { PinoLoggerService } from '@aiofix/logging';

/**
 * @class MockCacheService
 * @description 模拟缓存服务，用于测试
 */
class MockCacheService implements ICacheService {
  private cache = new Map<string, any>();
  private stats = {
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

  async get<T = any>(key: CacheKey): Promise<T | null> {
    const cacheKey = this.buildKey(key);
    const value = this.cache.get(cacheKey);
    if (value !== undefined) {
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return null;
  }

  async set<T = any>(key: CacheKey, value: T): Promise<boolean> {
    const cacheKey = this.buildKey(key);
    this.cache.set(cacheKey, value);
    this.stats.totalEntries = this.cache.size;
    return true;
  }

  async delete(key: CacheKey): Promise<boolean> {
    const cacheKey = this.buildKey(key);
    return this.cache.delete(cacheKey);
  }

  async exists(key: CacheKey): Promise<boolean> {
    const cacheKey = this.buildKey(key);
    return this.cache.has(cacheKey);
  }

  async clear(): Promise<boolean> {
    this.cache.clear();
    this.stats.totalEntries = 0;
    return true;
  }

  async getStats() {
    return { ...this.stats };
  }

  async getHealth() {
    return {
      healthy: true,
      connected: true,
      responseTime: 1,
      lastCheck: Date.now(),
    };
  }

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

  private buildKey(key: CacheKey): string {
    return `${key.namespace || 'default'}:${key.key}`;
  }
}

/**
 * @class MockCacheKeyFactory
 * @description 模拟缓存键工厂，用于测试
 */
class MockCacheKeyFactory implements ICacheKeyFactory {
  create(key: string, options?: Partial<CacheKey>): CacheKey {
    return {
      key,
      namespace: options?.namespace,
      version: options?.version,
      tenantId: options?.tenantId,
      userId: options?.userId,
      tags: options?.tags,
    };
  }

  createNamespace(
    namespace: string,
    key: string,
    options?: Partial<CacheKey>
  ): CacheKey {
    return this.create(key, { ...options, namespace });
  }

  createTenant(
    tenantId: string,
    key: string,
    options?: Partial<CacheKey>
  ): CacheKey {
    return this.create(key, { ...options, tenantId });
  }

  createUser(
    userId: string,
    key: string,
    options?: Partial<CacheKey>
  ): CacheKey {
    return this.create(key, { ...options, userId });
  }

  createTagged(
    key: string,
    tags: string[],
    options?: Partial<CacheKey>
  ): CacheKey {
    return this.create(key, { ...options, tags });
  }

  toString(key: CacheKey): string {
    return `${key.namespace || 'default'}:${key.key}`;
  }

  parse(keyString: string): CacheKey {
    const parts = keyString.split(':');
    return {
      key: parts[1] || parts[0],
      namespace: parts.length > 1 ? parts[0] : undefined,
    };
  }
}

describe('CacheManagerService', () => {
  let service: CacheManagerService;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;
  let mockLogger: jest.Mocked<PinoLoggerService>;
  let mockKeyFactory: MockCacheKeyFactory;
  let mockLayer1: MockCacheService;
  let mockLayer2: MockCacheService;

  const mockConfig: CacheManagerConfig = {
    enabled: true,
    defaultStrategy: CacheStrategy.LRU,
    monitoringInterval: 1000,
    cleanupInterval: 2000,
    maxSize: 1000,
    enableStats: true,
    enableEvents: true,
  };

  beforeEach(async () => {
    mockEventEmitter = {
      emit: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockKeyFactory = new MockCacheKeyFactory();
    mockLayer1 = new MockCacheService();
    mockLayer2 = new MockCacheService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheManagerService,
        {
          provide: 'CACHE_MANAGER_CONFIG',
          useValue: mockConfig,
        },
        {
          provide: 'ICacheKeyFactory',
          useValue: mockKeyFactory,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: PinoLoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<CacheManagerService>(CacheManagerService);
  });

  afterEach(() => {
    service.onDestroy();
  });

  describe('basic operations', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should add cache layer', () => {
      const layerConfig: CacheLayerConfig = {
        name: 'test-layer',
        priority: 1,
        service: mockLayer1,
        enabled: true,
      };

      const result = service.addLayer(layerConfig);
      expect(result).toBe(true);
      expect(service.getLayers()).toHaveLength(1);
    });

    it('should remove cache layer', () => {
      const layerConfig: CacheLayerConfig = {
        name: 'test-layer',
        priority: 1,
        service: mockLayer1,
        enabled: true,
      };

      service.addLayer(layerConfig);
      const result = service.removeLayer('test-layer');
      expect(result).toBe(true);
      expect(service.getLayers()).toHaveLength(0);
    });

    it('should enable/disable cache layer', () => {
      const layerConfig: CacheLayerConfig = {
        name: 'test-layer',
        priority: 1,
        service: mockLayer1,
        enabled: true,
      };

      service.addLayer(layerConfig);

      const disableResult = service.enableLayer('test-layer', false);
      expect(disableResult).toBe(true);

      const enableResult = service.enableLayer('test-layer', true);
      expect(enableResult).toBe(true);
    });
  });

  describe('cache operations', () => {
    beforeEach(() => {
      const layer1Config: CacheLayerConfig = {
        name: 'layer1',
        priority: 1,
        service: mockLayer1,
        enabled: true,
      };

      const layer2Config: CacheLayerConfig = {
        name: 'layer2',
        priority: 2,
        service: mockLayer2,
        enabled: true,
      };

      service.addLayer(layer1Config);
      service.addLayer(layer2Config);
    });

    it('should get value from cache', async () => {
      const key = mockKeyFactory.create('test-key', 'test-namespace');
      const value = { data: 'test-value' };

      await mockLayer1.set(key, value);
      const result = await service.get(key);

      expect(result).toEqual(value);
    });

    it('should return null for non-existent key', async () => {
      const key = mockKeyFactory.create('non-existent', 'test-namespace');
      const result = await service.get(key);

      expect(result).toBeNull();
    });

    it('should set value in all layers', async () => {
      const key = mockKeyFactory.create('test-key', 'test-namespace');
      const value = { data: 'test-value' };

      const result = await service.set(key, value);

      expect(result).toBe(true);
      expect(await mockLayer1.get(key)).toEqual(value);
      expect(await mockLayer2.get(key)).toEqual(value);
    });

    it('should delete value from all layers', async () => {
      const key = mockKeyFactory.create('test-key', 'test-namespace');
      const value = { data: 'test-value' };

      await service.set(key, value);
      const deleteResult = await service.delete(key);

      expect(deleteResult).toBe(true);
      expect(await mockLayer1.get(key)).toBeNull();
      expect(await mockLayer2.get(key)).toBeNull();
    });

    it('should check if key exists', async () => {
      const key = mockKeyFactory.create('test-key', 'test-namespace');
      const value = { data: 'test-value' };

      await service.set(key, value);
      const exists = await service.exists(key);

      expect(exists).toBe(true);
    });

    it('should clear all layers', async () => {
      const key = mockKeyFactory.create('test-key', 'test-namespace');
      const value = { data: 'test-value' };

      await service.set(key, value);
      const clearResult = await service.clear();

      expect(clearResult).toBe(true);
      expect(await mockLayer1.get(key)).toBeNull();
      expect(await mockLayer2.get(key)).toBeNull();
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      const layerConfig: CacheLayerConfig = {
        name: 'test-layer',
        priority: 1,
        service: mockLayer1,
        enabled: true,
      };

      service.addLayer(layerConfig);
    });

    it('should get cache stats', async () => {
      const stats = await service.getStats();

      expect(stats).toBeDefined();
      expect(stats.hits).toBeDefined();
      expect(stats.misses).toBeDefined();
      expect(stats.hitRate).toBeDefined();
    });

    it('should reset cache stats', async () => {
      const key = mockKeyFactory.create('test-key', 'test-namespace');
      const value = { data: 'test-value' };

      await service.set(key, value);
      await service.get(key);

      await service.resetStats();

      const stats = await service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('health check', () => {
    beforeEach(() => {
      const layerConfig: CacheLayerConfig = {
        name: 'test-layer',
        priority: 1,
        service: mockLayer1,
        enabled: true,
      };

      service.addLayer(layerConfig);
    });

    it('should get cache health', async () => {
      const health = await service.getHealth();

      expect(health).toBeDefined();
      expect(health.healthy).toBeDefined();
      expect(health.connected).toBeDefined();
      expect(health.responseTime).toBeDefined();
    });
  });

  describe('layer management', () => {
    it('should handle read-only layers', async () => {
      const readOnlyLayer: CacheLayerConfig = {
        name: 'readonly-layer',
        priority: 1,
        service: mockLayer1,
        enabled: true,
        readOnly: true,
      };

      service.addLayer(readOnlyLayer);

      const key = mockKeyFactory.create('test-key', 'test-namespace');
      const value = { data: 'test-value' };

      // 只读层不应该被写入
      const setResult = await service.set(key, value);
      expect(setResult).toBe(false);
    });

    it('should handle disabled layers', async () => {
      const disabledLayer: CacheLayerConfig = {
        name: 'disabled-layer',
        priority: 1,
        service: mockLayer1,
        enabled: false,
      };

      service.addLayer(disabledLayer);

      const key = mockKeyFactory.create('test-key', 'test-namespace');
      const value = { data: 'test-value' };

      // 禁用的层不应该被访问
      const getResult = await service.get(key);
      expect(getResult).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle layer errors gracefully', async () => {
      const errorLayer = {
        name: 'error-layer',
        priority: 1,
        service: {
          get: jest.fn().mockRejectedValue(new Error('Layer error')),
          set: jest.fn().mockRejectedValue(new Error('Layer error')),
          delete: jest.fn().mockRejectedValue(new Error('Layer error')),
          exists: jest.fn().mockRejectedValue(new Error('Layer error')),
          clear: jest.fn().mockRejectedValue(new Error('Layer error')),
          getStats: jest.fn().mockRejectedValue(new Error('Layer error')),
          getHealth: jest.fn().mockRejectedValue(new Error('Layer error')),
          resetStats: jest.fn().mockRejectedValue(new Error('Layer error')),
        },
        enabled: true,
      } as any;

      service.addLayer(errorLayer);

      const key = mockKeyFactory.create('test-key', 'test-namespace');
      const value = { data: 'test-value' };

      // 应该处理错误而不抛出异常
      const getResult = await service.get(key);
      expect(getResult).toBeNull();

      const setResult = await service.set(key, value);
      expect(setResult).toBe(false);
    });
  });

  describe('event emission', () => {
    beforeEach(() => {
      const layerConfig: CacheLayerConfig = {
        name: 'test-layer',
        priority: 1,
        service: mockLayer1,
        enabled: true,
      };

      service.addLayer(layerConfig);
    });

    it('should emit cache events', async () => {
      const key = mockKeyFactory.create('test-key', 'test-namespace');
      const value = { data: 'test-value' };

      await service.set(key, value);
      await service.get(key);

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cache.cache_set',
        expect.objectContaining({
          type: 'cache_set',
          data: expect.objectContaining({ key, value }),
        })
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'cache.cache_hit',
        expect.objectContaining({
          type: 'cache_hit',
          data: expect.objectContaining({ key, value }),
        })
      );
    });
  });
});
