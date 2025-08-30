import { registerAs } from '@nestjs/config';

/**
 * Database Configuration
 *
 * 数据库配置模块，定义IAM系统的数据库连接和配置参数。
 * 支持PostgreSQL作为主数据库，MongoDB作为事件存储。
 *
 * 主要原理与机制如下：
 * 1. 使用@nestjs/config的registerAs创建命名空间配置
 * 2. 从环境变量读取数据库连接参数
 * 3. 提供默认值确保配置的完整性
 * 4. 支持多环境配置（开发、测试、生产）
 *
 * 功能与业务规则：
 * 1. PostgreSQL主数据库配置
 * 2. MongoDB事件存储配置
 * 3. 连接池和性能优化配置
 * 4. 数据库迁移和同步配置
 *
 * @returns 数据库配置对象
 */
export default registerAs('database', () => ({
  /**
   * 主数据库类型
   */
  type: process.env.DB_TYPE || 'postgresql',

  /**
   * PostgreSQL主数据库配置
   */
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

  /**
   * MongoDB事件存储配置
   */
  mongodb: {
    uri:
      process.env.MONGODB_URI || 'mongodb://localhost:27017/aiofix_iam_events',
    database: process.env.MONGODB_DATABASE || 'aiofix_iam_events',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },

  /**
   * 连接池配置
   */
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    acquireTimeoutMillis: parseInt(
      process.env.DB_ACQUIRE_TIMEOUT || '60000',
      10,
    ),
    createTimeoutMillis: parseInt(process.env.DB_CREATE_TIMEOUT || '30000', 10),
    destroyTimeoutMillis: parseInt(
      process.env.DB_DESTROY_TIMEOUT || '5000',
      10,
    ),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL || '1000', 10),
    createRetryIntervalMillis: parseInt(
      process.env.DB_CREATE_RETRY_INTERVAL || '200',
      10,
    ),
  },

  /**
   * 同步和迁移配置
   */
  sync: {
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    migrationsRun: process.env.DB_MIGRATIONS_RUN !== 'false',
    migrationsDir: process.env.DB_MIGRATIONS_DIR || 'src/migrations',
    migrationsTableName: process.env.DB_MIGRATIONS_TABLE || 'migrations',
  },

  /**
   * 日志配置
   */
  logging: {
    enabled: process.env.DB_LOGGING === 'true',
    level: process.env.DB_LOG_LEVEL || 'error',
    slowQueryThreshold: parseInt(
      process.env.DB_SLOW_QUERY_THRESHOLD || '1000',
      10,
    ),
  },
}));
