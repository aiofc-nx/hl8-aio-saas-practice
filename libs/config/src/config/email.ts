import { registerAs } from '@nestjs/config';

/**
 * Email Configuration
 *
 * 邮件配置模块，定义IAM系统的邮件服务参数和模板配置。
 * 支持SMTP、SendGrid、AWS SES等多种邮件服务提供商。
 *
 * 主要原理与机制如下：
 * 1. 使用@nestjs/config的registerAs创建命名空间配置
 * 2. 从环境变量读取邮件服务参数
 * 3. 提供默认值确保配置的完整性
 * 4. 支持多邮件服务提供商
 *
 * 功能与业务规则：
 * 1. SMTP邮件服务配置
 * 2. 邮件模板配置
 * 3. 邮件发送策略
 * 4. 邮件验证配置
 *
 * @returns 邮件配置对象
 */
export default registerAs('email', () => ({
  /**
   * 邮件服务提供商
   */
  provider: process.env.EMAIL_PROVIDER || 'smtp',

  /**
   * SMTP配置
   */
  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
    },
  },

  /**
   * SendGrid配置
   */
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || '',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@aiofix.com',
    fromName: process.env.SENDGRID_FROM_NAME || 'Aiofix IAM',
  },

  /**
   * AWS SES配置
   */
  ses: {
    region: process.env.AWS_SES_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || '',
    fromEmail: process.env.AWS_SES_FROM_EMAIL || 'noreply@aiofix.com',
    fromName: process.env.AWS_SES_FROM_NAME || 'Aiofix IAM',
  },

  /**
   * 邮件发送配置
   */
  sending: {
    /**
     * 默认发件人邮箱
     */
    fromEmail: process.env.EMAIL_FROM || 'noreply@aiofix.com',

    /**
     * 默认发件人名称
     */
    fromName: process.env.EMAIL_FROM_NAME || 'Aiofix IAM',

    /**
     * 回复邮箱
     */
    replyTo: process.env.EMAIL_REPLY_TO || 'support@aiofix.com',

    /**
     * 批量发送间隔（毫秒）
     */
    batchInterval: parseInt(process.env.EMAIL_BATCH_INTERVAL || '1000', 10),

    /**
     * 批量发送大小
     */
    batchSize: parseInt(process.env.EMAIL_BATCH_SIZE || '10', 10),

    /**
     * 重试次数
     */
    retryCount: parseInt(process.env.EMAIL_RETRY_COUNT || '3', 10),

    /**
     * 重试间隔（毫秒）
     */
    retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY || '5000', 10),
  },

  /**
   * 邮件模板配置
   */
  templates: {
    /**
     * 模板目录
     */
    directory: process.env.EMAIL_TEMPLATES_DIR || 'src/templates/email',

    /**
     * 默认语言
     */
    defaultLanguage: process.env.EMAIL_DEFAULT_LANGUAGE || 'zh-CN',

    /**
     * 支持的语言列表
     */
    supportedLanguages: process.env.EMAIL_SUPPORTED_LANGUAGES?.split(',') || [
      'zh-CN',
      'en-US',
    ],
  },

  /**
   * 邮件类型配置
   */
  types: {
    /**
     * 邮箱验证邮件
     */
    emailVerification: {
      subject: process.env.EMAIL_VERIFICATION_SUBJECT || '邮箱验证',
      template: process.env.EMAIL_VERIFICATION_TEMPLATE || 'email-verification',
      enabled: process.env.EMAIL_VERIFICATION_ENABLED !== 'false',
    },

    /**
     * 密码重置邮件
     */
    passwordReset: {
      subject: process.env.EMAIL_PASSWORD_RESET_SUBJECT || '密码重置',
      template: process.env.EMAIL_PASSWORD_RESET_TEMPLATE || 'password-reset',
      enabled: process.env.EMAIL_PASSWORD_RESET_ENABLED !== 'false',
    },

    /**
     * 欢迎邮件
     */
    welcome: {
      subject: process.env.EMAIL_WELCOME_SUBJECT || '欢迎加入Aiofix IAM',
      template: process.env.EMAIL_WELCOME_TEMPLATE || 'welcome',
      enabled: process.env.EMAIL_WELCOME_ENABLED !== 'false',
    },

    /**
     * 邀请邮件
     */
    invitation: {
      subject: process.env.EMAIL_INVITATION_SUBJECT || '邀请加入组织',
      template: process.env.EMAIL_INVITATION_TEMPLATE || 'invitation',
      enabled: process.env.EMAIL_INVITATION_ENABLED !== 'false',
    },

    /**
     * 通知邮件
     */
    notification: {
      subject: process.env.EMAIL_NOTIFICATION_SUBJECT || '系统通知',
      template: process.env.EMAIL_NOTIFICATION_TEMPLATE || 'notification',
      enabled: process.env.EMAIL_NOTIFICATION_ENABLED !== 'false',
    },
  },

  /**
   * 邮件验证配置
   */
  verification: {
    /**
     * 是否启用邮件验证
     */
    enabled: process.env.EMAIL_VERIFICATION_ENABLED !== 'false',

    /**
     * 验证链接有效期（秒）
     */
    linkExpiresIn: parseInt(
      process.env.EMAIL_VERIFICATION_LINK_EXPIRES_IN || '86400',
      10,
    ), // 24小时

    /**
     * 验证码有效期（秒）
     */
    codeExpiresIn: parseInt(
      process.env.EMAIL_VERIFICATION_CODE_EXPIRES_IN || '1800',
      10,
    ), // 30分钟

    /**
     * 验证码长度
     */
    codeLength: parseInt(process.env.EMAIL_VERIFICATION_CODE_LENGTH || '6', 10),
  },

  /**
   * 邮件队列配置
   */
  queue: {
    /**
     * 是否启用邮件队列
     */
    enabled: process.env.EMAIL_QUEUE_ENABLED !== 'false',

    /**
     * 队列名称
     */
    name: process.env.EMAIL_QUEUE_NAME || 'email',

    /**
     * 队列优先级
     */
    priority: parseInt(process.env.EMAIL_QUEUE_PRIORITY || '10', 10),

    /**
     * 队列延迟（毫秒）
     */
    delay: parseInt(process.env.EMAIL_QUEUE_DELAY || '0', 10),
  },
}));
