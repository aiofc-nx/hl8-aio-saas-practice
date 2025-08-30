import { Injectable } from '@nestjs/common';

/**
 * @class SharedService
 * @description
 * 共享服务，提供跨领域共享的基础功能和服务。
 *
 * 原理与机制：
 * 1. 作为全局服务，为整个应用程序提供共享的基础功能。
 * 2. 遵循单一职责原则，专注于提供通用工具和服务。
 * 3. 可以被其他领域模块注入使用，减少代码重复。
 *
 * 功能与职责：
 * 1. 提供通用工具方法
 * 2. 提供共享的业务逻辑
 * 3. 提供跨领域的数据处理服务
 * 4. 提供系统级别的辅助功能
 */
@Injectable()
export class SharedService {
  /**
   * 获取服务信息
   * @returns {string} 服务信息
   */
  getServiceInfo(): string {
    return 'Shared Service - 提供跨领域共享的基础服务';
  }
}
