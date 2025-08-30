/**
 * @file database.interface.ts
 * @description 数据库适配器核心接口定义
 *
 * 该文件定义了数据库适配器的核心接口，包括：
 * - 数据库连接接口
 * - 数据库适配器接口
 * - 数据库健康检查接口
 * - 数据库统计接口
 * - 数据库配置接口
 *
 * 遵循DDD和Clean Architecture原则，提供统一的数据库抽象层。
 */

import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Connection, QueryResult } from 'pg';
import type { Knex } from 'knex';
import type { Connection as MikroOrmConnection } from '@mikro-orm/core';

/**
 * @interface DatabaseConnection
 * @description 数据库连接接口
 */
export interface DatabaseConnection {
  /** 连接ID */
  id: string;
  /** 连接状态 */
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  /** 连接配置 */
  config: DatabaseConfig;
  /** 连接实例 */
  instance: Connection | Knex | MikroOrmConnection;
  /** 最后活动时间 */
  lastActivity: Date;
  /** 错误信息 */
  error?: string;
}

/**
 * @interface DatabaseConfig
 * @description 数据库配置接口
 */
export interface DatabaseConfig {
  /** 数据库类型 */
  type: 'postgresql' | 'mysql' | 'mongodb';
  /** 主机地址 */
  host: string;
  /** 端口 */
  port: number;
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
  /** 数据库名 */
  database: string;
  /** 模式名（PostgreSQL） */
  schema?: string;
  /** SSL配置 */
  ssl?: boolean | { rejectUnauthorized: boolean };
  /** 连接池配置 */
  pool?: {
    min: number;
    max: number;
    acquireTimeoutMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
    idleTimeoutMillis: number;
    reapIntervalMillis: number;
    createRetryIntervalMillis: number;
  };
  /** 其他配置选项 */
  options?: Record<string, any>;
}

/**
 * @interface DatabaseHealth
 * @description 数据库健康状态接口
 */
export interface DatabaseHealth {
  /** 是否健康 */
  healthy: boolean;
  /** 是否连接 */
  connected: boolean;
  /** 响应时间（毫秒） */
  responseTime: number;
  /** 错误信息 */
  error?: string;
  /** 最后检查时间 */
  lastCheck: Date;
  /** 连接池状态 */
  poolStatus?: {
    total: number;
    idle: number;
    active: number;
    waiting: number;
  };
}

/**
 * @interface DatabaseStats
 * @description 数据库统计信息接口
 */
export interface DatabaseStats {
  /** 总查询数 */
  totalQueries: number;
  /** 成功查询数 */
  successfulQueries: number;
  /** 失败查询数 */
  failedQueries: number;
  /** 平均响应时间 */
  averageResponseTime: number;
  /** 最大响应时间 */
  maxResponseTime: number;
  /** 最小响应时间 */
  minResponseTime: number;
  /** 活跃连接数 */
  activeConnections: number;
  /** 空闲连接数 */
  idleConnections: number;
  /** 最后重置时间 */
  lastReset: Date;
}

/**
 * @interface QueryOptions
 * @description 查询选项接口
 */
export interface QueryOptions {
  /** 查询超时时间 */
  timeout?: number;
  /** 是否使用事务 */
  transaction?: boolean;
  /** 查询参数 */
  params?: any[];
  /** 查询标签 */
  tag?: string;
  /** 是否记录查询 */
  logQuery?: boolean;
}

/**
 * @interface TransactionOptions
 * @description 事务选项接口
 */
export interface TransactionOptions {
  /** 事务隔离级别 */
  isolationLevel?:
    | 'read uncommitted'
    | 'read committed'
    | 'repeatable read'
    | 'serializable';
  /** 事务超时时间 */
  timeout?: number;
  /** 是否只读 */
  readOnly?: boolean;
  /** 事务标签 */
  tag?: string;
}

/**
 * @interface IDatabaseAdapter
 * @description 数据库适配器接口
 *
 * 提供统一的数据库操作接口，支持：
 * - 连接管理
 * - 查询执行
 * - 事务管理
 * - 健康检查
 * - 统计监控
 * - 事件通知
 */
export interface IDatabaseAdapter {
  /** 适配器名称 */
  readonly name: string;
  /** 数据库类型 */
  readonly type: string;
  /** 是否已连接 */
  readonly isConnected: boolean;
  /** 配置信息 */
  readonly config: DatabaseConfig;
  /** 事件发射器 */
  readonly eventEmitter: EventEmitter2;

  /**
   * @method connect
   * @description 连接到数据库
   * @returns {Promise<void>} 连接结果
   */
  connect(): Promise<void>;

  /**
   * @method disconnect
   * @description 断开数据库连接
   * @returns {Promise<void>} 断开结果
   */
  disconnect(): Promise<void>;

