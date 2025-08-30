/**
 * @file security.module.ts
 * @description 安全模块
 *
 * 该模块整合了所有安全相关的服务，包括：
 * - JWT服务
 * - 密码加密服务
 * - 安全配置管理
 * - 认证策略
 * - 授权策略
 *
 * 遵循DDD和Clean Architecture原则，提供统一的安全管理功能。
 */

import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { LoggingModule } from '@aiofix/logging';
import { securityConfig } from './config/security.config';
import { PasswordService } from './services/password.service';
import { JwtService } from './services/jwt.service';
import type { SecurityConfig as SecurityConfigType } from './interfaces/security.interface';

/**
 * @interface SecurityModuleOptions
 * @description 安全模块配置选项
 */
export interface SecurityModuleOptions {
  /** 安全配置 */
  config?: Partial<SecurityConfigType>;
  /** 是否全局模块 */
  global?: boolean;
  /** 是否启用JWT */
  jwt?: boolean;
  /** 是否启用密码加密 */
  password?: boolean;
  /** 是否启用认证 */
  authentication?: boolean;
  /** 是否启用授权 */
  authorization?: boolean;
}

/**
 * @class SecurityModule
 * @description 安全模块
 *
 * 提供统一的安全管理功能，包括：
 * - JWT令牌管理
 * - 密码加密和验证
 * - 认证和授权
 * - 安全配置管理
 * - 安全监控和统计
 */
@Module({})
export class SecurityModule {
  /**
   * @function register
   * @description 注册安全模块
   * @param options 模块配置选项
   * @returns {DynamicModule} 动态模块配置
   */
  static register(options: SecurityModuleOptions = {}): DynamicModule {
    const {
      config = {},
      global = false,
      jwt = true,
      password = true,
    } = options;

    const moduleConfig: DynamicModule = {
      module: SecurityModule,
      imports: [
        ConfigModule.forFeature(securityConfig),
        LoggingModule,
        ...(jwt
          ? [
              JwtModule.registerAsync({
                useFactory: (configService: ConfigService) => {
                  const jwtConfig =
                    configService.get<SecurityConfigType['jwt']>(
                      'security.jwt'
                    );
                  if (!jwtConfig) {
                    throw new Error('JWT configuration not found');
                  }
                  const signOptions: Record<string, unknown> = {
                    expiresIn: jwtConfig.expiresIn,
                  };
                  if (jwtConfig.issuer) signOptions.issuer = jwtConfig.issuer;
                  if (jwtConfig.audience)
                    signOptions.audience = jwtConfig.audience;

                  const verifyOptions: Record<string, unknown> = {};
                  if (jwtConfig.issuer) verifyOptions.issuer = jwtConfig.issuer;
                  if (jwtConfig.audience)
                    verifyOptions.audience = jwtConfig.audience;

                  return {
                    secret: jwtConfig.secret,
                    signOptions,
                    verifyOptions,
                  };
                },
                inject: [ConfigService],
              }),
            ]
          : []),
        // ...(authentication ? [PassportModule] : []),
      ],
      providers: [
        // 配置提供者
        {
          provide: 'SECURITY_CONFIG',
          useFactory: (defaultConfig: SecurityConfigType) => ({
            ...defaultConfig,
            ...config,
          }),
          inject: [securityConfig.KEY],
        },

        // 服务提供者
        ...(password ? [PasswordService] : []),
        ...(jwt ? [JwtService] : []),
      ],
      exports: [
        // 导出配置
        'SECURITY_CONFIG',

        // 导出服务
        ...(password ? [PasswordService] : []),
        ...(jwt ? [JwtService] : []),
      ],
    };

    if (global) {
      moduleConfig.global = true;
    }

    return moduleConfig;
  }

  /**
   * @function forRoot
   * @description 注册安全模块的便捷方法
   * @param options 模块配置选项
   * @returns {DynamicModule} 动态模块配置
   */
  static forRoot(options: SecurityModuleOptions = {}): DynamicModule {
    return this.register({
      global: true,
      jwt: true,
      password: true,
      authentication: true,
      authorization: false,
      ...options,
    });
  }

  /**
   * @function forFeature
   * @description 注册安全模块的特性版本
   * @param options 模块配置选项
   * @returns {DynamicModule} 动态模块配置
   */
  static forFeature(options: SecurityModuleOptions = {}): DynamicModule {
    return this.register({
      global: false,
      jwt: true,
      password: true,
      authentication: false,
      authorization: false,
      ...options,
    });
  }
}
