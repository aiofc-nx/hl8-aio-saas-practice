import { Inject, Injectable, Optional } from '@nestjs/common';
import { LogConfig, LogFormat } from '../interfaces/logging.interface';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * @class PinoLoggerConfigService
 * @description
 * Pino日志配置管理服务，负责日志配置的初始化、验证和管理。
 *
 * 主要功能包括：
 * 1. 从环境变量和默认值初始化配置
 * 2. 配置验证和类型检查
 * 3. 配置更新和动态调整
 * 4. 环境相关的配置适配
 * 5. 配置持久化和恢复
 *
 * 设计原则：
 * - 单一职责：只负责配置管理
 * - 可测试性：配置逻辑独立，易于单元测试
 * - 可扩展性：支持多种配置源和验证规则
 */
@Injectable()
export class PinoLoggerConfigService {
  private config: LogConfig = {} as LogConfig;

  constructor(
    @Optional()
    @Inject('LOGGING_CONFIG')
    private customConfig?: Partial<LogConfig>,
  ) {
    this.initializeConfig();
  }

  /**
   * @method getConfig
   * @description 获取当前日志配置
   * @returns {LogConfig} 当前配置的副本
   */
  getConfig(): LogConfig {
    return { ...this.config };
  }

  /**
   * @method updateConfig
   * @description 更新日志配置
   * @param {Partial<LogConfig>} newConfig 新的配置项
   */
  updateConfig(newConfig: Partial<LogConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.validateConfig(this.config);
  }

  /**
   * @method getLevel
   * @description 获取当前日志级别
   * @returns {LogLevel} 当前日志级别
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * @method setLevel
   * @description 设置日志级别
   * @param {LogLevel} level 新的日志级别
   */
  setLevel(level: LogLevel): void {
    this.updateConfig({ level });
  }

  /**
   * @method getFormat
   * @description 获取当前日志格式
   * @returns {LogFormat} 当前日志格式
   */
  getFormat(): LogFormat {
    return this.config.format;
  }

  /**
   * @method setFormat
   * @description 设置日志格式
   * @param {LogFormat} format 新的日志格式
   */
  setFormat(format: LogFormat): void {
    this.updateConfig({ format });
  }

  /**
   * @method isProduction
   * @description 检查是否为生产环境
   * @returns {boolean} 是否为生产环境
   */
  isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * @method isDevelopment
   * @description 检查是否为开发环境
   * @returns {boolean} 是否为开发环境
   */
  isDevelopment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  /**
   * @method shouldUsePrettyFormat
   * @description 判断是否应该使用美化格式
   * @returns {boolean} 是否使用美化格式
   */
  shouldUsePrettyFormat(): boolean {
    return this.config.format === LogFormat.TEXT && this.isDevelopment();
  }

  /**
   * @method resetToDefaults
   * @description 重置为默认配置
   */
  resetToDefaults(): void {
    this.initializeConfig();
  }

  /**
   * @method validateConfig
   * @description 验证配置的有效性
   * @param {LogConfig} config 要验证的配置
   * @throws {Error} 配置无效时抛出错误
   */
  validateConfig(config: LogConfig): void {
    const validLevels: LogLevel[] = [
      'fatal',
      'error',
      'warn',
      'info',
      'debug',
      'trace',
    ];
    const validFormats: LogFormat[] = [LogFormat.JSON, LogFormat.TEXT];

    if (!validLevels.includes(config.level)) {
      throw new Error(
        `Invalid log level: ${config.level}. Valid levels are: ${validLevels.join(', ')}`,
      );
    }

    if (!validFormats.includes(config.format)) {
      throw new Error(
        `Invalid log format: ${config.format}. Valid formats are: ${validFormats.join(', ')}`,
      );
    }

    if (config.rotation) {
      if (
        config.rotation.maxSize &&
        !this.isValidFileSize(config.rotation.maxSize)
      ) {
        throw new Error(
          `Invalid maxSize format: ${config.rotation.maxSize}. Use format like '10m', '1g'`,
        );
      }
    }

    if (config.remote) {
      if (!config.remote.url) {
        throw new Error(
          'Remote logging URL is required when remote logging is enabled',
        );
      }
      if (config.remote.timeout && config.remote.timeout <= 0) {
        throw new Error('Remote logging timeout must be positive');
      }
      if (config.remote.retries && config.remote.retries < 0) {
        throw new Error('Remote logging retries must be non-negative');
      }
    }
  }

  /**
   * @private
   * @method initializeConfig
   * @description 初始化日志配置
   */
  private initializeConfig(): void {
    // 根据环境确定默认格式
    const defaultFormat = this.isProduction() ? LogFormat.JSON : LogFormat.TEXT;

    // 默认配置
    const defaultConfig: LogConfig = {
      level: (process.env.LOG_LEVEL as LogLevel) || 'info',
      format: (process.env.LOG_FORMAT as LogFormat) || defaultFormat,
      colorize: this.isDevelopment(),
      timestamp: true,
      requestId: true,
      tenantId: true,
      userId: true,
      performance: true,
      stackTrace: true,
      filePath: process.env.LOG_FILE_PATH,
      rotation: {
        maxSize: '10m',
        maxFiles: 5,
        interval: '1d',
      },
      remote: process.env.LOG_REMOTE_URL
        ? {
            url: process.env.LOG_REMOTE_URL,
            token: process.env.LOG_REMOTE_TOKEN,
            timeout: 5000,
            retries: 3,
          }
        : undefined,
    };

    // 合并自定义配置
    this.config = {
      ...defaultConfig,
      ...this.customConfig,
    };

    this.validateConfig(this.config);
  }

  /**
   * @private
   * @method isValidFileSize
   * @description 验证文件大小格式是否有效
   * @param {string} size 文件大小字符串
   * @returns {boolean} 是否有效
   */
  private isValidFileSize(size: string): boolean {
    const sizeRegex = /^\d+[kmg]?$/i;
    return sizeRegex.test(size);
  }
}

/**
 * @constant defaultLoggingConfig
 * @description 默认日志配置
 */
export const defaultLoggingConfig: LogConfig = {
  level: 'info',
  format: LogFormat.JSON,
  colorize: false,
  timestamp: true,
  requestId: true,
  tenantId: true,
  userId: true,
  performance: true,
  stackTrace: true,
  rotation: {
    maxSize: '10m',
    maxFiles: 5,
    interval: '1d',
  },
};
