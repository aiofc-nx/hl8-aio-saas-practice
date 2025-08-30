import { registerAs } from '@nestjs/config';

/**
 * @fileoverview
 * IAM系统设置配置
 *
 * @description
 * IAM系统的功能开关和设置配置，定义了各种认证方式和功能特性的开关。
 * 该配置使用@nestjs/config的registerAs方法进行注册。
 *
 * 主要原理与机制如下：
 * 1. 使用registerAs创建命名空间配置
 * 2. 定义功能开关和认证方式配置
 * 3. 支持环境变量覆盖默认值
 * 4. 提供类型安全的配置访问
 *
 * 功能与业务规则：
 * 1. 认证方式配置
 * 2. 功能开关管理
 * 3. 安全策略配置
 * 4. 系统行为控制
 *
 * @returns {Object} 返回功能开关和设置配置对象
 */
export default registerAs('setting', () => ({
  /**
   * 认证方式配置
   */
  authentication: {
    /** 是否启用邮箱密码登录 */
    emailPasswordLogin: process.env.FEATURE_EMAIL_PASSWORD_LOGIN === 'true',

    /** 是否启用魔法链接登录 */
    magicLogin: process.env.FEATURE_MAGIC_LOGIN === 'true',

    /** 是否启用双因素认证 */
    twoFactorAuth: process.env.FEATURE_TWO_FACTOR_AUTH === 'true',

    /** 是否启用SSO单点登录 */
    ssoLogin: process.env.FEATURE_SSO_LOGIN === 'true',

    /** 是否启用OAuth2认证 */
    oauth2Login: process.env.FEATURE_OAUTH2_LOGIN === 'true',
  },

  /**
   * 安全策略配置
   */
  security: {
    /** 密码最小长度 */
    passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),

    /** 密码复杂度要求 */
    passwordComplexity: process.env.PASSWORD_COMPLEXITY === 'true',

    /** 账户锁定阈值 */
    accountLockoutThreshold: parseInt(
      process.env.ACCOUNT_LOCKOUT_THRESHOLD || '5',
      10,
    ),

    /** 账户锁定时间（分钟） */
    accountLockoutDuration: parseInt(
      process.env.ACCOUNT_LOCKOUT_DURATION || '30',
      10,
    ),

    /** 会话超时时间（分钟） */
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '60', 10),

    /** 是否启用密码历史检查 */
    passwordHistoryCheck: process.env.PASSWORD_HISTORY_CHECK === 'true',

    /** 密码历史保留数量 */
    passwordHistoryCount: parseInt(
      process.env.PASSWORD_HISTORY_COUNT || '5',
      10,
    ),
  },

  /**
   * 多租户配置
   */
  multiTenancy: {
    /** 是否启用多租户 */
    enabled: process.env.MULTI_TENANCY_ENABLED === 'true',

    /** 租户隔离级别 */
    isolationLevel: process.env.TENANT_ISOLATION_LEVEL || 'database',

    /** 是否启用租户数据加密 */
    dataEncryption: process.env.TENANT_DATA_ENCRYPTION === 'true',

    /** 租户配置缓存时间（秒） */
    configCacheTtl: parseInt(process.env.TENANT_CONFIG_CACHE_TTL || '3600', 10),
  },

  /**
   * 审计日志配置
   */
  audit: {
    /** 是否启用审计日志 */
    enabled: process.env.AUDIT_LOG_ENABLED === 'true',

    /** 审计日志保留天数 */
    retentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10),

    /** 是否记录敏感操作 */
    logSensitiveOperations:
      process.env.AUDIT_LOG_SENSITIVE_OPERATIONS === 'true',

    /** 审计日志级别 */
    level: process.env.AUDIT_LOG_LEVEL || 'info',
  },

  /**
   * 通知配置
   */
  notifications: {
    /** 是否启用邮件通知 */
    emailEnabled: process.env.NOTIFICATION_EMAIL_ENABLED === 'true',

    /** 是否启用短信通知 */
    smsEnabled: process.env.NOTIFICATION_SMS_ENABLED === 'true',

    /** 是否启用推送通知 */
    pushEnabled: process.env.NOTIFICATION_PUSH_ENABLED === 'true',

    /** 通知模板目录 */
    templateDirectory: process.env.NOTIFICATION_TEMPLATE_DIR || 'src/templates',
  },

  /**
   * 性能配置
   */
  performance: {
    /** 是否启用查询缓存 */
    queryCacheEnabled: process.env.QUERY_CACHE_ENABLED === 'true',

    /** 查询缓存TTL（秒） */
    queryCacheTtl: parseInt(process.env.QUERY_CACHE_TTL || '300', 10),

    /** 是否启用API限流 */
    rateLimitingEnabled: process.env.RATE_LIMITING_ENABLED === 'true',

    /** API限流窗口大小（秒） */
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60', 10),

    /** API限流最大请求数 */
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
}));
