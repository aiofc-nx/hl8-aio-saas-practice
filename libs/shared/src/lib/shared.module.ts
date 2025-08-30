import { Module, Global } from '@nestjs/common';
import { SharedService } from './shared.service';

/**
 * @class SharedModule
 * @description
 * 共享领域模块，提供跨领域共享的基础组件和通用服务。
 *
 * 原理与机制：
 * 1. 使用 @Global() 装饰器使模块全局可用，其他模块无需显式导入即可使用。
 * 2. 遵循 Clean Architecture 原则，按领域边界组织代码结构。
 * 3. 提供领域层、应用层、基础设施层和表现层的共享组件。
 *
 * 功能与职责：
 * 1. 提供跨领域共享的基础组件
 * 2. 提供通用工具类和服务
 * 3. 提供基础设施配置和实现
 * 4. 提供表现层通用组件
 */
@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [
    SharedService,
    // 这里将添加更多共享的提供者
  ],
  exports: [
    SharedService,
    // 这里将导出更多共享的组件
  ],
})
export class SharedModule {}
