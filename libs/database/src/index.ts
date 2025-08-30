/**
 * @file index.ts
 * @description 数据库适配器基础设施库入口文件
 *
 * 该文件是数据库适配器基础设施库的主要入口点，提供：
 * - 数据库适配器模块
 * - PostgreSQL适配器
 * - 数据库管理器
 * - 数据库工厂
 * - 配置管理
 * - 健康检查服务
 *
 * 遵循DDD和Clean Architecture原则，提供统一的数据库抽象层。
 */

// 导出接口
export * from './interfaces/database.interface';

// 导出配置
export { DatabaseConfig } from './config/database.config';

// 导出适配器
export * from './adapters/postgresql.adapter';

// 导出模块
export * from './database.module';
