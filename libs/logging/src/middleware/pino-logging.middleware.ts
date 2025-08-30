import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { PinoLoggerService } from '../services/pino-logger.service';
import { LogContext } from '../interfaces/logging.interface';

/**
 * @interface RequestLogData
 * @description 请求日志数据接口
 */
interface RequestLogData {
  requestId: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  ip: string;
  userAgent: string;
  tenantId?: string;
  userId?: string;
  timestamp: Date;
}

/**
 * @interface ResponseLogData
 * @description 响应日志数据接口
 */
interface ResponseLogData extends RequestLogData {
  statusCode: number;
  duration: number;
  responseSize?: number;
  error?: Error;
}

/**
 * @class PinoLoggingMiddleware
 * @description Pino日志中间件，用于记录HTTP请求和响应日志
 *
 * 主要功能：
 * 1. 自动生成请求ID
 * 2. 记录请求详情（方法、URL、头部、查询参数、请求体）
 * 3. 记录响应详情（状态码、响应时间、响应大小）
 * 4. 支持多租户和用户上下文
 * 5. 错误日志记录
 * 6. 性能监控
 */
@Injectable()
export class PinoLoggingMiddleware implements NestMiddleware {
  constructor(private readonly logger: PinoLoggerService) {}

  /**
   * @method use
   * @description 中间件主方法，处理HTTP请求和响应日志
   * @param {FastifyRequest} req Fastify请求对象
   * @param {FastifyReply} res Fastify响应对象
   * @param {() => void} next 下一个中间件函数
   */
  use(req: FastifyRequest, res: FastifyReply, next: () => void): void {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    const tenantId = this.extractTenantId(req);
    const userId = this.extractUserId(req);

    // 构建请求日志数据
    const requestLogData: RequestLogData = {
      requestId,
      method: req.method,
      url: req.url,
      headers: req.headers as Record<string, string>,
      query: req.query as Record<string, unknown>,
      body: req.body,
      ip: this.getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      tenantId,
      userId,
      timestamp: new Date(),
    };

    // 记录请求日志
    this.logRequest(requestLogData);

    // 设置响应变量
    let responseBody: unknown;
    let responseSize = 0;

    // Fastify的响应处理
    const originalSend = res.send;
    res.send = (payload?: unknown): FastifyReply => {
      if (payload && !responseBody) {
        responseBody = payload;
        responseSize =
          typeof payload === 'string'
            ? payload.length
            : JSON.stringify(payload).length;
      }

      // 记录响应日志
      const duration = Date.now() - startTime;
      const responseLogData: ResponseLogData = {
        ...requestLogData,
        statusCode: res.statusCode,
        duration,
        responseSize,
      };

      // 异步记录日志，不阻塞响应
      setImmediate(() => {
        this.logResponse(responseLogData);
      });

      return originalSend.call(res, payload);
    };

    next();
  }

  /**
   * @private
   * @method generateRequestId
   * @description 生成请求ID
   * @returns {string} 请求ID
   */
  private generateRequestId(): string {
    return uuidv4();
  }

  /**
   * @private
   * @method extractTenantId
   * @description 从请求中提取租户ID
   * @param {FastifyRequest} req Fastify请求对象
   * @returns {string | undefined} 租户ID
   */
  private extractTenantId(req: FastifyRequest): string | undefined {
    // 从请求头中提取
    const headerTenantId =
      req.headers['x-tenant-id'] || req.headers['X-Tenant-ID'];
    if (headerTenantId) return String(headerTenantId);

    // 从查询参数中提取
    const queryTenantId =
      (req.query as Record<string, unknown>)?.tenantId ||
      (req.query as Record<string, unknown>)?.tenant_id;
    if (queryTenantId) return String(queryTenantId);

    // 从请求体中提取
    const bodyTenantId =
      (req.body as Record<string, unknown>)?.tenantId ||
      (req.body as Record<string, unknown>)?.tenant_id;
    if (bodyTenantId) return String(bodyTenantId);

    return undefined;
  }

