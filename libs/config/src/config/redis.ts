import { registerAs } from '@nestjs/config';

/**
 * Redis Configuration
 *
 * Redis缓存配置模块，定义IAM系统的缓存策略和连接参数。
 * 支持多级缓存、分布式锁、会话存储等功能。
 *
 * 主要原理与机制如下：
 * 1. 使用@nestjs/config的registerAs创建命名空间配置
 * 2. 从环境变量读取Redis连接参数
 * 3. 提供默认值确保配置的完整性
 * 4. 支持集群和哨兵模式
 *
 * 功能与业务规则：
 * 1. Redis连接配置
 * 2. 缓存策略配置
 * 3. 分布式锁配置
 * 4. 会话存储配置
 *
 * @returns Redis配置对象
 */
export default registerAs('redis', () => ({
  /**
   * Redis连接配置
   */
  connection: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'aiofix:iam:',
  },

  /**
   * 连接池配置
   */
  pool: {
    min: parseInt(process.env.REDIS_POOL_MIN || '2', 10),
    max: parseInt(process.env.REDIS_POOL_MAX || '10', 10),
    acquireTimeoutMillis: parseInt(
      process.env.REDIS_ACQUIRE_TIMEOUT || '30000',
      10,
    ),
    createTimeoutMillis: parseInt(
      process.env.REDIS_CREATE_TIMEOUT || '30000',
      10,
    ),
    destroyTimeoutMillis: parseInt(
      process.env.REDIS_DESTROY_TIMEOUT || '5000',
      10,
    ),
    idleTimeoutMillis: parseInt(process.env.REDIS_IDLE_TIMEOUT || '30000', 10),
    reapIntervalMillis: parseInt(process.env.REDIS_REAP_INTERVAL || '1000', 10),
    createRetryIntervalMillis: parseInt(
      process.env.REDIS_CREATE_RETRY_INTERVAL || '200',
      10,
    ),
  },

  /**
   * 缓存策略配置
   */
  cache: {
    /**
     * 默认TTL（秒）
     */
    defaultTtl: parseInt(process.env.REDIS_DEFAULT_TTL || '3600', 10),

    /**
     * 用户会话TTL（秒）
     */
    sessionTtl: parseInt(process.env.REDIS_SESSION_TTL || '86400', 10),

    /**
     * 权限缓存TTL（秒）
     */
    permissionTtl: parseInt(process.env.REDIS_PERMISSION_TTL || '1800', 10),

    /**
     * 租户配置TTL（秒）
     */
    tenantConfigTtl: parseInt(
      process.env.REDIS_TENANT_CONFIG_TTL || '3600',
      10,
    ),

    /**
     * 最大内存使用量（字节）
     */
    maxMemory: process.env.REDIS_MAX_MEMORY || '2gb',

    /**
     * 内存策略
     */
    maxMemoryPolicy: process.env.REDIS_MAX_MEMORY_POLICY || 'allkeys-lru',
  },

  /**
   * 分布式锁配置
   */
  lock: {
    /**
     * 锁默认超时时间（毫秒）
     */
    defaultTimeout: parseInt(process.env.REDIS_LOCK_TIMEOUT || '30000', 10),

    /**
     * 锁重试间隔（毫秒）
     */
    retryDelay: parseInt(process.env.REDIS_LOCK_RETRY_DELAY || '100', 10),

    /**
     * 锁重试次数
     */
    retryCount: parseInt(process.env.REDIS_LOCK_RETRY_COUNT || '10', 10),
  },

  /**
   * 集群配置
   */
  cluster: {
    enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
    nodes: process.env.REDIS_CLUSTER_NODES?.split(',') || [],
    maxRedirections: parseInt(
      process.env.REDIS_CLUSTER_MAX_REDIRECTIONS || '16',
      10,
    ),
  },

  /**
   * 哨兵配置
   */
  sentinel: {
    enabled: process.env.REDIS_SENTINEL_ENABLED === 'true',
    masterName: process.env.REDIS_SENTINEL_MASTER_NAME || 'mymaster',
    sentinels: process.env.REDIS_SENTINEL_HOSTS?.split(',') || [],
    password: process.env.REDIS_SENTINEL_PASSWORD || undefined,
  },

  /**
   * 健康检查配置
   */
  health: {
    enabled: process.env.REDIS_HEALTH_CHECK_ENABLED !== 'false',
    interval: parseInt(process.env.REDIS_HEALTH_CHECK_INTERVAL || '30000', 10),
    timeout: parseInt(process.env.REDIS_HEALTH_CHECK_TIMEOUT || '5000', 10),
  },
}));
