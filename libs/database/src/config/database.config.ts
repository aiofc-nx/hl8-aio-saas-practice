/**
 * @file database.config.ts
 * @description 数据库配置管理
 *
 * 该文件定义了数据库配置的加载和验证逻辑，包括：
 * - 数据库配置结构
 * - 配置验证规则
 * - 默认配置值
 * - 环境变量映射
 *
 * 遵循DDD和Clean Architecture原则，提供统一的配置管理。
 */

import { registerAs } from '@nestjs/config';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * @class DatabasePoolConfig
 * @description 数据库连接池配置
 */
export class DatabasePoolConfig {
  @IsNumber()
  min = 2;

  @IsNumber()
  max = 20;

  @IsNumber()
  acquireTimeoutMillis = 60000;

  @IsNumber()
  createTimeoutMillis = 30000;

  @IsNumber()
  destroyTimeoutMillis = 5000;

  @IsNumber()
  idleTimeoutMillis = 30000;

  @IsNumber()
  reapIntervalMillis = 1000;

  @IsNumber()
  createRetryIntervalMillis = 200;
}

/**
 * @class MikroOrmConfig
 * @description MikroORM配置
 */
export class MikroOrmConfig {
  @IsBoolean()
  @IsOptional()
  debug? = false;

  @IsString()
  @IsOptional()
  logger?: string;

  @ValidateNested()
  @Type(() => Object)
  migrations: {
    path: string;
    tableName: string;
  } = {
    path: 'src/migrations/*.migration{.ts,.js}',
    tableName: 'mikro_orm_migrations',
  };

  @IsString({ each: true })
  entities: string[] = ['src/**/*.entity{.ts,.js}'];
}

/**
 * @class DatabaseLoggingConfig
 * @description 数据库日志配置
 */
export class DatabaseLoggingConfig {
  @IsBoolean()
  enabled = false;

  @IsString()
  level = 'error';

  @IsNumber()
  slowQueryThreshold = 1000;
}

/**
 * @class DatabaseConfig
 * @description 数据库配置
 */
export class DatabaseConfig {
  @IsString()
  type: 'postgresql' | 'mysql' | 'mongodb' = 'postgresql';

  @IsString()
  host = 'localhost';

  @IsNumber()
  port = 5432;

  @IsString()
  username = 'postgres';

  @IsString()
  password = 'password';

  @IsString()
  database = 'aiofix_iam';

  @IsString()
  @IsOptional()
  schema?: string = 'public';

  @IsOptional()
  ssl?: boolean | { rejectUnauthorized: boolean } = false;

  @ValidateNested()
  @Type(() => Object)
  postgresql: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    schema: string;
    ssl: boolean;
    sslMode: string;
  } = {
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'password',
    database: 'aiofix_iam',
    schema: 'public',
    ssl: false,
    sslMode: 'prefer',
  };

  @ValidateNested()
  @Type(() => Object)
  mongodb: {
    uri: string;
    database: string;
    options: Record<string, any>;
  } = {
    uri: 'mongodb://localhost:27017/aiofix_iam_events',
    database: 'aiofix_iam_events',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  };

  @ValidateNested()
  @Type(() => DatabasePoolConfig)
  pool: DatabasePoolConfig = new DatabasePoolConfig();

  @ValidateNested()
  @Type(() => MikroOrmConfig)
  mikroOrm: MikroOrmConfig = new MikroOrmConfig();

  @ValidateNested()
  @Type(() => DatabaseLoggingConfig)
  logging: DatabaseLoggingConfig = new DatabaseLoggingConfig();
}

/**
 * @function databaseConfig
 * @description 数据库配置注册函数
 * @returns {Object} 配置对象
 */
