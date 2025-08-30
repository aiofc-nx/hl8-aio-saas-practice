/**
 * @file index.ts
 * @description 安全配置基础设施库入口文件
 *
 * 该文件是安全配置基础设施库的主要入口点，提供：
 * - 安全配置模块
 * - JWT服务
 * - 密码加密服务
 * - 安全配置管理
 * - 认证和授权服务
 *
 * 遵循DDD和Clean Architecture原则，提供统一的安全抽象层。
 */

// 导出接口
export * from './interfaces/security.interface';

// 导出配置
export { SecurityConfigClass, securityConfig } from './config/security.config';

// 导出服务
export { PasswordService } from './services/password.service';
export { JwtService } from './services/jwt.service';

// 导出模块
export { SecurityModule } from './security.module';
export type { SecurityModuleOptions } from './security.module';
