/**
 * @file cache.interceptor.ts
 * @description 缓存拦截器
 *
 * 该文件实现了基于AOP的缓存拦截器，包括：
 * - 缓存获取拦截器
 * - 缓存设置拦截器
 * - 缓存失效拦截器
 * - 缓存条件拦截器
 *
 * 提供声明式的缓存管理，简化缓存使用。
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Type,
  mixin,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import type { ICacheService } from '../interfaces/cache.interface';
import type { ICacheKeyFactory } from '../interfaces/cache.interface';
import type { CacheKey, CacheOptions } from '../interfaces/cache.interface';
import {
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
  CACHE_OPTIONS_METADATA,
  CACHE_EVICT_METADATA,
  CACHE_EVICT_ALL_METADATA,
} from '../decorators/cache.decorator';
import { PinoLoggerService, LogContext } from '@aiofix/logging';

/**
 * @interface CacheInterceptorOptions
 * @description 缓存拦截器选项
 */
export interface CacheInterceptorOptions {
  /** 缓存服务 */
  cacheService?: ICacheService;
  /** 缓存键工厂 */
  keyFactory?: ICacheKeyFactory;
  /** 是否启用缓存 */
  enabled?: boolean;
  /** 默认TTL */
  defaultTtl?: number;
  /** 是否记录缓存操作 */
  logCacheOperations?: boolean;
}

