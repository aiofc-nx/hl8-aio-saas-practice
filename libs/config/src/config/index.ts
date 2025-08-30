import app from './app';
import database from './database';
import redis from './redis';
import jwt from './jwt';
import email from './email';
import logging from './logging';
import setting from './setting';

/**
 * @fileoverview
 * 配置模块导出文件
 *
 * @description
 * 导出所有配置模块，供NestJS ConfigModule使用。
 * 每个配置模块都使用registerAs方法注册，提供类型安全的配置访问。
 *
 * 主要原理与机制如下：
 * 1. 导入所有配置模块
 * 2. 统一导出配置数组
 * 3. 支持NestJS ConfigModule的load选项
 * 4. 提供模块化的配置管理
 *
 * 功能与业务规则：
 * 1. 配置模块聚合
 * 2. 类型安全保证
 * 3. 模块化配置管理
 * 4. 配置验证支持
 */
export default [app, database, redis, jwt, email, logging, setting];
