/**
 * @fileoverview
 * Aiofix IAM Platform Cache Module
 *
 * @description
 * 提供高性能的缓存服务，支持多级缓存（内存+Redis）、分布式缓存、
 * 缓存策略管理、AOP缓存等功能。该模块可独立使用，适用于微服务架构。
 *
 * 主要功能：
 * 1. 多级缓存架构（L1内存缓存，L2 Redis缓存）
 * 2. 分布式缓存和集群支持
 * 3. 多种缓存策略（LRU、LFU、FIFO、TTL）
 * 4. AOP缓存装饰器和拦截器
 * 5. 缓存预热和失效管理
 * 6. 缓存统计和性能监控
 * 7. 多租户缓存隔离
 *
 * 使用示例：
 * ```typescript
 * import { CacheModule, RedisCacheService } from '@aiofix/cache';
 *
 * @Module({
 *   imports: [CacheModule.forRoot()],
 *   providers: [MyService],
 * })
 * export class AppModule {}
 *
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly cache: RedisCacheService) {}
 *
 *   @Cacheable('user:profile', 3600000) // 缓存1小时
 *   async getUserProfile(userId: string) {
 *     return this.cache.get(`user:profile:${userId}`);
 *   }
 * }
 * ```
 */

// 导出模块
export { CacheModule } from './cache.module';

// 导出服务
export { RedisCacheService } from './services/redis-cache.service';
export { MemoryCacheService } from './services/memory-cache.service';
export { CacheManagerService } from './services/cache-manager.service';
export { CacheInvalidationService } from './services/cache-invalidation.service';
export { CacheWarmupService } from './services/cache-warmup.service';

// 导出工厂
export { CacheKeyFactory } from './factories/cache-key.factory';

// 导出装饰器
export {
  CacheKey as CacheKeyDecorator,
  CacheTTL,
  CacheOptions as CacheOptionsDecorator,
  CacheEvict,
  CacheEvictAll,
  Cacheable,
  CacheEvictable,
  CacheKeyPattern,
  CacheKeyFromArgs,
  CacheKeyFromMethod,
  CacheCondition,
  CacheUnless,
  CacheSync,
} from './decorators/cache.decorator';

// 导出拦截器
export {
  CacheInterceptor,
  CacheGetInterceptor,
  CacheSetInterceptor,
} from './interceptors/cache.interceptor';

// 导出接口和类型
export * from './interfaces/cache.interface';

// 导出配置
export * from './config/cache.config';

// 导出预热服务相关类型
export type {
  WarmupItem,
  WarmupResult,
  WarmupStats,
  CacheWarmupConfig,
} from './services/cache-warmup.service';

// 导出拦截器相关类型
export type { CacheInterceptorOptions } from './interceptors/cache.interceptor';