/**
 * @class CacheInterceptor
 * @description 缓存拦截器基类
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger: PinoLoggerService;

  constructor(
    @Inject('ICacheService') private readonly cacheService: ICacheService,
    @Inject('ICacheKeyFactory') private readonly keyFactory: ICacheKeyFactory,
    private readonly reflector: Reflector,
    logger: PinoLoggerService,
    @Inject('CACHE_INTERCEPTOR_OPTIONS')
    private readonly options: CacheInterceptorOptions = {}
  ) {
    this.logger = logger;
  }

  /**
   * @method intercept
   * @description 拦截方法执行
   * @param context 执行上下文
   * @param next 下一个处理器
   * @returns Observable
   */
  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    const handler = context.getHandler();

    // 检查是否启用缓存
    if (this.options.enabled === false) {
      return next.handle();
    }

    // 获取缓存元数据
    const cacheKey = this.reflector.get<string | ((args: unknown[]) => string)>(
      CACHE_KEY_METADATA,
      handler
    );
    const cacheTtl = this.reflector.get<number>(CACHE_TTL_METADATA, handler);
    const cacheOptions = this.reflector.get<Partial<CacheOptions>>(
      CACHE_OPTIONS_METADATA,
      handler
    );
    const cacheEvict = this.reflector.get<
      string | string[] | ((args: unknown[]) => string | string[])
    >(CACHE_EVICT_METADATA, handler);
    const cacheEvictAll = this.reflector.get<string>(
      CACHE_EVICT_ALL_METADATA,
      handler
    );

    // 如果没有缓存配置，直接执行
    if (!cacheKey && !cacheEvict && !cacheEvictAll) {
      return next.handle();
    }

    const args = this.getArguments(context);

    // 处理缓存失效
    if (cacheEvict || cacheEvictAll) {
      return this.handleCacheEviction(next, args, cacheEvict, cacheEvictAll);
    }

    // 处理缓存获取和设置
    if (cacheKey) {
      return this.handleCacheGetSet(
        next,
        args,
        cacheKey,
        cacheTtl,
        cacheOptions
      );
    }

    return next.handle();
  }

  /**
   * @private
   * @method getArguments
   * @description 获取方法参数
   * @param context 执行上下文
   * @returns 参数数组
   */
  private getArguments(context: ExecutionContext): any[] {
    const request = context.switchToHttp().getRequest();
    return [
      ...(request.params ? Object.values(request.params) : []),
      ...(request.query ? Object.values(request.query) : []),
      ...(request.body ? [request.body] : []),
    ];
  }

  /**
   * @private
   * @method generateCacheKey
   * @description 生成缓存键
   * @param cacheKey 缓存键配置
   * @param args 参数数组
   * @returns 缓存键
   */
  private generateCacheKey(
    cacheKey: string | ((args: unknown[]) => string),
    args: unknown[]
  ): CacheKey {
    const keyString =
      typeof cacheKey === 'function' ? cacheKey(args) : cacheKey;
    return this.keyFactory.create(keyString);
  }

  /**
   * @private
   * @method handleCacheGetSet
   * @description 处理缓存获取和设置
   * @param next 下一个处理器
   * @param args 参数数组
   * @param cacheKey 缓存键
   * @param cacheTtl TTL
   * @param cacheOptions 缓存选项
   * @returns Observable
   */
  private async handleCacheGetSet(
    next: CallHandler,
    args: unknown[],
    cacheKey: string | ((args: unknown[]) => string),
    cacheTtl?: number,
    cacheOptions?: Partial<CacheOptions>
  ): Promise<Observable<any>> {
    const key = this.generateCacheKey(cacheKey, args);
    const ttl = cacheTtl || this.options.defaultTtl;

    try {
      // 尝试从缓存获取
      const cached = await this.cacheService.get(key);
      if (cached !== null) {
        if (this.options.logCacheOperations) {
          this.logger.debug(`Cache hit: ${key.key}`, LogContext.CACHE);
        }
        return of(cached);
      }

      if (this.options.logCacheOperations) {
        this.logger.debug(`Cache miss: ${key.key}`, LogContext.CACHE);
      }

      // 执行原始方法并缓存结果
      return next.handle().pipe(
        tap(async (data) => {
          if (data !== null && data !== undefined) {
            try {
              await this.cacheService.set(key, data, {
                ttl,
                ...cacheOptions,
              });
              if (this.options.logCacheOperations) {
                this.logger.debug(`Cache set: ${key.key}`, LogContext.CACHE);
              }
            } catch (error) {
              this.logger.error(
                `Failed to set cache: ${key.key}`,
                LogContext.CACHE,
                undefined,
                error as Error
              );
            }
          }
        })
      );
    } catch (error) {
      this.logger.error(
        `Cache operation failed: ${key.key}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return next.handle();
    }
  }

  /**
   * @private
   * @method handleCacheEviction
   * @description 处理缓存失效
   * @param next 下一个处理器
   * @param args 参数数组
   * @param cacheEvict 失效键
   * @param cacheEvictAll 全部失效命名空间
   * @returns Observable
   */
  private async handleCacheEviction(
    next: CallHandler,
    args: unknown[],
    cacheEvict?: string | string[] | ((args: unknown[]) => string | string[]),
    cacheEvictAll?: string
  ): Promise<Observable<any>> {
    return next.handle().pipe(
      tap(async (data) => {
        try {
          // 处理全部失效
          if (cacheEvictAll) {
            await this.cacheService.clear(cacheEvictAll);
            if (this.options.logCacheOperations) {
              this.logger.debug(
                `Cache cleared: namespace ${cacheEvictAll}`,
                LogContext.CACHE
              );
            }
          }

          // 处理键失效
          if (cacheEvict) {
            const keysToEvict =
              typeof cacheEvict === 'function' ? cacheEvict(args) : cacheEvict;

            const keys = Array.isArray(keysToEvict)
              ? keysToEvict
              : [keysToEvict];

            for (const keyString of keys) {
              const key = this.keyFactory.create(keyString);
              await this.cacheService.delete(key);
              if (this.options.logCacheOperations) {
                this.logger.debug(
                  `Cache evicted: ${keyString}`,
                  LogContext.CACHE
                );
              }
            }
          }
        } catch (error) {
          this.logger.error(
            'Cache eviction failed',
            LogContext.CACHE,
            undefined,
            error as Error
          );
        }
      })
    );
  }
}

/**
 * @function createCacheInterceptor
 * @description 创建缓存拦截器工厂函数
 * @param options 拦截器选项
 * @returns 拦截器类
 */
export function createCacheInterceptor(
  options: CacheInterceptorOptions = {}
): Type<NestInterceptor> {
  @Injectable()
  class CacheInterceptorMixin extends CacheInterceptor {
    constructor(
      cacheService: ICacheService,
      keyFactory: ICacheKeyFactory,
      reflector: Reflector,
      logger: PinoLoggerService
    ) {
      super(cacheService, keyFactory, reflector, logger, options);
    }
  }

  return mixin(CacheInterceptorMixin);
}

/**
 * @class CacheGetInterceptor
 * @description 缓存获取拦截器
 */
@Injectable()
export class CacheGetInterceptor implements NestInterceptor {
  constructor(
    @Inject('ICacheService') private readonly cacheService: ICacheService,
    @Inject('ICacheKeyFactory') private readonly keyFactory: ICacheKeyFactory,
    private readonly reflector: Reflector,
    private readonly logger: PinoLoggerService
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    const handler = context.getHandler();
    const cacheKey = this.reflector.get<string | ((args: unknown[]) => string)>(
      CACHE_KEY_METADATA,
      handler
    );

    if (!cacheKey) {
      return next.handle();
    }

    const args = this.getArguments(context);
    const key = this.generateCacheKey(cacheKey, args);

    try {
      const cached = await this.cacheService.get(key);
      if (cached !== null) {
        this.logger.debug(`Cache hit: ${key.key}`, LogContext.CACHE);
        return of(cached);
      }

      this.logger.debug(`Cache miss: ${key.key}`, LogContext.CACHE);
      return next.handle();
    } catch (error) {
      this.logger.error(
        `Cache get failed: ${key.key}`,
        LogContext.CACHE,
        undefined,
        error as Error
      );
      return next.handle();
    }
  }

  private getArguments(context: ExecutionContext): unknown[] {
    const request = context.switchToHttp().getRequest();
    return [
      ...(request.params ? Object.values(request.params) : []),
      ...(request.query ? Object.values(request.query) : []),
      ...(request.body ? [request.body] : []),
    ];
  }

  private generateCacheKey(
    cacheKey: string | ((args: unknown[]) => string),
    args: unknown[]
  ): CacheKey {
    const keyString =
      typeof cacheKey === 'function' ? cacheKey(args) : cacheKey;
    return this.keyFactory.create(keyString);
  }
}

/**
 * @class CacheSetInterceptor
 * @description 缓存设置拦截器
 */
@Injectable()
export class CacheSetInterceptor implements NestInterceptor {
  constructor(
    @Inject('ICacheService') private readonly cacheService: ICacheService,
    @Inject('ICacheKeyFactory') private readonly keyFactory: ICacheKeyFactory,
    private readonly reflector: Reflector,
    private readonly logger: PinoLoggerService
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<any>> {
    const handler = context.getHandler();
    const cacheKey = this.reflector.get<string | ((args: unknown[]) => string)>(
      CACHE_KEY_METADATA,
      handler
    );
    const cacheTtl = this.reflector.get<number>(CACHE_TTL_METADATA, handler);
    const cacheOptions = this.reflector.get<Partial<CacheOptions>>(
      CACHE_OPTIONS_METADATA,
      handler
    );

    if (!cacheKey) {
      return next.handle();
    }

    const args = this.getArguments(context);
    const key = this.generateCacheKey(cacheKey, args);
    const ttl = cacheTtl || 3600000; // 默认1小时

    return next.handle().pipe(
      tap(async (data) => {
        if (data !== null && data !== undefined) {
          try {
            await this.cacheService.set(key, data, { ttl, ...cacheOptions });
            this.logger.debug(`Cache set: ${key.key}`, LogContext.CACHE);
          } catch (error) {
            this.logger.error(
              `Cache set failed: ${key.key}`,
              LogContext.CACHE,
              undefined,
              error as Error
            );
          }
        }
      })
    );
  }

  private getArguments(context: ExecutionContext): unknown[] {
    const request = context.switchToHttp().getRequest();
    return [
      ...(request.params ? Object.values(request.params) : []),
      ...(request.query ? Object.values(request.query) : []),
      ...(request.body ? [request.body] : []),
    ];
  }

  private generateCacheKey(
    cacheKey: string | ((args: unknown[]) => string),
    args: unknown[]
  ): CacheKey {
    const keyString =
      typeof cacheKey === 'function' ? cacheKey(args) : cacheKey;
    return this.keyFactory.create(keyString);
  }
}
