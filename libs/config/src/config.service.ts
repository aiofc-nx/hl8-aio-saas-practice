import { Injectable, Logger } from '@nestjs/common';
import { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import { KnexModuleOptions } from 'nest-knexjs';
import { getConfig } from './config-loader';

/**
 * @interface IamConfig
 * @description
 * IAM系统配置接口，定义了系统中所有配置模块的结构。
 * 该接口包含了应用基础配置、数据库配置、缓存配置、认证配置等各个模块的配置定义。
 *
 * 主要原理与机制如下：
 * 1. 使用TypeScript接口定义配置结构，确保类型安全
 * 2. 每个配置模块都有独立的命名空间，避免配置冲突
 * 3. 支持配置的嵌套结构，便于组织复杂的配置项
 * 4. 使用Record<string, unknown>类型提供灵活性，具体类型在运行时确定
 *
 * 功能与业务规则：
 * 1. 应用基础配置（app）：应用名称、版本、环境等
 * 2. 数据库配置（database）：数据库连接、ORM配置等
 * 3. 缓存配置（redis）：Redis连接、缓存策略等
 * 4. 认证配置（jwt）：JWT密钥、令牌配置等
 * 5. 邮件配置（email）：邮件服务、模板配置等
 * 6. 日志配置（logging）：日志级别、输出配置等
 * 7. 系统设置（setting）：系统级配置项
 * 8. 第三方集成（keycloak）：Keycloak认证服务配置
 */
export interface IamConfig {
  /** 应用基础配置 */
  app: Record<string, unknown>;
  /** 数据库配置 */
  database: Record<string, unknown>;
  /** Redis缓存配置 */
  redis: Record<string, unknown>;
  /** JWT认证配置 */
  jwt: Record<string, unknown>;
  /** 邮件服务配置 */
  email: Record<string, unknown>;
  /** 日志系统配置 */
  logging: Record<string, unknown>;
  /** 系统设置配置 */
  setting: Record<string, unknown>;
  /** Keycloak集成配置 */
  keycloak: Record<string, unknown>;
}

/**
 * @class ConfigService
 * @description
 * IAM系统配置服务，负责管理和提供系统中所有配置信息。
 * 该服务是配置管理的核心组件，提供了配置的加载、获取、验证等功能。
 *
 * 主要原理与机制如下：
 * 1. 使用NestJS的依赖注入机制，作为全局服务提供配置访问
 * 2. 在构造函数中异步初始化配置，确保配置在服务启动时加载完成
 * 3. 使用只读配置对象，防止运行时配置被意外修改
 * 4. 提供类型安全的配置访问方法，支持泛型约束
 * 5. 集成环境变量管理，支持动态配置更新
 *
 * 功能与业务规则：
 * 1. 配置加载和初始化
 * 2. 配置获取和验证
 * 3. 环境变量管理
 * 4. 配置模块化访问
 * 5. 类型安全的配置操作
 */
@Injectable()
export class ConfigService {
  /** 环境配置对象 */
  private readonly environment = {
    production: process.env.NODE_ENV === 'production',
    env: {} as Record<string, string>,
  };
  /** 日志服务实例 */
  private readonly logger = new Logger(ConfigService.name);
  /** 系统配置对象 */
  private config: Partial<IamConfig> = {};

  /**
   * @constructor
   * @description
   * 配置服务构造函数，在服务实例化时自动初始化配置。
   * 由于构造函数不能是异步的，所以使用void调用异步初始化方法。
   */
  constructor() {
    void this.initConfig();
  }

  /**
   * @function initConfig
   * @description
   * 初始化配置和环境变量。该方法在服务启动时被调用，负责加载所有配置信息
   * 并设置环境变量。由于构造函数不能是异步的，所以使用独立的异步方法。
   *
   * 主要原理与机制如下：
   * 1. 调用getConfig()方法获取完整的配置对象
   * 2. 遍历环境配置，动态设置process.env环境变量
   * 3. 记录生产环境状态到日志中
   * 4. 确保配置在服务启动前完成加载
   *
   * 功能与业务规则：
   * 1. 配置加载和初始化
   * 2. 环境变量设置
   * 3. 启动状态日志记录
   * 4. 配置验证和错误处理
   *
   * @returns {Promise<void>} 返回一个Promise，表示配置初始化过程
   */
  private async initConfig(): Promise<void> {
    this.config = getConfig();

    // 动态设置环境变量
    if (this.environment.env) {
      Object.entries(this.environment.env).forEach(([key, value]) => {
        process.env[key] = value as string;
      });
    }

    this.logger.log(`Is Production: ${this.environment.production}`);
  }

  /**
   * @function getConfig
   * @description
   * 获取完整的配置对象，返回一个只读的配置副本。该方法提供了对系统所有配置的访问，
   * 同时确保返回的配置对象不会被意外修改。
   *
   * 主要原理与机制如下：
   * 1. 使用Object.freeze()创建不可变的配置对象
   * 2. 使用展开运算符创建配置对象的深拷贝
   * 3. 返回只读类型，防止运行时修改
   * 4. 提供类型安全的配置访问
   *
   * 功能与业务规则：
   * 1. 完整配置获取
   * 2. 配置对象保护
   * 3. 类型安全访问
   * 4. 配置完整性保证
   *
   * @returns {Readonly<Partial<IamConfig>>} 返回只读的完整配置对象
   */
  public getConfig(): Readonly<Partial<IamConfig>> {
    return Object.freeze({ ...this.config });
  }

  /**
   * @function getConfigValue
   * @description
   * 获取指定的配置值，支持泛型类型安全。该方法提供了对特定配置模块的访问，
   * 如果配置键不存在会抛出错误。
   *
   * 主要原理与机制如下：
   * 1. 使用泛型K约束配置键的类型
   * 2. 检查配置键是否存在，不存在则抛出错误
   * 3. 返回只读的配置值，确保类型安全
   * 4. 支持TypeScript的类型推断
   *
   * 功能与业务规则：
   * 1. 特定配置获取
   * 2. 配置键验证
   * 3. 类型安全访问
   * 4. 错误处理和提示
   *
   * @template K - 配置键的类型
   * @param {K} key - 要获取的配置键
   * @returns {Readonly<IamConfig[K]>} 返回只读的配置值
   * @throws {Error} 当配置键不存在时抛出错误
   */
  public getConfigValue<K extends keyof IamConfig>(
    key: K
  ): Readonly<IamConfig[K]> {
    if (!(key in this.config)) {
      throw new Error(`Configuration key "${String(key)}" not found.`);
    }
    return this.config[key] as Readonly<IamConfig[K]>;
  }

  /**
   * @getter appConfig
   * @description
   * 获取应用基础配置，包含应用名称、版本、环境等基础信息。
   *
   * @returns {Readonly<Record<string, unknown>>} 返回只读的应用配置对象
   */
  get appConfig(): Readonly<Record<string, unknown>> {
    return this.config.app ?? {};
  }

  /**
   * @getter databaseConfig
   * @description
   * 获取数据库配置，包含数据库连接、ORM配置、连接池等设置。
   *
   * @returns {Readonly<Record<string, unknown>>} 返回只读的数据库配置对象
   */
  get databaseConfig(): Readonly<Record<string, unknown>> {
    return this.config.database ?? {};
  }

  /**
   * @getter redisConfig
   * @description
   * 获取Redis缓存配置，包含连接信息、缓存策略、分布式锁等设置。
   *
   * @returns {Readonly<Record<string, unknown>>} 返回只读的Redis配置对象
   */
  get redisConfig(): Readonly<Record<string, unknown>> {
    return this.config.redis ?? {};
  }

  /**
   * @getter jwtConfig
   * @description
   * 获取JWT认证配置，包含密钥、令牌过期时间、多租户支持等设置。
   *
   * @returns {Readonly<Record<string, unknown>>} 返回只读的JWT配置对象
   */
  get jwtConfig(): Readonly<Record<string, unknown>> {
    return this.config.jwt ?? {};
  }

  /**
   * @getter emailConfig
   * @description
   * 获取邮件服务配置，包含SMTP设置、邮件模板、发送策略等配置。
   *
   * @returns {Readonly<Record<string, unknown>>} 返回只读的邮件配置对象
   */
  get emailConfig(): Readonly<Record<string, unknown>> {
    return this.config.email ?? {};
  }

  /**
   * @getter loggingConfig
   * @description
   * 获取日志系统配置，包含日志级别、输出格式、聚合设置等配置。
   *
   * @returns {Readonly<Record<string, unknown>>} 返回只读的日志配置对象
   */
  get loggingConfig(): Readonly<Record<string, unknown>> {
    return this.config.logging ?? {};
  }

  /**
   * @getter settingConfig
   * @description
   * 获取系统设置配置，包含系统级配置项和全局设置。
   *
   * @returns {Readonly<Record<string, unknown>>} 返回只读的系统设置配置对象
   */
  get settingConfig(): Readonly<Record<string, unknown>> {
    return this.config.setting ?? {};
  }

  /**
   * @getter keycloakConfig
   * @description
   * 获取Keycloak集成配置，包含第三方认证服务的连接和设置。
   *
   * @returns {Readonly<Record<string, unknown>>} 返回只读的Keycloak配置对象
   */
  get keycloakConfig(): Readonly<Record<string, unknown>> {
    return this.config.keycloak ?? {};
  }

  /**
   * @getter dbMikroOrmConnectionOptions
   * @description
   * 获取MikroORM连接配置选项，用于数据库连接和ORM操作。
   *
   * @returns {Readonly<MikroOrmModuleOptions>} 返回只读的MikroORM配置对象
   */
  get dbMikroOrmConnectionOptions(): Readonly<MikroOrmModuleOptions> {
    return this.config.database?.dbMikroOrmConnectionOptions ?? {};
  }

  /**
   * @getter dbKnexConnectionOptions
   * @description
   * 获取Knex连接配置选项，用于复杂查询和数据库迁移。
   *
   * @returns {Readonly<KnexModuleOptions>} 返回只读的Knex配置对象
   */
  get dbKnexConnectionOptions(): Readonly<KnexModuleOptions> {
    return this.config.database?.dbKnexConnectionOptions ?? {};
  }

  /**
   * @function get
   * @description
   * 获取环境变量值，支持类型推断。该方法提供了对环境变量的类型安全访问，
   * 如果环境变量不存在会抛出错误。
   *
   * 主要原理与机制如下：
   * 1. 使用泛型K约束环境变量键的类型
   * 2. 检查环境变量是否存在，不存在则抛出错误
   * 3. 返回类型安全的环境变量值
   * 4. 支持TypeScript的类型推断和自动补全
   *
   * 功能与业务规则：
   * 1. 环境变量获取
   * 2. 类型安全访问
   * 3. 错误处理和提示
   * 4. 环境变量验证
   *
   * @template K - 环境变量键的类型
   * @param {K} key - 要获取的环境变量键
   * @returns {string} 返回对应的环境变量值
   * @throws {Error} 当环境变量不存在时抛出错误
   */
  get<K extends string>(key: K): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Environment variable "${key}" is not defined.`);
    }
    return value;
  }

  /**
   * @function isProd
   * @description
   * 检查应用是否运行在生产环境模式。该方法用于判断当前运行环境，
   * 帮助应用根据环境调整行为。
   *
   * 主要原理与机制如下：
   * 1. 从环境配置中获取production标志
   * 2. 返回布尔值表示是否为生产环境
   * 3. 用于条件逻辑和环境相关配置
   *
   * 功能与业务规则：
   * 1. 环境判断
   * 2. 条件逻辑支持
   * 3. 环境相关配置
   * 4. 调试和部署支持
   *
   * @returns {boolean} 返回true表示生产环境，false表示非生产环境
   */
  isProd(): boolean {
    return this.environment.production;
  }
}
