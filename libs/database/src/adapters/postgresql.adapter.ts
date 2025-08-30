/**
 * @file postgresql.adapter.ts
 * @description PostgreSQL数据库适配器实现
 *
 * 该文件实现了PostgreSQL数据库适配器，包括：
 * - 连接管理
 * - 查询执行
 * - 事务管理
 * - 健康检查
 * - 统计监控
 * - 事件通知
 *
 * 遵循DDD和Clean Architecture原则，提供统一的数据库操作接口。
 */

import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { Pool, QueryResult } from 'pg';
import { Knex, knex } from 'knex';
import { PinoLoggerService, LogContext } from '@aiofix/logging';
import type {
  IDatabaseAdapter,
  DatabaseConfig,
  DatabaseConnection,
  DatabaseHealth,
  DatabaseStats,
  QueryOptions,
  TransactionOptions,
} from '../interfaces/database.interface';
import type { Connection } from 'pg';
import type { Connection as MikroOrmConnection } from '@mikro-orm/core';

/**
 * @class PostgreSQLAdapter
 * @description PostgreSQL数据库适配器
 *
 * 提供PostgreSQL数据库的统一操作接口，支持：
 * - 原生pg连接池
 * - Knex查询构建器
 * - 连接池管理
 * - 健康检查
 * - 性能监控
 * - 事件通知
 *
 * @implements {IDatabaseAdapter}
 */
@Injectable()
export class PostgreSQLAdapter implements IDatabaseAdapter {
  public readonly name: string;
  public readonly type: string = 'postgresql';
  public readonly eventEmitter: EventEmitter2;
  public readonly config: DatabaseConfig;

  private readonly logger: PinoLoggerService;
  private pool: Pool = {} as Pool;
  private knexInstance: Knex = {} as Knex;
  private isConnectedFlag = false;
  private stats: DatabaseStats;
  private connectionId: string;

  constructor(
    @Inject('DATABASE_CONFIG') config: DatabaseConfig,
    @Inject('DATABASE_NAME') name: string,
    eventEmitter: EventEmitter2,
    logger: PinoLoggerService
  ) {
    this.config = config;
    this.name = name;
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.connectionId = uuidv4();
    this.stats = this.initializeStats();
    this.initializePool();
    this.initializeKnex();

    // 自动连接数据库
    this.connect().catch((error) => {
      this.logger.warn(
        'Failed to auto-connect to database, will retry on first query',
        LogContext.DATABASE,
        { adapter: this.name, error: (error as Error).message }
      );
    });
  }

  /**
   * @getter isConnected
   * @description 获取连接状态
   * @returns {boolean} 是否已连接
   */
  get isConnected(): boolean {
    return this.isConnectedFlag;
  }

