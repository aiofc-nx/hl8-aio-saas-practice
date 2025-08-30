import { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import {
  PostgreSqlDriver,
  Options as MikroOrmPostgreSqlOptions,
} from '@mikro-orm/postgresql';
import { KnexModuleOptions } from 'nest-knexjs';
import * as chalk from 'chalk';

/**
 * @enum DatabaseTypeEnum
 * @description
 * 数据库类型枚举，定义了系统支持的数据库类型。
 * 目前主要支持PostgreSQL，其他数据库类型为预留接口。
 *
 * 主要原理与机制如下：
 * 1. 使用TypeScript枚举定义数据库类型常量
 * 2. 提供类型安全的数据库类型选择
 * 3. 支持未来扩展其他数据库类型
 * 4. 与配置系统集成，支持动态数据库选择
 *
 * 功能与业务规则：
 * 1. 数据库类型定义
 * 2. 类型安全保证
 * 3. 配置验证支持
 * 4. 扩展性设计
 */
export enum DatabaseTypeEnum {
  /** PostgreSQL数据库 */
  postgresql = 'postgresql',
  /** MySQL数据库（预留） */
  mysql = 'mysql',
  /** SQLite数据库（预留） */
  sqlite = 'sqlite',
  /** MongoDB数据库（预留） */
  mongodb = 'mongodb',
}

/**
 * @type MultiORM
 * @description
 * ORM类型定义，支持多种ORM框架。
 * 目前主要使用MikroORM，TypeORM为预留选项。
 *
 * @typedef {'typeorm' | 'mikro-orm'} MultiORM
 */
export type MultiORM = 'typeorm' | 'mikro-orm';

/**
 * @enum MultiORMEnum
 * @description
 * ORM类型枚举，定义了系统支持的ORM框架类型。
 *
 * 主要原理与机制如下：
 * 1. 使用TypeScript枚举定义ORM类型常量
 * 2. 提供类型安全的ORM选择
 * 3. 支持多ORM框架切换
 * 4. 与配置系统集成
 *
 * 功能与业务规则：
 * 1. ORM类型定义
 * 2. 类型安全保证
 * 3. 配置验证支持
 * 4. 框架切换支持
 */
enum MultiORMEnum {
  /** TypeORM框架（预留） */
  TypeORM = 'typeorm',
  /** MikroORM框架（主要使用） */
  MikroORM = 'mikro-orm',
}

/**
 * @function getORMType
 * @description
 * 获取ORM类型，从环境变量中读取ORM配置，如果未设置则使用默认值。
 *
 * 主要原理与机制如下：
 * 1. 从环境变量DB_ORM中读取ORM类型
 * 2. 如果环境变量未设置，使用默认值
 * 3. 返回类型安全的ORM类型
 * 4. 支持运行时ORM框架切换
 *
 * 功能与业务规则：
 * 1. ORM类型获取
 * 2. 默认值处理
 * 3. 类型安全保证
 * 4. 环境配置支持
 *
 * @param {MultiORM} defaultValue - 默认ORM类型，默认为TypeORM
 * @returns {MultiORM} 返回ORM类型
 */
function getORMType(defaultValue: MultiORM = MultiORMEnum.TypeORM): MultiORM {
  return (process.env.DB_ORM as MultiORM) || defaultValue;
}

/**
 * @function getTlsOptions
 * @description
 * 获取TLS配置选项，根据SSL模式返回相应的TLS配置。
 *
 * 主要原理与机制如下：
 * 1. 根据sslMode参数决定是否启用TLS
 * 2. 启用时返回rejectUnauthorized: false配置
 * 3. 禁用时返回false
 * 4. 支持开发和生产环境的SSL配置
 *
 * 功能与业务规则：
 * 1. TLS配置生成
 * 2. SSL模式支持
 * 3. 安全连接配置
 * 4. 环境适配
 *
 * @param {boolean} sslMode - SSL模式标志
 * @returns {object | boolean} 返回TLS配置对象或false
 */
function getTlsOptions(sslMode: boolean) {
  return sslMode ? { rejectUnauthorized: false } : false;
}

/**
 * @function getLoggingMikroOptions
 * @description
 * 获取MikroORM日志配置选项，专门为MikroORM框架配置日志。
 *
 * 主要原理与机制如下：
 * 1. 根据DB_LOGGING环境变量决定是否启用调试模式
 * 2. 启用时配置console.log作为日志器
 * 3. 支持MikroORM的调试输出
 * 4. 提供开发环境的详细ORM日志
 *
 * 功能与业务规则：
 * 1. MikroORM日志配置
 * 2. 调试模式支持
 * 3. 日志器配置
 * 4. 开发环境支持
 *
 * @returns {object} 返回MikroORM日志配置对象
 */
function getLoggingMikroOptions() {
  return {
    debug: process.env.DB_LOGGING === 'true',
    logger:
      process.env.DB_LOGGING === 'true' ? console.log.bind(console) : undefined,
  };
}

console.log(chalk.magenta(`NodeJs Version %s`), process.version);
console.log('Is DEMO: %s', process.env.DEMO);
console.log('NODE_ENV: %s', process.env.NODE_ENV);

const dbORM: MultiORM = getORMType();
console.log('DB ORM: %s', dbORM);

const dbType = process.env.DB_TYPE || DatabaseTypeEnum.postgresql;
console.log(`Selected DB Type (DB_TYPE env var): ${dbType}`);
console.log('DB Synchronize: ' + process.env.DB_SYNCHRONIZE);

// 连接池配置
const dbPoolSize = process.env.DB_POOL_SIZE
  ? parseInt(process.env.DB_POOL_SIZE)
  : 40;
const dbPoolSizeKnex = process.env.DB_POOL_SIZE_KNEX
  ? parseInt(process.env.DB_POOL_SIZE_KNEX)
  : 10;
const dbConnectionTimeout = process.env.DB_CONNECTION_TIMEOUT
  ? parseInt(process.env.DB_CONNECTION_TIMEOUT)
  : 5000;
const idleTimeoutMillis = process.env.DB_IDLE_TIMEOUT
  ? parseInt(process.env.DB_IDLE_TIMEOUT)
  : 10000;
const dbSlowQueryLoggingTimeout = process.env.DB_SLOW_QUERY_LOGGING_TIMEOUT
  ? parseInt(process.env.DB_SLOW_QUERY_LOGGING_TIMEOUT)
  : 10000;
const dbSslMode = process.env.DB_SSL_MODE === 'true';

console.log('DB ORM Pool Size: ' + dbPoolSize);
console.log('DB Knex Pool Size: ' + dbPoolSizeKnex);
console.log('DB Connection Timeout: ' + dbConnectionTimeout);
console.log('DB Idle Timeout: ' + idleTimeoutMillis);
console.log('DB Slow Query Logging Timeout: ' + dbSlowQueryLoggingTimeout);
console.log('DB SSL Mode: ' + process.env.DB_SSL_MODE);
console.log('DB SSL MODE ENABLE: ' + dbSslMode);

let mikroOrmConnectionConfig: MikroOrmModuleOptions;
let knexConnectionConfig: KnexModuleOptions;

// PostgreSQL配置
if (dbType === DatabaseTypeEnum.postgresql) {
  // MikroORM PostgreSQL配置
  const mikroOrmPostgresConfig: MikroOrmPostgreSqlOptions = {
    driver: PostgreSqlDriver,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    dbName: process.env.DB_NAME || 'aiofix_iam',
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASS || 'password',
    schema: process.env.DB_SCHEMA || 'public',
    migrations: {
      path: 'src/migrations/*.migration{.ts,.js}',
    },
    entities: ['src/**/*.entity{.ts,.js}'],
    driverOptions: {
      connection: {
        ssl: getTlsOptions(dbSslMode),
      },
    },
    pool: {
      min: 2,
      max: dbPoolSize,
      acquireTimeoutMillis: dbConnectionTimeout,
      createTimeoutMillis: dbConnectionTimeout,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: idleTimeoutMillis,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    },
    ...getLoggingMikroOptions(),
  };

  mikroOrmConnectionConfig = mikroOrmPostgresConfig;

  // Knex PostgreSQL配置
  knexConnectionConfig = {
    config: {
      client: 'pg',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
        user: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASS || 'password',
        database: process.env.DB_NAME || 'aiofix_iam',
        ssl: getTlsOptions(dbSslMode),
      },
      pool: {
        min: 2,
        max: dbPoolSizeKnex,
        acquireTimeoutMillis: dbConnectionTimeout,
        createTimeoutMillis: dbConnectionTimeout,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: idleTimeoutMillis,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200,
      },
      migrations: {
        directory: 'src/migrations',
        tableName: 'knex_migrations',
      },
      seeds: {
        directory: 'src/seeds',
      },
      debug: process.env.DB_LOGGING === 'true',
    },
  };
} else {
  throw new Error(
    `Database type ${dbType} is not supported yet. Only PostgreSQL is supported.`
  );
}

