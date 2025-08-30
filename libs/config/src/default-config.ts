import * as dotenv from 'dotenv';
dotenv.config();

import { IamConfig } from './config.service';

/**
 * IAM系统默认配置
 *
 * 主要原理与机制如下：
 * 1. 使用dotenv加载环境变量
 * 2. 提供合理的默认值确保系统正常运行
 * 3. 支持多环境配置（开发、测试、生产）
 * 4. 遵循安全最佳实践
 *
 * 功能与业务规则：
 * 1. 应用基础配置
 * 2. 数据库连接配置
 * 3. Redis缓存配置
 * 4. JWT认证配置
 * 5. 邮件服务配置
 * 6. 日志系统配置
 */
export const defaultConfiguration: Partial<IamConfig> = {
  app: {
    app_name: process.env.APP_NAME || 'Aiofix IAM',
    app_version: process.env.APP_VERSION || '1.0.0',
    app_description:
      process.env.APP_DESCRIPTION ||
      '基于DDD和Clean Architecture的多租户SaaS平台',
    environment: process.env.NODE_ENV || 'development',
    debug: process.env.APP_DEBUG === 'true',
    demo: process.env.APP_DEMO === 'true',
    client_base_url: process.env.CLIENT_BASE_URL || 'http://localhost:3000',
    api_base_url: process.env.API_BASE_URL || 'http://localhost:3000/api/v1',
    docs_url: process.env.DOCS_URL || 'http://localhost:3000/api/v1/docs',
  },
  database: {
    type: process.env.DB_TYPE || 'postgresql',
    postgresql: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'aiofix_iam',
      schema: process.env.DB_SCHEMA || 'public',
      ssl: process.env.DB_SSL === 'true',
      sslMode: process.env.DB_SSL_MODE || 'prefer',
    },
    mongodb: {
      uri:
        process.env.MONGODB_URI ||
        'mongodb://localhost:27017/aiofix_iam_events',
      database: process.env.MONGODB_DATABASE || 'aiofix_iam_events',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    },
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      acquireTimeoutMillis: parseInt(
        process.env.DB_ACQUIRE_TIMEOUT || '60000',
        10
      ),
      createTimeoutMillis: parseInt(
        process.env.DB_CREATE_TIMEOUT || '30000',
        10
      ),
      destroyTimeoutMillis: parseInt(
        process.env.DB_DESTROY_TIMEOUT || '5000',
        10
      ),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL || '1000', 10),
      createRetryIntervalMillis: parseInt(
        process.env.DB_CREATE_RETRY_INTERVAL || '200',
        10
      ),
    },
    mikroOrm: {
      debug: process.env.DB_LOGGING === 'true',
      logger:
        process.env.DB_LOGGING === 'true'
          ? console.log.bind(console)
          : undefined,
      migrations: {
        path: 'src/migrations/*.migration{.ts,.js}',
        tableName: 'mikro_orm_migrations',
      },
      entities: ['src/**/*.entity{.ts,.js}'],
    },
    logging: {
      enabled: process.env.DB_LOGGING === 'true',
      level: process.env.DB_LOG_LEVEL || 'error',
      slowQueryThreshold: parseInt(
        process.env.DB_SLOW_QUERY_THRESHOLD || '1000',
        10
      ),
    },
  },
  redis: {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'aiofix:iam:',
    },
    pool: {
      min: parseInt(process.env.REDIS_POOL_MIN || '2', 10),
      max: parseInt(process.env.REDIS_POOL_MAX || '10', 10),
      acquireTimeoutMillis: parseInt(
        process.env.REDIS_ACQUIRE_TIMEOUT || '30000',
        10
      ),
      createTimeoutMillis: parseInt(
        process.env.REDIS_CREATE_TIMEOUT || '30000',
        10
      ),
      destroyTimeoutMillis: parseInt(
        process.env.REDIS_DESTROY_TIMEOUT || '5000',
        10
      ),
      idleTimeoutMillis: parseInt(
        process.env.REDIS_IDLE_TIMEOUT || '30000',
        10
      ),
      reapIntervalMillis: parseInt(
        process.env.REDIS_REAP_INTERVAL || '1000',
        10
      ),
      createRetryIntervalMillis: parseInt(
        process.env.REDIS_CREATE_RETRY_INTERVAL || '200',
        10
      ),
    },
    cache: {
      defaultTtl: parseInt(process.env.REDIS_DEFAULT_TTL || '3600', 10),
      sessionTtl: parseInt(process.env.REDIS_SESSION_TTL || '86400', 10),
      permissionTtl: parseInt(process.env.REDIS_PERMISSION_TTL || '1800', 10),
      tenantConfigTtl: parseInt(
        process.env.REDIS_TENANT_CONFIG_TTL || '3600',
        10
      ),
      maxMemory: process.env.REDIS_MAX_MEMORY || '2gb',
      maxMemoryPolicy: process.env.REDIS_MAX_MEMORY_POLICY || 'allkeys-lru',
    },
    lock: {
      defaultTimeout: parseInt(process.env.REDIS_LOCK_TIMEOUT || '30000', 10),
      retryDelay: parseInt(process.env.REDIS_LOCK_RETRY_DELAY || '100', 10),
      retryCount: parseInt(process.env.REDIS_LOCK_RETRY_COUNT || '10', 10),
    },
    cluster: {
      enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
      nodes: process.env.REDIS_CLUSTER_NODES?.split(',') || [],
      maxRedirections: parseInt(
        process.env.REDIS_CLUSTER_MAX_REDIRECTIONS || '16',
        10
      ),
    },
    sentinel: {
      enabled: process.env.REDIS_SENTINEL_ENABLED === 'true',
      masterName: process.env.REDIS_SENTINEL_MASTER_NAME || 'mymaster',
      sentinels: process.env.REDIS_SENTINEL_HOSTS?.split(',') || [],
      password: process.env.REDIS_SENTINEL_PASSWORD || undefined,
    },
    health: {
      enabled: process.env.REDIS_HEALTH_CHECK_ENABLED !== 'false',
      interval: parseInt(
        process.env.REDIS_HEALTH_CHECK_INTERVAL || '30000',
        10
      ),
      timeout: parseInt(process.env.REDIS_HEALTH_CHECK_TIMEOUT || '5000', 10),
    },
  },
  jwt: {
    secret: {
      accessToken:
        process.env.JWT_ACCESS_TOKEN_SECRET ||
        'your-super-secret-access-token-key',
      refreshToken:
        process.env.JWT_REFRESH_TOKEN_SECRET ||
        'your-super-secret-refresh-token-key',
      resetPassword:
        process.env.JWT_RESET_PASSWORD_SECRET ||
        'your-super-secret-reset-password-key',
      emailVerification:
        process.env.JWT_EMAIL_VERIFICATION_SECRET ||
        'your-super-secret-email-verification-key',
    },
    accessToken: {
      expiresIn: parseInt(
        process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '3600',
        10
      ),
      algorithm: process.env.JWT_ACCESS_TOKEN_ALGORITHM || 'HS256',
      issuer: process.env.JWT_ISSUER || 'aiofix-iam',
      audience: process.env.JWT_AUDIENCE || 'aiofix-users',
    },
    refreshToken: {
      expiresIn: parseInt(
        process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '2592000',
        10
      ),
      algorithm: process.env.JWT_REFRESH_TOKEN_ALGORITHM || 'HS256',
      issuer: process.env.JWT_ISSUER || 'aiofix-iam',
      audience: process.env.JWT_AUDIENCE || 'aiofix-users',
    },
    resetPassword: {
      expiresIn: parseInt(
        process.env.JWT_RESET_PASSWORD_EXPIRES_IN || '3600',
        10
      ),
      algorithm: process.env.JWT_RESET_PASSWORD_ALGORITHM || 'HS256',
    },
    emailVerification: {
      expiresIn: parseInt(
        process.env.JWT_EMAIL_VERIFICATION_EXPIRES_IN || '86400',
        10
      ),
      algorithm: process.env.JWT_EMAIL_VERIFICATION_ALGORITHM || 'HS256',
    },
    multiTenant: {
      enabled: process.env.JWT_MULTI_TENANT_ENABLED !== 'false',
      tenantIdField: process.env.JWT_TENANT_ID_FIELD || 'tenantId',
      organizationIdField:
        process.env.JWT_ORGANIZATION_ID_FIELD || 'organizationId',
      departmentIdField: process.env.JWT_DEPARTMENT_ID_FIELD || 'departmentId',
    },
    security: {
      blacklistEnabled: process.env.JWT_BLACKLIST_ENABLED !== 'false',
      blacklistTtl: parseInt(process.env.JWT_BLACKLIST_TTL || '86400', 10),
      rotationEnabled: process.env.JWT_ROTATION_ENABLED !== 'false',
      rotationThreshold: parseInt(
        process.env.JWT_ROTATION_THRESHOLD || '300',
        10
      ),
    },
    cache: {
      enabled: process.env.JWT_CACHE_ENABLED !== 'false',
      ttl: parseInt(process.env.JWT_CACHE_TTL || '300', 10),
      prefix: process.env.JWT_CACHE_PREFIX || 'jwt:',
    },
  },
  email: {
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
      tls: {
        rejectUnauthorized:
          process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
      },
    },
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY || '',
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@aiofix.com',
      fromName: process.env.SENDGRID_FROM_NAME || 'Aiofix IAM',
    },
    ses: {
      region: process.env.AWS_SES_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || '',
      fromEmail: process.env.AWS_SES_FROM_EMAIL || 'noreply@aiofix.com',
      fromName: process.env.AWS_SES_FROM_NAME || 'Aiofix IAM',
    },
    sending: {
      fromEmail: process.env.EMAIL_FROM || 'noreply@aiofix.com',
      fromName: process.env.EMAIL_FROM_NAME || 'Aiofix IAM',
      replyTo: process.env.EMAIL_REPLY_TO || 'support@aiofix.com',
      batchInterval: parseInt(process.env.EMAIL_BATCH_INTERVAL || '1000', 10),
      batchSize: parseInt(process.env.EMAIL_BATCH_SIZE || '10', 10),
      retryCount: parseInt(process.env.EMAIL_RETRY_COUNT || '3', 10),
      retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY || '5000', 10),
    },
    templates: {
      directory: process.env.EMAIL_TEMPLATES_DIR || 'src/templates/email',
      defaultLanguage: process.env.EMAIL_DEFAULT_LANGUAGE || 'zh-CN',
      supportedLanguages: process.env.EMAIL_SUPPORTED_LANGUAGES?.split(',') || [
        'zh-CN',
        'en-US',
      ],
    },
    types: {
      emailVerification: {
        subject: process.env.EMAIL_VERIFICATION_SUBJECT || '邮箱验证',
        template:
          process.env.EMAIL_VERIFICATION_TEMPLATE || 'email-verification',
        enabled: process.env.EMAIL_VERIFICATION_ENABLED !== 'false',
      },
      passwordReset: {
        subject: process.env.EMAIL_PASSWORD_RESET_SUBJECT || '密码重置',
        template: process.env.EMAIL_PASSWORD_RESET_TEMPLATE || 'password-reset',
        enabled: process.env.EMAIL_PASSWORD_RESET_ENABLED !== 'false',
      },
      welcome: {
        subject: process.env.EMAIL_WELCOME_SUBJECT || '欢迎加入Aiofix IAM',
        template: process.env.EMAIL_WELCOME_TEMPLATE || 'welcome',
        enabled: process.env.EMAIL_WELCOME_ENABLED !== 'false',
      },
      invitation: {
        subject: process.env.EMAIL_INVITATION_SUBJECT || '邀请加入组织',
        template: process.env.EMAIL_INVITATION_TEMPLATE || 'invitation',
        enabled: process.env.EMAIL_INVITATION_ENABLED !== 'false',
      },
      notification: {
        subject: process.env.EMAIL_NOTIFICATION_SUBJECT || '系统通知',
        template: process.env.EMAIL_NOTIFICATION_TEMPLATE || 'notification',
        enabled: process.env.EMAIL_NOTIFICATION_ENABLED !== 'false',
      },
    },
    verification: {
      enabled: process.env.EMAIL_VERIFICATION_ENABLED !== 'false',
      linkExpiresIn: parseInt(
        process.env.EMAIL_VERIFICATION_LINK_EXPIRES_IN || '86400',
        10
      ),
      codeExpiresIn: parseInt(
        process.env.EMAIL_VERIFICATION_CODE_EXPIRES_IN || '1800',
        10
      ),
      codeLength: parseInt(
        process.env.EMAIL_VERIFICATION_CODE_LENGTH || '6',
        10
      ),
    },
    queue: {
      enabled: process.env.EMAIL_QUEUE_ENABLED !== 'false',
      name: process.env.EMAIL_QUEUE_NAME || 'email',
      priority: parseInt(process.env.EMAIL_QUEUE_PRIORITY || '10', 10),
      delay: parseInt(process.env.EMAIL_QUEUE_DELAY || '0', 10),
    },
  },
  logging: {
    level: {
      default: process.env.LOG_LEVEL || 'info',
      app: process.env.LOG_LEVEL_APP || 'info',
      database: process.env.LOG_LEVEL_DATABASE || 'warn',
      http: process.env.LOG_LEVEL_HTTP || 'info',
      security: process.env.LOG_LEVEL_SECURITY || 'warn',
      performance: process.env.LOG_LEVEL_PERFORMANCE || 'info',
    },
    format: {
      type: process.env.LOG_FORMAT || 'json',
      timestamp: process.env.LOG_TIMESTAMP !== 'false',
      colorize: process.env.LOG_COLORIZE === 'true',
      requestId: process.env.LOG_REQUEST_ID !== 'false',
      tenantId: process.env.LOG_TENANT_ID !== 'false',
      userId: process.env.LOG_USER_ID !== 'false',
      performance: process.env.LOG_PERFORMANCE !== 'false',
      stackTrace: process.env.LOG_STACK_TRACE !== 'false',
    },
    output: {
      console: {
        enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
        level: process.env.LOG_CONSOLE_LEVEL || 'info',
      },
      file: {
        enabled: process.env.LOG_FILE_ENABLED === 'true',
        level: process.env.LOG_FILE_LEVEL || 'info',
        path: process.env.LOG_FILE_PATH || 'logs/app.log',
        maxSize: process.env.LOG_FILE_MAX_SIZE || '10m',
        maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '5', 10),
        interval: process.env.LOG_FILE_INTERVAL || '1d',
      },
      remote: {
        enabled: process.env.LOG_REMOTE_ENABLED === 'true',
        level: process.env.LOG_REMOTE_LEVEL || 'error',
        url: process.env.LOG_REMOTE_URL || '',
        token: process.env.LOG_REMOTE_TOKEN || '',
        timeout: parseInt(process.env.LOG_REMOTE_TIMEOUT || '5000', 10),
        retries: parseInt(process.env.LOG_REMOTE_RETRIES || '3', 10),
      },
    },
    aggregation: {
      enabled: process.env.LOG_AGGREGATION_ENABLED === 'true',
      interval: parseInt(process.env.LOG_AGGREGATION_INTERVAL || '60000', 10),
      batchSize: parseInt(process.env.LOG_AGGREGATION_BATCH_SIZE || '100', 10),
      target: process.env.LOG_AGGREGATION_TARGET || 'elasticsearch',
    },
    filter: {
      sensitiveFields: process.env.LOG_SENSITIVE_FIELDS?.split(',') || [
        'password',
        'token',
        'secret',
        'apiKey',
        'authorization',
      ],
      ignorePaths: process.env.LOG_IGNORE_PATHS?.split(',') || [
        '/health',
        '/metrics',
        '/favicon.ico',
      ],
      ignoreUserAgents: process.env.LOG_IGNORE_USER_AGENTS?.split(',') || [
        'health-check',
        'monitoring',
      ],
    },
    monitoring: {
      enabled: process.env.LOG_MONITORING_ENABLED !== 'false',
      interval: parseInt(process.env.LOG_MONITORING_INTERVAL || '30000', 10),
      errorRateThreshold: parseFloat(
        process.env.LOG_ERROR_RATE_THRESHOLD || '0.1'
      ),
      responseTimeThreshold: parseInt(
        process.env.LOG_RESPONSE_TIME_THRESHOLD || '1000',
        10
      ),
    },
    retention: {
      days: parseInt(process.env.LOG_RETENTION_DAYS || '30', 10),
      autoCleanup: process.env.LOG_AUTO_CLEANUP !== 'false',
      cleanupInterval: parseInt(process.env.LOG_CLEANUP_INTERVAL || '24', 10),
    },
  },
};