export const databaseConfig = registerAs('database', (): DatabaseConfig => {
  const config = new DatabaseConfig();

  // 从环境变量加载配置
  const dbType = process.env.DB_TYPE as 'postgresql' | 'mysql' | 'mongodb';
  config.type =
    dbType && ['postgresql', 'mysql', 'mongodb'].includes(dbType)
      ? dbType
      : config.type;

  // 基础配置
  config.host = process.env.DB_HOST || config.host;
  config.port = parseInt(process.env.DB_PORT || config.port.toString(), 10);
  config.username = process.env.DB_USERNAME || config.username;
  config.password = process.env.DB_PASSWORD || config.password;
  config.database = process.env.DB_DATABASE || config.database;
  config.schema = process.env.DB_SCHEMA || config.schema;
  config.ssl = process.env.DB_SSL === 'true' || config.ssl;

  // PostgreSQL配置
  config.postgresql.host = process.env.DB_HOST || config.postgresql.host;
  config.postgresql.port = parseInt(
    process.env.DB_PORT || config.postgresql.port.toString(),
    10
  );
  config.postgresql.username =
    process.env.DB_USERNAME || config.postgresql.username;
  config.postgresql.password =
    process.env.DB_PASSWORD || config.postgresql.password;
  config.postgresql.database =
    process.env.DB_DATABASE || config.postgresql.database;
  config.postgresql.schema = process.env.DB_SCHEMA || config.postgresql.schema;
  config.postgresql.ssl =
    process.env.DB_SSL === 'true' || config.postgresql.ssl;
  config.postgresql.sslMode =
    process.env.DB_SSL_MODE || config.postgresql.sslMode;

  // MongoDB配置
  config.mongodb.uri = process.env.MONGODB_URI || config.mongodb.uri;
  config.mongodb.database =
    process.env.MONGODB_DATABASE || config.mongodb.database;

  // 连接池配置
  config.pool.min = parseInt(
    process.env.DB_POOL_MIN || config.pool.min.toString(),
    10
  );
  config.pool.max = parseInt(
    process.env.DB_POOL_MAX || config.pool.max.toString(),
    10
  );
  config.pool.acquireTimeoutMillis = parseInt(
    process.env.DB_POOL_ACQUIRE_TIMEOUT ||
      config.pool.acquireTimeoutMillis.toString(),
    10
  );
  config.pool.createTimeoutMillis = parseInt(
    process.env.DB_POOL_CREATE_TIMEOUT ||
      config.pool.createTimeoutMillis.toString(),
    10
  );
  config.pool.destroyTimeoutMillis = parseInt(
    process.env.DB_POOL_DESTROY_TIMEOUT ||
      config.pool.destroyTimeoutMillis.toString(),
    10
  );
  config.pool.idleTimeoutMillis = parseInt(
    process.env.DB_POOL_IDLE_TIMEOUT ||
      config.pool.idleTimeoutMillis.toString(),
    10
  );
  config.pool.reapIntervalMillis = parseInt(
    process.env.DB_POOL_REAP_INTERVAL ||
      config.pool.reapIntervalMillis.toString(),
    10
  );
  config.pool.createRetryIntervalMillis = parseInt(
    process.env.DB_POOL_CREATE_RETRY_INTERVAL ||
      config.pool.createRetryIntervalMillis.toString(),
    10
  );

  // MikroORM配置
  config.mikroOrm.debug =
    process.env.MIKRO_ORM_DEBUG === 'true' || config.mikroOrm.debug;
  config.mikroOrm.logger =
    process.env.MIKRO_ORM_LOGGER || config.mikroOrm.logger;
  config.mikroOrm.migrations.path =
    process.env.MIKRO_ORM_MIGRATIONS_PATH || config.mikroOrm.migrations.path;
  config.mikroOrm.migrations.tableName =
    process.env.MIKRO_ORM_MIGRATIONS_TABLE ||
    config.mikroOrm.migrations.tableName;

  // 日志配置
  config.logging.enabled =
    process.env.DB_LOGGING_ENABLED === 'true' || config.logging.enabled;
  config.logging.level = process.env.DB_LOGGING_LEVEL || config.logging.level;
  config.logging.slowQueryThreshold = parseInt(
    process.env.DB_SLOW_QUERY_THRESHOLD ||
      config.logging.slowQueryThreshold.toString(),
    10
  );

  return config;
});

/**
 * @constant DATABASE_CONFIG_KEY
 * @description 数据库配置键名
 */
export const DATABASE_CONFIG_KEY = 'database';