  /**
   * @private
   * @method extractUserId
   * @description 从请求中提取用户ID
   * @param {FastifyRequest} req Fastify请求对象
   * @returns {string | undefined} 用户ID
   */
  private extractUserId(req: FastifyRequest): string | undefined {
    // 从请求头中提取
    const headerUserId = req.headers['x-user-id'] || req.headers['X-User-ID'];
    if (headerUserId) return String(headerUserId);

    // 从查询参数中提取
    const queryUserId =
      (req.query as Record<string, unknown>)?.userId ||
      (req.query as Record<string, unknown>)?.user_id;
    if (queryUserId) return String(queryUserId);

    // 从请求体中提取
    const bodyUserId =
      (req.body as Record<string, unknown>)?.userId ||
      (req.body as Record<string, unknown>)?.user_id;
    if (bodyUserId) return String(bodyUserId);

    return undefined;
  }

  /**
   * @private
   * @method getClientIp
   * @description 获取客户端IP地址
   * @param {FastifyRequest} req Fastify请求对象
   * @returns {string} 客户端IP地址
   */
  private getClientIp(req: FastifyRequest): string {
    return (
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * @private
   * @method logRequest
   * @description 记录请求日志
   * @param {RequestLogData} data 请求日志数据
   */
  private logRequest(data: RequestLogData): void {
    this.logger.info('HTTP Request', LogContext.HTTP_REQUEST, {
      requestId: data.requestId,
      method: data.method,
      url: data.url,
      ip: data.ip,
      userAgent: data.userAgent,
      tenantId: data.tenantId,
      userId: data.userId,
      query: data.query,
      body: this.sanitizeBody(data.body),
      headers: this.sanitizeHeaders(data.headers),
    });
  }

  /**
   * @private
   * @method logResponse
   * @description 记录响应日志
   * @param {ResponseLogData} data 响应日志数据
   */
  private logResponse(data: ResponseLogData): void {
    const logLevel = data.statusCode >= 400 ? 'warn' : 'info';
    const logMethod = this.logger[logLevel as keyof PinoLoggerService] as (
      message: string,
      context: LogContext,
      metadata?: Record<string, unknown>
    ) => void;

    logMethod.call(this.logger, 'HTTP Response', LogContext.HTTP_REQUEST, {
      requestId: data.requestId,
      method: data.method,
      url: data.url,
      statusCode: data.statusCode,
      duration: data.duration,
      responseSize: data.responseSize,
      tenantId: data.tenantId,
      userId: data.userId,
    });
  }

  /**
   * @private
   * @method logError
   * @description 记录错误日志
   * @param {ResponseLogData} data 错误日志数据
   */
  // private logError(data: ResponseLogData): void {
  //   this.logger.error('HTTP Error', LogContext.HTTP_REQUEST, {
  //     requestId: data.requestId,
  //     method: data.method,
  //     url: data.url,
  //     statusCode: data.statusCode,
  //     duration: data.duration,
  //     error: data.error?.message,
  //     stack: data.error?.stack,
  //     tenantId: data.tenantId,
  //     userId: data.userId,
  //   });
  // }

  /**
   * @private
   * @method sanitizeBody
   * @description 清理请求体中的敏感信息
   * @param {unknown} body 请求体
   * @returns {unknown} 清理后的请求体
   */
  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    const sanitized = { ...(body as Record<string, unknown>) };

    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '***REDACTED***';
      }
    });

    return sanitized;
  }

  /**
   * @private
   * @method sanitizeHeaders
   * @description 清理请求头中的敏感信息
   * @param {Record<string, string>} headers 请求头
   * @returns {Record<string, string>} 清理后的请求头
   */
  private sanitizeHeaders(
    headers: Record<string, string>
  ): Record<string, string> {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitized = { ...headers };

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = '***REDACTED***';
      }
    });

    return sanitized;
  }
}
