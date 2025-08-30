/**
 * @fileoverview
 * 共享领域模块 - 领域层导出
 *
 * 领域层包含业务核心逻辑，包括实体、值对象、聚合根、领域事件等。
 * 该层不依赖任何外部框架或基础设施，纯粹表达业务规则。
 */

// 实体导出
export * from './entities';

// 值对象导出
export * from './value-objects';

// 聚合根导出
export * from './aggregates';

// 领域事件导出
export * from './domain-events';

// 领域服务导出
export * from './domain-services';

// 仓储接口导出
export * from './repositories';

// 领域异常导出
export * from './exceptions';

// 枚举导出
export * from './enums';

// 类型定义导出
export * from './types';
