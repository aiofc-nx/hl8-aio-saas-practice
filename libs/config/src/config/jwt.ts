import { registerAs } from '@nestjs/config';

/**
 * JWT Configuration
 *
 * JWT认证配置模块，定义IAM系统的JWT令牌策略和安全参数。
 * 支持访问令牌、刷新令牌、多租户令牌等功能。
 *
 * 主要原理与机制如下：
 * 1. 使用@nestjs/config的registerAs创建命名空间配置
 * 2. 从环境变量读取JWT安全参数
 * 3. 提供默认值确保配置的完整性
 * 4. 支持多环境的安全策略
 *
 * 功能与业务规则：
 * 1. JWT密钥配置
 * 2. 令牌过期时间配置
 * 3. 令牌刷新策略
 * 4. 多租户令牌支持
 *
 * @returns JWT配置对象
 */
export default registerAs('jwt', () => ({
  /**
   * JWT密钥配置
   */
  secret: {
    /**
     * 访问令牌密钥
     */
    accessToken:
      process.env.JWT_ACCESS_TOKEN_SECRET ||
      'your-super-secret-access-token-key',

    /**
     * 刷新令牌密钥
     */
    refreshToken:
      process.env.JWT_REFRESH_TOKEN_SECRET ||
      'your-super-secret-refresh-token-key',

    /**
     * 重置密码令牌密钥
     */
    resetPassword:
      process.env.JWT_RESET_PASSWORD_SECRET ||
      'your-super-secret-reset-password-key',

    /**
     * 邮箱验证令牌密钥
     */
    emailVerification:
      process.env.JWT_EMAIL_VERIFICATION_SECRET ||
      'your-super-secret-email-verification-key',
  },

  /**
   * 访问令牌配置
   */
  accessToken: {
    /**
     * 过期时间（秒）
     */
    expiresIn: parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '3600', 10), // 1小时

    /**
     * 算法
     */
    algorithm: process.env.JWT_ACCESS_TOKEN_ALGORITHM || 'HS256',

    /**
     * 发行者
     */
    issuer: process.env.JWT_ISSUER || 'aiofix-iam',

    /**
     * 受众
     */
    audience: process.env.JWT_AUDIENCE || 'aiofix-users',
  },

  /**
   * 刷新令牌配置
   */
  refreshToken: {
    /**
     * 过期时间（秒）
     */
    expiresIn: parseInt(
      process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '2592000',
      10,
    ), // 30天

    /**
     * 算法
     */
    algorithm: process.env.JWT_REFRESH_TOKEN_ALGORITHM || 'HS256',

    /**
     * 发行者
     */
    issuer: process.env.JWT_ISSUER || 'aiofix-iam',

    /**
     * 受众
     */
    audience: process.env.JWT_AUDIENCE || 'aiofix-users',
  },

  /**
   * 重置密码令牌配置
   */
  resetPassword: {
    /**
     * 过期时间（秒）
     */
    expiresIn: parseInt(
      process.env.JWT_RESET_PASSWORD_EXPIRES_IN || '3600',
      10,
    ), // 1小时

    /**
     * 算法
     */
    algorithm: process.env.JWT_RESET_PASSWORD_ALGORITHM || 'HS256',
  },

  /**
   * 邮箱验证令牌配置
   */
  emailVerification: {
    /**
     * 过期时间（秒）
     */
    expiresIn: parseInt(
      process.env.JWT_EMAIL_VERIFICATION_EXPIRES_IN || '86400',
      10,
    ), // 24小时

    /**
     * 算法
     */
    algorithm: process.env.JWT_EMAIL_VERIFICATION_ALGORITHM || 'HS256',
  },

  /**
   * 多租户配置
   */
  multiTenant: {
    /**
     * 是否启用多租户令牌
     */
    enabled: process.env.JWT_MULTI_TENANT_ENABLED !== 'false',

    /**
     * 租户ID字段名
     */
    tenantIdField: process.env.JWT_TENANT_ID_FIELD || 'tenantId',

    /**
     * 组织ID字段名
     */
    organizationIdField:
      process.env.JWT_ORGANIZATION_ID_FIELD || 'organizationId',

    /**
     * 部门ID字段名
     */
    departmentIdField: process.env.JWT_DEPARTMENT_ID_FIELD || 'departmentId',
  },

  /**
   * 安全配置
   */
  security: {
    /**
     * 是否启用令牌黑名单
     */
    blacklistEnabled: process.env.JWT_BLACKLIST_ENABLED !== 'false',

    /**
     * 黑名单TTL（秒）
     */
    blacklistTtl: parseInt(process.env.JWT_BLACKLIST_TTL || '86400', 10), // 24小时

    /**
     * 是否启用令牌轮换
     */
    rotationEnabled: process.env.JWT_ROTATION_ENABLED !== 'false',

    /**
     * 轮换阈值（秒）
     */
    rotationThreshold: parseInt(
      process.env.JWT_ROTATION_THRESHOLD || '300',
      10,
    ), // 5分钟
  },

  /**
   * 缓存配置
   */
  cache: {
    /**
     * 是否启用令牌缓存
     */
    enabled: process.env.JWT_CACHE_ENABLED !== 'false',

    /**
     * 缓存TTL（秒）
     */
    ttl: parseInt(process.env.JWT_CACHE_TTL || '300', 10), // 5分钟

    /**
     * 缓存前缀
     */
    prefix: process.env.JWT_CACHE_PREFIX || 'jwt:',
  },
}));
