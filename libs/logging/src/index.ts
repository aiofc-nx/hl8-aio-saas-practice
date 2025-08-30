/**
 * @fileoverview
 * Aiofix IAM Platform Logging Module
 *
 * @description
 * 提供高性能的日志服务，基于Pino实现，支持多租户、结构化日志、
 * 请求追踪、性能监控等功能。该模块可独立使用，适用于微服务架构。
 *
 * 主要功能：
 * 1. 高性能结构化日志记录
 * 2. 多租户日志隔离
 * 3. 请求追踪和上下文管理
 * 4. HTTP请求/响应日志中间件
 * 5. 方法调用日志拦截器
 * 6. 可配置的日志格式和输出
 *
 * 使用示例：
 * ```typescript
 * import { LoggingModule, PinoLoggerService } from '@aiofix/logging';
 *
 * @Module({
 *   imports: [LoggingModule],
 *   providers: [MyService],
 * })
 * export class AppModule {}
 *
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly logger: PinoLoggerService) {}
 *
 *   doSomething() {
 *     this.logger.info('操作开始', { userId: '123', action: 'create' });
 *   }
 * }
 * ```
 */

// 导出模块
export { LoggingModule } from './logging.module';

// 导出服务
export { PinoLoggerService } from './services/pino-logger.service';
export { PinoLoggerConfigService } from './services/pino-logger-config.service';

// 导出工厂
export { PinoLoggerFactory } from './factories/pino-logger.factory';

// 导出中间件
export { PinoLoggingMiddleware } from './middleware/pino-logging.middleware';

// 导出拦截器
export { PinoLoggingInterceptor } from './interceptors/pino-logging.interceptor';

// 导出接口和类型
export * from './interfaces/logging.interface';

// 导出默认配置
export { defaultLoggingConfig } from './services/pino-logger-config.service';