  /**
   * @method connect
   * @description 连接到PostgreSQL数据库
   * @returns {Promise<void>} 连接结果
   */
  async connect(): Promise<void> {
    try {
      this.logger.info(
        `Connecting to PostgreSQL database: ${this.config.database}`,
        LogContext.DATABASE,
        { adapter: this.name, host: this.config.host, port: this.config.port }
      );

      // 测试连接池连接
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.isConnectedFlag = true;

      this.logger.info(
        `Successfully connected to PostgreSQL database: ${this.config.database}`,
        LogContext.DATABASE,
        { adapter: this.name }
      );

      this.emitEvent('connected', {
        adapter: this.name,
        database: this.config.database,
        timestamp: new Date(),
      });
    } catch (error) {
      this.isConnectedFlag = false;
      this.logger.error(
        `Failed to connect to PostgreSQL database: ${this.config.database}`,
        LogContext.DATABASE,
        { adapter: this.name, error: (error as Error).message },
        error as Error
      );

      this.emitEvent('connection_error', {
        adapter: this.name,
        error: (error as Error).message,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * @method disconnect
   * @description 断开PostgreSQL数据库连接
   * @returns {Promise<void>} 断开结果
   */
  async disconnect(): Promise<void> {
    try {
      this.logger.info(
        `Disconnecting from PostgreSQL database: ${this.config.database}`,
        LogContext.DATABASE,
        { adapter: this.name }
      );

      await this.pool.end();
      await this.knexInstance.destroy();

      this.isConnectedFlag = false;

      this.logger.info(
        `Successfully disconnected from PostgreSQL database: ${this.config.database}`,
        LogContext.DATABASE,
        { adapter: this.name }
      );

      this.emitEvent('disconnected', {
        adapter: this.name,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to disconnect from PostgreSQL database: ${this.config.database}`,
        LogContext.DATABASE,
        { adapter: this.name, error: (error as Error).message },
        error as Error
      );

      this.emitEvent('disconnection_error', {
        adapter: this.name,
        error: (error as Error).message,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * @method query
   * @description 执行查询
   * @param sql SQL语句
   * @param params 查询参数
   * @param options 查询选项
   * @returns {Promise<QueryResult>} 查询结果
   */
  async query(
    sql: string,
    params: any[] = [],
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    const startTime = Date.now();
    this.stats.totalQueries++;

    try {
      if (options.logQuery) {
        this.logger.debug(`Executing query: ${sql}`, LogContext.DATABASE, {
          adapter: this.name,
          params,
          tag: options.tag,
        });
      }

      const queryConfig = {
        text: sql,
        values: params,
        name: options.tag || 'unnamed',
      };

      const result = await this.pool.query(queryConfig);
      const responseTime = Date.now() - startTime;

      this.updateStats(responseTime, true);

      if (options.logQuery) {
        this.logger.debug(`Query completed: ${sql}`, LogContext.DATABASE, {
          adapter: this.name,
          responseTime,
          rowCount: result.rowCount,
        });
      }

      this.emitEvent('query_executed', {
        adapter: this.name,
        sql,
        params,
        responseTime,
        rowCount: result.rowCount,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateStats(responseTime, false);

      this.logger.error(
        `Query failed: ${sql}`,
        LogContext.DATABASE,
        {
          adapter: this.name,
          params,
          responseTime,
          error: (error as Error).message,
        },
        error as Error
      );

      this.emitEvent('query_error', {
        adapter: this.name,
        sql,
        params,
        error: (error as Error).message,
        responseTime,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * @method execute
   * @description 执行命令
   * @param sql SQL语句
   * @param params 参数
   * @param options 执行选项
   * @returns {Promise<QueryResult>} 执行结果
   */
  async execute(
    sql: string,
    params: any[] = [],
    options: QueryOptions = {}
  ): Promise<QueryResult> {
    return this.query(sql, params, { ...options, logQuery: true });
  }

  /**
   * @method transaction
   * @description 执行事务
   * @param callback 事务回调函数
   * @param options 事务选项
   * @returns {Promise<T>} 事务结果
   */
  async transaction<T>(
    callback: (trx: any) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Starting transaction`, LogContext.DATABASE, {
        adapter: this.name,
        tag: options.tag,
      });

      const result = await this.knexInstance.transaction(async (trx) => {
        if (options.isolationLevel) {
          await trx.raw(
            `SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel.toUpperCase()}`
          );
        }

        if (options.readOnly) {
          await trx.raw('SET TRANSACTION READ ONLY');
        }

        return await callback(trx);
      });

      const responseTime = Date.now() - startTime;

      this.logger.debug(`Transaction completed`, LogContext.DATABASE, {
        adapter: this.name,
        responseTime,
        tag: options.tag,
      });

      this.emitEvent('transaction_completed', {
        adapter: this.name,
        responseTime,
        tag: options.tag,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      this.logger.error(
        `Transaction failed`,
        LogContext.DATABASE,
        {
          adapter: this.name,
          responseTime,
          error: (error as Error).message,
          tag: options.tag,
        },
        error as Error
      );

      this.emitEvent('transaction_error', {
        adapter: this.name,
        error: (error as Error).message,
        responseTime,
        tag: options.tag,
        timestamp: new Date(),
      });

      throw error;
    }
  }

  /**
   * @method getHealth
   * @description 获取健康状态
   * @returns {Promise<DatabaseHealth>} 健康状态
   */
  async getHealth(): Promise<DatabaseHealth> {
    const startTime = Date.now();

    try {
      // 执行健康检查查询
      await this.query('SELECT 1 as health_check', [], { tag: 'health_check' });

      const responseTime = Date.now() - startTime;

      const poolStatus = {
        total: this.pool.totalCount,
        idle: this.pool.idleCount,
        active: this.pool.totalCount - this.pool.idleCount,
        waiting: this.pool.waitingCount,
      };

      return {
        healthy: true,
        connected: this.isConnectedFlag,
        responseTime,
        lastCheck: new Date(),
        poolStatus,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        healthy: false,
        connected: false,
        responseTime,
        error: (error as Error).message,
        lastCheck: new Date(),
      };
    }
  }

  /**
   * @method getStats
   * @description 获取统计信息
   * @returns {Promise<DatabaseStats>} 统计信息
   */
  async getStats(): Promise<DatabaseStats> {
    // 模拟异步操作以满足接口要求
    await Promise.resolve();
    return { ...this.stats };
  }

  /**
   * @method resetStats
   * @description 重置统计信息
   * @returns {Promise<void>} 重置结果
   */
  async resetStats(): Promise<void> {
    // 模拟异步操作以满足接口要求
    await Promise.resolve();
    this.stats = this.initializeStats();
    this.logger.info('Database stats reset', LogContext.DATABASE, {
      adapter: this.name,
    });
  }

  /**
   * @method getConnection
   * @description 获取数据库连接
   * @returns {Promise<DatabaseConnection>} 数据库连接
   */
  async getConnection(): Promise<DatabaseConnection> {
    // 模拟异步操作以满足接口要求
    await Promise.resolve();
    return {
      id: this.connectionId,
      status: this.isConnectedFlag ? 'connected' : 'disconnected',
      config: this.config,
      instance: this.pool as unknown as Connection | Knex | MikroOrmConnection,
      lastActivity: new Date(),
    };
  }

  /**
   * @method ping
   * @description 数据库连接测试
   * @returns {Promise<boolean>} 测试结果
   */
  async ping(): Promise<boolean> {
    try {
      await this.query('SELECT 1', [], { tag: 'ping_test' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * @method getKnex
   * @description 获取Knex实例
   * @returns {Knex} Knex实例
   */
  getKnex(): Knex {
    return this.knexInstance;
  }

  /**
   * @method getPool
   * @description 获取连接池实例
   * @returns {Pool} 连接池实例
   */
  getPool(): Pool {
    return this.pool;
  }

  /**
   * @private
   * @method initializePool
   * @description 初始化连接池
   */
  private initializePool(): void {
    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      user: this.config.username,
      password: this.config.password,
      database: this.config.database,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      max: this.config.pool?.max || 20,
      min: this.config.pool?.min || 2,
      idleTimeoutMillis: this.config.pool?.idleTimeoutMillis || 30000,
    });

    // 监听连接池事件
    this.pool.on('connect', () => {
      this.logger.debug('New client connected to pool', LogContext.DATABASE, {
        adapter: this.name,
      });
    });

    this.pool.on('error', (err) => {
      this.logger.error(
        'Unexpected error on idle client',
        LogContext.DATABASE,
        { adapter: this.name },
        err
      );
    });
  }

  /**
   * @private
   * @method initializeKnex
   * @description 初始化Knex实例
   */
  private initializeKnex(): void {
    this.knexInstance = knex({
      client: 'postgresql',
      connection: {
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
        ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      },
      pool: {
        min: this.config.pool?.min || 2,
        max: this.config.pool?.max || 20,
        idleTimeoutMillis: this.config.pool?.idleTimeoutMillis || 30000,
      },
      debug: false,
    });
  }

  /**
   * @private
   * @method initializeStats
   * @description 初始化统计信息
   * @returns {DatabaseStats} 初始统计信息
   */
  private initializeStats(): DatabaseStats {
    return {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      activeConnections: 0,
      idleConnections: 0,
      lastReset: new Date(),
    };
  }

  /**
   * @private
   * @method updateStats
   * @description 更新统计信息
   * @param responseTime 响应时间
   * @param success 是否成功
   */
  private updateStats(responseTime: number, success: boolean): void {
    if (success) {
      this.stats.successfulQueries++;
    } else {
      this.stats.failedQueries++;
    }

    // 更新响应时间统计
    if (this.stats.totalQueries === 1) {
      this.stats.minResponseTime = responseTime;
      this.stats.maxResponseTime = responseTime;
      this.stats.averageResponseTime = responseTime;
    } else {
      this.stats.minResponseTime = Math.min(
        this.stats.minResponseTime,
        responseTime
      );
      this.stats.maxResponseTime = Math.max(
        this.stats.maxResponseTime,
        responseTime
      );
      this.stats.averageResponseTime =
        (this.stats.averageResponseTime * (this.stats.totalQueries - 1) +
          responseTime) /
        this.stats.totalQueries;
    }

    // 更新连接池统计
    this.stats.activeConnections = this.pool.totalCount - this.pool.idleCount;
    this.stats.idleConnections = this.pool.idleCount;
  }

  /**
   * @private
   * @method emitEvent
   * @description 发射事件
   * @param event 事件名称
   * @param data 事件数据
   */
  private emitEvent(event: string, data: any): void {
    this.eventEmitter.emit(`database.${event}`, {
      adapter: this.name,
      ...data,
    });
  }
}
