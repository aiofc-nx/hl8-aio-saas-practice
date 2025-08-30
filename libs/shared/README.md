# 共享领域模块 (Shared Domain Module)

## 概述

共享领域模块是 HL8 SaaS 平台的核心共享组件库，遵循 Clean Architecture 和领域驱动设计（DDD）原则，提供跨领域共享的基础组件、工具类和通用服务。

## 架构设计

### Clean Architecture 四层架构

```
┌─────────────────────────────────────┐
│     Presentation Layer (表现层)      │  ← 控制器、DTO、验证器、守卫、拦截器
├─────────────────────────────────────┤
│     Application Layer (应用层)       │  ← 用例、命令、查询、处理器、应用服务
├─────────────────────────────────────┤
│       Domain Layer (领域层)         │  ← 实体、值对象、聚合根、领域事件、领域服务
├─────────────────────────────────────┤
│    Infrastructure Layer (基础设施层)  │  ← 仓储实现、映射器、ORM实体、外部服务
└─────────────────────────────────────┘
```

### 目录结构

```
src/
├── domain/                    # 领域层
│   ├── entities/             # 实体
│   ├── value-objects/        # 值对象
│   ├── aggregates/           # 聚合根
│   ├── domain-events/        # 领域事件
│   ├── domain-services/      # 领域服务
│   ├── repositories/         # 仓储接口
│   ├── exceptions/           # 领域异常
│   ├── enums/               # 枚举
│   └── types/               # 类型定义
├── application/              # 应用层
│   ├── use-cases/           # 用例
│   ├── commands/            # 命令
│   ├── queries/             # 查询
│   ├── handlers/            # 处理器
│   │   ├── command-handlers/ # 命令处理器
│   │   └── query-handlers/   # 查询处理器
│   ├── event-handlers/      # 事件处理器
│   ├── services/            # 应用服务
│   ├── validators/          # 验证器
│   └── interfaces/          # 接口
├── infrastructure/           # 基础设施层
│   ├── repositories/        # 仓储实现
│   ├── mappers/            # 映射器
│   ├── entities/           # ORM实体
│   ├── services/           # 基础设施服务
│   ├── external/           # 外部服务集成
│   ├── config/             # 配置
│   └── migrations/         # 数据库迁移
├── presentation/            # 表现层
│   ├── controllers/        # 控制器
│   ├── dtos/              # DTO
│   ├── validators/        # 验证器
│   ├── guards/            # 守卫
│   └── interceptors/      # 拦截器
├── lib/                    # 模块核心文件
│   ├── shared.module.ts   # 共享模块
│   └── shared.service.ts  # 共享服务
└── index.ts               # 模块导出
```

## 使用方式

### 1. 安装依赖

```bash
pnpm install
```

### 2. 在应用中使用

```typescript
import { SharedModule } from '@hl8-aio-saas-practice/shared';

@Module({
  imports: [SharedModule],
  // ...
})
export class AppModule {}
```

### 3. 注入共享服务

```typescript
import { SharedService } from '@hl8-aio-saas-practice/shared';

@Injectable()
export class MyService {
  constructor(private readonly sharedService: SharedService) {}

  async someMethod() {
    const info = this.sharedService.getServiceInfo();
    // ...
  }
}
```

## 开发规范

### 代码注释规范

- 遵循 TSDoc 规范
- 注释应包含原理机制和功能职责
- 确保代码与注释一致性

### 依赖原则

- 严格遵循依赖倒置原则
- 外层不得依赖内层实现细节
- 领域层不依赖任何外部框架

### 测试要求

- 单元测试覆盖率不低于 80%
- 集成测试覆盖关键业务流程
- 使用 Jest 作为测试框架

## 构建和发布

### 构建

```bash
nx build shared
```

### 测试

```bash
nx test shared
```

### 代码检查

```bash
nx lint shared
```

## 版本管理

- 遵循语义化版本控制 (Semantic Versioning)
- 主版本号：不兼容的 API 修改
- 次版本号：向下兼容的功能性新增
- 修订号：向下兼容的问题修正

## 贡献指南

1. 遵循项目的代码规范和架构原则
2. 新功能需要包含完整的测试用例
3. 提交前运行完整的测试套件
4. 遵循 Git 提交规范

## 许可证

MIT License