/**
 * @constant dbMikroOrmConnectionConfig
 * @description
 * MikroORM连接配置，用于数据库连接和ORM操作。
 * 该配置包含了PostgreSQL数据库的连接参数、连接池设置、日志配置等。
 *
 * 主要原理与机制如下：
 * 1. 使用PostgreSqlDriver作为数据库驱动
 * 2. 配置连接池参数，优化性能
 * 3. 支持SSL连接和日志输出
 * 4. 配置实体和迁移文件路径
 *
 * 功能与业务规则：
 * 1. 数据库连接配置
 * 2. 连接池管理
 * 3. 日志和调试支持
 * 4. 实体和迁移管理
 *
 * @type {MikroOrmModuleOptions}
 */
export const dbMikroOrmConnectionConfig: MikroOrmModuleOptions =
  mikroOrmConnectionConfig;

/**
 * @constant dbKnexConnectionConfig
 * @description
 * Knex连接配置，用于复杂查询和数据库迁移。
 * 该配置提供了对数据库的底层访问能力，支持原生SQL查询。
 *
 * 主要原理与机制如下：
 * 1. 使用pg客户端连接PostgreSQL
 * 2. 配置连接池和超时参数
 * 3. 支持迁移和种子数据管理
 * 4. 提供调试模式支持
 *
 * 功能与业务规则：
 * 1. 复杂查询支持
 * 2. 数据库迁移管理
 * 3. 种子数据管理
 * 4. 调试和监控支持
 *
 * @type {KnexModuleOptions}
 */
export const dbKnexConnectionConfig: KnexModuleOptions = knexConnectionConfig;
