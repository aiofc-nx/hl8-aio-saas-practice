export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * @enum LogContext
 * @description
 * 日志上下文枚举，定义日志的来源上下文。
 */
export enum LogContext {
  /** HTTP请求 */
  HTTP_REQUEST = 'http_request',
  /** 数据库操作 */
  DATABASE = 'database',
  /** 业务逻辑 */
  BUSINESS = 'business',
  /** 认证授权 */
  AUTH = 'auth',
  /** 配置管理 */
  CONFIG = 'config',
  /** 缓存操作 */
  CACHE = 'cache',
  /** 事件处理 */
  EVENT = 'event',
  /** 系统操作 */
  SYSTEM = 'system',
  /** 外部服务 */
  EXTERNAL = 'external',
  /** 性能监控 */
  PERFORMANCE = 'performance',
}

/**
 * @enum LogFormat
 * @description
 * 日志格式枚举，定义日志的输出格式。
 */
export enum LogFormat {
  /** JSON格式 */
  JSON = 'json',
  /** 文本格式 */
  TEXT = 'text',
  /** 结构化格式 */
  STRUCTURED = 'structured',
}

/**
 * @interface LogMetadata
 * @description
 * 日志元数据接口，定义日志的额外信息。
 */
export interface LogMetadata {
  /** 请求ID */
  requestId?: string;
  /** 租户ID */
  tenantId?: string;
  /** 用户ID */
  userId?: string;
  /** 会话ID */
  sessionId?: string;
  /** 操作类型 */
  operation?: string;
  /** 资源类型 */
  resource?: string;
  /** 资源ID */
  resourceId?: string;
  /** 执行时间（毫秒） */
  duration?: number;
  /** 错误代码 */
  errorCode?: string;
  /** 错误类型 */
  errorType?: string;
  /** 堆栈跟踪 */
  stack?: string;
  /** 自定义字段 */
  [key: string]: any;
}

/**
 * @interface LogEntry
 * @description
 * 日志条目接口，定义日志的完整结构。
 */
export interface LogEntry {
  /** 日志级别 */
  level: LogLevel;
  /** 时间戳 */
  timestamp: Date;
  /** 日志消息 */
  message: string;
  /** 日志上下文 */
  context: LogContext;
  /** 日志元数据 */
  metadata: LogMetadata;
  /** 错误对象（如果有） */
  error?: Error;
  /** 原始数据 */
  raw?: any;
}

/**
 * @interface LogConfig
 * @description
 * 日志配置接口，定义日志系统的配置选项。
 */
export interface LogConfig {
  /** 日志级别 */
  level: LogLevel;
  /** 日志格式 */
  format: LogFormat;
  /** 是否启用彩色输出 */
  colorize: boolean;
  /** 是否启用时间戳 */
  timestamp: boolean;
  /** 是否启用请求ID */
  requestId: boolean;
  /** 是否启用租户ID */
  tenantId: boolean;
  /** 是否启用用户ID */
  userId: boolean;
  /** 是否启用性能监控 */
  performance: boolean;
  /** 是否启用错误堆栈 */
  stackTrace: boolean;
  /** 日志文件路径 */
  filePath?: string;
  /** 日志文件轮转配置 */
  rotation?: {
    /** 最大文件大小 */
    maxSize: string;
    /** 保留文件数量 */
    maxFiles: number;
    /** 轮转间隔 */
    interval: string;
  };
  /** 远程日志配置 */
  remote?: {
    /** 远程日志服务URL */
    url: string;
    /** 认证令牌 */
    token?: string;
    /** 超时时间 */
    timeout: number;
    /** 重试次数 */
    retries: number;
  };
  /** 自定义字段 */
  custom?: Record<string, any>;
}

/**
 * @interface ILoggerService
 * @description
 * 日志服务接口，定义日志系统的核心功能。
 *
 * 主要职责：
 * 1. 提供不同级别的日志记录
 * 2. 支持结构化日志输出
 * 3. 支持日志上下文和元数据
 * 4. 支持日志格式化和传输
 * 5. 支持日志配置管理
 * 6. 支持性能监控和错误追踪
 *
 * 设计原则：
 * - 高性能：基于Pino的高性能日志库
 * - 结构化：支持结构化日志输出
 * - 可扩展：支持多种日志格式和传输方式
 * - 可配置：支持灵活的配置选项
 * - 可观测：支持完整的日志追踪
 */
export interface ILoggerService {
  /**
   * 记录调试日志
   *
   * @param message 日志消息
   * @param context 日志上下文
   * @param metadata 日志元数据
   * @param error 错误对象
   */
  debug(
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
    error?: Error,
  ): void;

  /**
   * 记录信息日志
   *
   * @param message 日志消息
   * @param context 日志上下文
   * @param metadata 日志元数据
   * @param error 错误对象
   */
  info(
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
    error?: Error,
  ): void;

  /**
   * 记录警告日志
   *
   * @param message 日志消息
   * @param context 日志上下文
   * @param metadata 日志元数据
   * @param error 错误对象
   */
  warn(
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
    error?: Error,
  ): void;

  /**
   * 记录错误日志
   *
   * @param message 日志消息
   * @param context 日志上下文
   * @param metadata 日志元数据
   * @param error 错误对象
   */
  error(
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
    error?: Error,
  ): void;

  /**
   * 记录致命错误日志
   *
   * @param message 日志消息
   * @param context 日志上下文
   * @param metadata 日志元数据
   * @param error 错误对象
   */
  fatal(
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
    error?: Error,
  ): void;

  /**
   * 记录跟踪日志
   *
   * @param message 日志消息
   * @param context 日志上下文
   * @param metadata 日志元数据
   * @param error 错误对象
   */
  trace(
    message: string,
    context?: LogContext,
    metadata?: LogMetadata,
    error?: Error,
  ): void;

  /**
   * 记录性能日志
   *
   * @param operation 操作名称
   * @param duration 执行时间（毫秒）
   * @param context 日志上下文
   * @param metadata 日志元数据
   */
  performance(
    operation: string,
    duration: number,
    context?: LogContext,
    metadata?: LogMetadata,
  ): void;

  /**
   * 记录业务日志
   *
   * @param message 日志消息
   * @param metadata 日志元数据
   */
  business(message: string, metadata?: LogMetadata): void;

  /**
   * 记录安全日志
   *
   * @param message 日志消息
   * @param metadata 日志元数据
   */
  security(message: string, metadata?: LogMetadata): void;

  /**
   * 创建子日志器
   *
   * @param context 日志上下文
   * @param metadata 默认元数据
   * @returns 子日志器
   */
  child(context: LogContext, metadata?: LogMetadata): ILoggerService;

  /**
   * 设置日志级别
   *
   * @param level 日志级别
   */
  setLevel(level: LogLevel): void;

  /**
   * 获取日志级别
   *
   * @returns 当前日志级别
   */
  getLevel(): LogLevel;

  /**
   * 更新日志配置
   *
   * @param config 日志配置
   */
  updateConfig(config: Partial<LogConfig>): void;

  /**
   * 获取日志配置
   *
   * @returns 当前日志配置
   */
  getConfig(): LogConfig;

  /**
   * 刷新日志缓冲区
   */
  flush(): Promise<void>;

  /**
   * 关闭日志器
   */
  close(): Promise<void>;

  /**
   * 获取日志统计信息
   *
   * @returns 日志统计信息
   */
  getStats(): {
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    logsByContext: Record<LogContext, number>;
    averageLogSize: number;
    lastLogTime?: Date;
  };

  /**
   * 重置日志统计
   */
  resetStats(): void;
}
