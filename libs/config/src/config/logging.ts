import { registerAs } from '@nestjs/config';

/**
 * Logging Configuration
 *
 * 日志配置模块，定义IAM系统的日志策略和输出参数。
 * 支持结构化日志、多级别日志、日志聚合等功能。
 *
 * 主要原理与机制如下：
 * 1. 使用@nestjs/config的registerAs创建命名空间配置
 * 2. 从环境变量读取日志参数
 * 3. 提供默认值确保配置的完整性
 * 4. 支持多环境日志策略
 *
 * 功能与业务规则：
 * 1. 日志级别配置
 * 2. 日志格式配置
 * 3. 日志输出配置
 * 4. 日志聚合配置
 *
 * @returns 日志配置对象
 */
export default registerAs('logging', () => ({
  /**
   * 日志级别配置
   */
  level: {
    /**
     * 默认日志级别
     */
    default: process.env.LOG_LEVEL || 'info',

    /**
     * 应用日志级别
     */
    app: process.env.LOG_LEVEL_APP || 'info',

    /**
     * 数据库日志级别
     */
    database: process.env.LOG_LEVEL_DATABASE || 'warn',

    /**
     * HTTP请求日志级别
     */
    http: process.env.LOG_LEVEL_HTTP || 'info',

    /**
     * 安全日志级别
     */
    security: process.env.LOG_LEVEL_SECURITY || 'warn',

    /**
     * 性能日志级别
     */
    performance: process.env.LOG_LEVEL_PERFORMANCE || 'info',
  },

  /**
   * 日志格式配置
   */
  format: {
    /**
     * 日志格式类型
     */
    type: process.env.LOG_FORMAT || 'json',

    /**
     * 是否启用时间戳
     */
    timestamp: process.env.LOG_TIMESTAMP !== 'false',

    /**
     * 是否启用颜色
     */
    colorize: process.env.LOG_COLORIZE === 'true',

    /**
     * 是否启用请求ID
     */
    requestId: process.env.LOG_REQUEST_ID !== 'false',

    /**
     * 是否启用租户ID
     */
    tenantId: process.env.LOG_TENANT_ID !== 'false',

    /**
     * 是否启用用户ID
     */
    userId: process.env.LOG_USER_ID !== 'false',

    /**
     * 是否启用性能监控
     */
    performance: process.env.LOG_PERFORMANCE !== 'false',

    /**
     * 是否启用堆栈跟踪
     */
    stackTrace: process.env.LOG_STACK_TRACE !== 'false',
  },

  /**
   * 日志输出配置
   */
  output: {
    /**
     * 控制台输出
     */
    console: {
      enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
      level: process.env.LOG_CONSOLE_LEVEL || 'info',
    },

    /**
     * 文件输出
     */
    file: {
      enabled: process.env.LOG_FILE_ENABLED === 'true',
      level: process.env.LOG_FILE_LEVEL || 'info',
      path: process.env.LOG_FILE_PATH || 'logs/app.log',
      maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
      maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '5', 10),
      interval: process.env.LOG_FILE_INTERVAL || '1d',
    },

    /**
     * 远程日志输出
     */
    remote: {
      enabled: process.env.LOG_REMOTE_ENABLED === 'true',
      level: process.env.LOG_REMOTE_LEVEL || 'error',
      url: process.env.LOG_REMOTE_URL || '',
      token: process.env.LOG_REMOTE_TOKEN || '',
      timeout: parseInt(process.env.LOG_REMOTE_TIMEOUT || '5000', 10),
      retries: parseInt(process.env.LOG_REMOTE_RETRIES || '3', 10),
    },
  },

  /**
   * 日志聚合配置
   */
  aggregation: {
    /**
     * 是否启用日志聚合
     */
    enabled: process.env.LOG_AGGREGATION_ENABLED === 'true',

    /**
     * 聚合间隔（毫秒）
     */
    interval: parseInt(process.env.LOG_AGGREGATION_INTERVAL || '60000', 10),

    /**
     * 聚合大小
     */
    batchSize: parseInt(process.env.LOG_AGGREGATION_BATCH_SIZE || '100', 10),

    /**
     * 聚合目标
     */
    target: process.env.LOG_AGGREGATION_TARGET || 'elasticsearch',
  },

  /**
   * 日志过滤配置
   */
  filter: {
    /**
     * 敏感字段过滤
     */
    sensitiveFields: process.env.LOG_SENSITIVE_FIELDS?.split(',') || [
      'password',
      'token',
      'secret',
      'apiKey',
      'authorization',
    ],

    /**
     * 忽略的路径
     */
    ignorePaths: process.env.LOG_IGNORE_PATHS?.split(',') || [
      '/health',
      '/metrics',
      '/favicon.ico',
    ],

    /**
     * 忽略的用户代理
     */
    ignoreUserAgents: process.env.LOG_IGNORE_USER_AGENTS?.split(',') || [
      'health-check',
      'monitoring',
    ],
  },

  /**
   * 日志监控配置
   */
  monitoring: {
    /**
     * 是否启用日志监控
     */
    enabled: process.env.LOG_MONITORING_ENABLED !== 'false',

    /**
     * 监控间隔（毫秒）
     */
    interval: parseInt(process.env.LOG_MONITORING_INTERVAL || '30000', 10),

    /**
     * 错误率阈值
     */
    errorRateThreshold: parseFloat(
      process.env.LOG_ERROR_RATE_THRESHOLD || '0.1',
    ),

    /**
     * 响应时间阈值（毫秒）
     */
    responseTimeThreshold: parseInt(
      process.env.LOG_RESPONSE_TIME_THRESHOLD || '1000',
      10,
    ),
  },

  /**
   * 日志保留配置
   */
  retention: {
    /**
     * 日志保留天数
     */
    days: parseInt(process.env.LOG_RETENTION_DAYS || '30', 10),

    /**
     * 是否启用自动清理
     */
    autoCleanup: process.env.LOG_AUTO_CLEANUP !== 'false',

    /**
     * 清理间隔（小时）
     */
    cleanupInterval: parseInt(process.env.LOG_CLEANUP_INTERVAL || '24', 10),
  },
}));
