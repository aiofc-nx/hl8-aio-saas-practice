/**
 * @fileoverview
 * 共享领域模块 - 基础设施层导出
 *
 * 基础设施层提供技术实现，包括数据库、外部服务等。
 * 该层实现领域层定义的接口。
 */

// 仓储实现导出
export * from './repositories';

// 映射器导出
export * from './mappers';

// ORM实体导出
export * from './entities';

// 基础设施服务导出
export * from './services';

// 外部服务集成导出
export * from './external';

// 配置导出
export * from './config';

// 数据库迁移导出
export * from './migrations';
