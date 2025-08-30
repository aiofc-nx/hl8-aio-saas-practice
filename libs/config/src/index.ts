/**
 * @fileoverview
 * @aiofix/config 公共API接口
 *
 * @description
 * IAM系统配置模块的公共API接口，提供了配置系统的所有公开接口。
 * 该文件是配置模块的入口点，导出了所有必要的类型、服务和工具函数。
 *
 * 主要原理与机制如下：
 * 1. 使用export *语法导出所有公开的模块
 * 2. 提供类型安全的配置访问接口
 * 3. 支持模块化配置管理
 * 4. 集成环境配置和接口定义
 *
 * 功能与业务规则：
 * 1. 配置模块API导出
 * 2. 类型定义导出
 * 3. 服务类导出
 * 4. 工具函数导出
 * 5. 环境配置导出
 *
 * @exports
 * - default-config: 默认配置定义
 * - config-loader: 配置加载器工具函数
 * - config.module: 配置模块定义
 * - config.service: 配置服务类
 */
export * from './default-config';
export * from './config-loader';
export * from './config.module';
export * from './config.service';
