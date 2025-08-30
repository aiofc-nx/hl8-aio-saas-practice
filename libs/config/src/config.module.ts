import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigService } from './config.service';
import configs from './config';

/**
 * @module ConfigModule
 * @description
 * IAM系统配置模块，负责管理和提供系统中所有配置信息。
 * 该模块是配置系统的入口点，集成了NestJS的配置模块和自定义配置服务。
 *
 * 主要原理与机制如下：
 * 1. 使用@Global()装饰器使模块全局可用
 * 2. 集成NestJS的ConfigModule进行配置管理
 * 3. 加载自定义配置模块数组
 * 4. 提供ConfigService作为全局服务
 * 5. 启用配置缓存以提高性能
 *
 * 功能与业务规则：
 * 1. 全局配置管理
 * 2. 配置模块集成
 * 3. 配置服务提供
 * 4. 配置缓存支持
 * 5. 模块化配置加载
 */
@Global()
@Module({
  imports: [
    /**
     * NestJS配置模块配置
     * 使用NestConfigModule.forRoot方法配置根模块来处理配置设置。
     * load选项用于加载不同提供者的配置模块。
     *
     * 配置选项说明：
     * - isGlobal: true - 使配置模块全局可用
     * - cache: true - 启用配置缓存以提高性能
     * - load: [...configs] - 加载自定义配置模块数组
     */
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [...configs],
    }),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