  /**
   * @method query
   * @description 执行查询
   * @param sql SQL语句
   * @param params 查询参数
   * @param options 查询选项
   * @returns {Promise<QueryResult>} 查询结果
   */
  query(
    sql: string,
    params?: any[],
    options?: QueryOptions,
  ): Promise<QueryResult>;

  /**
   * @method execute
   * @description 执行命令
   * @param sql SQL语句
   * @param params 参数
   * @param options 执行选项
   * @returns {Promise<QueryResult>} 执行结果
   */
  execute(
    sql: string,
    params?: any[],
    options?: QueryOptions,
  ): Promise<QueryResult>;

  /**
   * @method transaction
   * @description 执行事务
   * @param callback 事务回调函数
   * @param options 事务选项
   * @returns {Promise<T>} 事务结果
   */
  transaction<T>(
    callback: (trx: any) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T>;

  /**
   * @method getHealth
   * @description 获取健康状态
   * @returns {Promise<DatabaseHealth>} 健康状态
   */
  getHealth(): Promise<DatabaseHealth>;

  /**
   * @method getStats
   * @description 获取统计信息
   * @returns {Promise<DatabaseStats>} 统计信息
   */
  getStats(): Promise<DatabaseStats>;

  /**
   * @method resetStats
   * @description 重置统计信息
   * @returns {Promise<void>} 重置结果
   */
  resetStats(): Promise<void>;

  /**
   * @method getConnection
   * @description 获取数据库连接
   * @returns {Promise<DatabaseConnection>} 数据库连接
   */
  getConnection(): Promise<DatabaseConnection>;

  /**
   * @method ping
   * @description 数据库连接测试
   * @returns {Promise<boolean>} 测试结果
   */
  ping(): Promise<boolean>;
}

/**
 * @interface IDatabaseManager
 * @description 数据库管理器接口
 *
 * 管理多个数据库适配器，提供：
 * - 多数据库支持
 * - 负载均衡
 * - 故障转移
 * - 连接池管理
 * - 监控统计
 */
export interface IDatabaseManager {
  /** 管理器名称 */
  readonly name: string;
  /** 适配器数量 */
  readonly adapterCount: number;
  /** 是否已初始化 */
  readonly isInitialized: boolean;

  /**
   * @method addAdapter
   * @description 添加数据库适配器
   * @param name 适配器名称
   * @param adapter 适配器实例
   * @returns {boolean} 是否成功
   */
  addAdapter(name: string, adapter: IDatabaseAdapter): boolean;

  /**
   * @method removeAdapter
   * @description 移除数据库适配器
   * @param name 适配器名称
   * @returns {boolean} 是否成功
   */
  removeAdapter(name: string): boolean;

  /**
   * @method getAdapter
   * @description 获取数据库适配器
   * @param name 适配器名称
   * @returns {IDatabaseAdapter | undefined} 适配器实例
   */
  getAdapter(name: string): IDatabaseAdapter | undefined;

  /**
   * @method getDefaultAdapter
   * @description 获取默认适配器
   * @returns {IDatabaseAdapter | undefined} 默认适配器
   */
  getDefaultAdapter(): IDatabaseAdapter | undefined;

  /**
   * @method connectAll
   * @description 连接所有适配器
   * @returns {Promise<void>} 连接结果
   */
  connectAll(): Promise<void>;

  /**
   * @method disconnectAll
   * @description 断开所有适配器
   * @returns {Promise<void>} 断开结果
   */
  disconnectAll(): Promise<void>;

  /**
   * @method getHealth
   * @description 获取所有适配器健康状态
   * @returns {Promise<Record<string, DatabaseHealth>>} 健康状态映射
   */
  getHealth(): Promise<Record<string, DatabaseHealth>>;

  /**
   * @method getStats
   * @description 获取所有适配器统计信息
   * @returns {Promise<Record<string, DatabaseStats>>} 统计信息映射
   */
  getStats(): Promise<Record<string, DatabaseStats>>;
}

/**
 * @interface IDatabaseFactory
 * @description 数据库工厂接口
 *
 * 负责创建和管理数据库适配器实例，提供：
 * - 适配器创建
 * - 配置验证
 * - 连接池管理
 * - 实例缓存
 */
export interface IDatabaseFactory {
  /**
   * @method createAdapter
   * @description 创建数据库适配器
   * @param config 数据库配置
   * @returns {Promise<IDatabaseAdapter>} 适配器实例
   */
  createAdapter(config: DatabaseConfig): Promise<IDatabaseAdapter>;

  /**
   * @method createManager
   * @description 创建数据库管理器
   * @param configs 数据库配置映射
   * @returns {Promise<IDatabaseManager>} 管理器实例
   */
  createManager(
    configs: Record<string, DatabaseConfig>,
  ): Promise<IDatabaseManager>;

  /**
   * @method validateConfig
   * @description 验证数据库配置
   * @param config 数据库配置
   * @returns {boolean} 是否有效
   */
  validateConfig(config: DatabaseConfig): boolean;
}
