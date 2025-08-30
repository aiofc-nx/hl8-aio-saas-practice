import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';

import { tap, catchError } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { PinoLoggerService } from '../services/pino-logger.service';
import { LogContext } from '../interfaces/logging.interface';

/**
 * @interface MethodLogData
 * @description 方法日志数据结构
 */
interface MethodLogData {
  methodId: string;
  className: string;
  methodName: string;
  startTime: number;
  requestId?: string;
  tenantId?: string;
  userId?: string;
  parameters?: unknown[];
  result?: unknown;
  error?: Error;
  duration?: number;
}

/**
 * @class PinoLoggingInterceptor
 * @description
 * Pino日志拦截器，负责记录方法调用的详细日志。
 *
 * 主要功能包括：
 * 1. 为每个方法调用生成唯一ID
 * 2. 记录方法调用的开始和结束时间
 * 3. 记录方法参数和返回值
 * 4. 计算方法执行时间
 * 5. 记录异常信息
 * 6. 支持请求上下文追踪
 *
 * 设计原则：
 * - 高性能：最小化对方法执行的影响
 * - 结构化：提供结构化的日志数据
 * - 可配置：支持不同级别的日志记录
 * - 安全性：敏感参数过滤
 */
@Injectable()
export class PinoLoggingInterceptor implements NestInterceptor {
  private readonly sensitiveParameters = [
    'password',
    'token',
    'secret',
    'apikey',
    'api_key',
    'api-key',
  ];

  constructor(private readonly logger: PinoLoggerService) {}

  /**
   * @method intercept
   * @description 拦截器主方法
   * @param {ExecutionContext} context 执行上下文
   * @param {CallHandler} next 下一个处理器
   * @returns {Observable<unknown>} 可观察对象
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();
    const methodId = this.generateMethodId();
    const request = context.switchToHttp().getRequest();

    // 提取上下文信息
    const requestId = request?.requestId;
    const tenantId = request?.tenantId;
    const userId = request?.userId;

    // 获取方法信息
    const handler = context.getHandler();
    const className = context.getClass().name;
    const methodName = handler.name;

    // 获取方法参数
    const parameters = this.extractParameters(context);

    // 创建方法日志数据
    const methodLogData: MethodLogData = {
      methodId,
      className,
      methodName,
      startTime,
      requestId,
      tenantId,
      userId,
      parameters: this.sanitizeParameters(parameters),
    };

    // 记录方法开始日志
    this.logMethodStart(methodLogData);

    return next.handle().pipe(
      tap((result) => {
        // 记录方法成功完成
        const duration = Date.now() - startTime;
        const completedLogData: MethodLogData = {
          ...methodLogData,
          result: this.sanitizeResult(result),
          duration,
        };
        this.logMethodSuccess(completedLogData);
      }),
      catchError((error) => {
        // 记录方法异常
        const duration = Date.now() - startTime;
        const errorLogData: MethodLogData = {
          ...methodLogData,
          error,
          duration,
        };
        this.logMethodError(errorLogData);
        return throwError(() => error);
      })
    );
  }

  /**
   * @private
   * @method generateMethodId
   * @description 生成方法调用ID
   * @returns {string} 方法调用ID
   */
  private generateMethodId(): string {
    return uuidv4();
  }

  /**
   * @private
   * @method extractParameters
   * @description 提取方法参数
   * @param {ExecutionContext} context 执行上下文
   * @returns {unknown[]} 方法参数
   */
  private extractParameters(context: ExecutionContext): unknown[] {
    const args = context.getArgs();

    // 过滤掉请求和响应对象，只保留业务参数
    return args.filter((arg, index) => {
      // 通常前两个参数是 request 和 response
      if (index === 0 && arg?.method) return false; // HTTP request
      if (index === 1 && arg?.statusCode !== undefined) return false; // HTTP response
      return true;
    });
  }

  /**
   * @private
   * @method sanitizeParameters
   * @description 清理方法参数，移除敏感信息
   * @param {unknown[]} parameters 方法参数
   * @returns {unknown[]} 清理后的参数
   */
  private sanitizeParameters(parameters: unknown[]): unknown[] {
    return parameters.map((param) => this.sanitizeObject(param));
  }

  /**
   * @private
   * @method sanitizeResult
   * @description 清理方法返回值，移除敏感信息
   * @param {unknown} result 方法返回值
   * @returns {unknown} 清理后的返回值
   */
  private sanitizeResult(result: unknown): unknown {
    return this.sanitizeObject(result);
  }

  /**
   * @private
   * @method sanitizeObject
   * @description 清理对象，移除敏感信息
   * @param {unknown} obj 要清理的对象
   * @returns {unknown} 清理后的对象
   */
  private sanitizeObject(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    // 如果是数组，递归处理每个元素
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    // 如果是对象，递归处理每个属性
    const sanitized = { ...(obj as Record<string, unknown>) };

    for (const [key, value] of Object.entries(sanitized)) {
      if (this.sensitiveParameters.includes(key.toLowerCase())) {
        (sanitized as Record<string, unknown>)[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        (sanitized as Record<string, unknown>)[key] =
          this.sanitizeObject(value);
      }
    }

    return sanitized;
  }

  /**
   * @private
   * @method logMethodStart
   * @description 记录方法开始日志
   * @param {MethodLogData} data 方法日志数据
   */
  private logMethodStart(data: MethodLogData): void {
    this.logger.debug(
      `Method Start: ${data.className}.${data.methodName}`,
      LogContext.BUSINESS,
      {
        methodId: data.methodId,
        className: data.className,
        methodName: data.methodName,
        requestId: data.requestId,
        tenantId: data.tenantId,
        userId: data.userId,
        parameters: data.parameters,
      }
    );
  }

  /**
   * @private
   * @method logMethodSuccess
   * @description 记录方法成功完成日志
   * @param {MethodLogData} data 方法日志数据
   */
  private logMethodSuccess(data: MethodLogData): void {
    this.logger.info(
      `Method Success: ${data.className}.${data.methodName} - ${data.duration}ms`,
      LogContext.BUSINESS,
      {
        methodId: data.methodId,
        className: data.className,
        methodName: data.methodName,
        requestId: data.requestId,
        tenantId: data.tenantId,
        userId: data.userId,
        result: data.result,
        duration: data.duration,
      }
    );

    // 记录性能日志
    this.logger.performance(
      'method_execution',
      data.duration ?? 0,
      LogContext.PERFORMANCE,
      {
        methodId: data.methodId,
        className: data.className,
        methodName: data.methodName,
        requestId: data.requestId,
        tenantId: data.tenantId,
        userId: data.userId,
      }
    );
  }

  /**
   * @private
   * @method logMethodError
   * @description 记录方法异常日志
   * @param {MethodLogData} data 方法日志数据
   */
  private logMethodError(data: MethodLogData): void {
    this.logger.error(
      `Method Error: ${data.className}.${data.methodName} - ${data.duration}ms`,
      LogContext.BUSINESS,
      {
        methodId: data.methodId,
        className: data.className,
        methodName: data.methodName,
        requestId: data.requestId,
        tenantId: data.tenantId,
        userId: data.userId,
        parameters: data.parameters,
        duration: data.duration,
      },
      data.error
    );
  }
}
