import { Injectable } from '@nestjs/common';
import pino from 'pino';
import { LogConfig } from '../interfaces/logging.interface';
import { PinoLoggerConfigService } from '../services/pino-logger-config.service';

/**
 * @class PinoLoggerFactory
 * @description
 * Pino日志器工厂类，负责创建和配置Pino日志实例。
 *
 * 主要功能包括：
 * 1. 根据配置创建Pino实例
 * 2. 配置传输器和格式化器
 * 3. 处理不同环境的配置差异
 * 4. 提供日志器创建的统一接口
 *
 * 设计原则：
 * - 工厂模式：统一创建Pino实例
 * - 配置驱动：根据配置动态调整
 * - 环境适配：自动适配不同环境
 */
@Injectable()
export class PinoLoggerFactory {
  constructor(private readonly configService: PinoLoggerConfigService) {}

  /**
   * @method createLogger
   * @description 创建Pino日志器实例
   * @returns {pino.Logger} Pino日志器实例
   */
  createLogger(): pino.Logger {
    const config = this.configService.getConfig();
    const pinoOptions = this.buildPinoOptions(config);
    return pino(pinoOptions);
  }

  /**
   * @method createChildLogger
   * @description 创建子日志器
   * @param {pino.Logger} parentLogger 父日志器
   * @param {Record<string, any>} childOptions 子日志器选项
   * @returns {pino.Logger} 子日志器实例
   */
  createChildLogger(
    parentLogger: pino.Logger,
    childOptions: Record<string, any>,
  ): pino.Logger {
    return parentLogger.child(childOptions);
  }

  /**
   * @method rebuildLogger
   * @description 重新构建日志器（用于配置更新后）
   * @param {pino.Logger} existingLogger 现有日志器
   * @returns {pino.Logger} 新的日志器实例
   */
  rebuildLogger(existingLogger?: pino.Logger): pino.Logger {
    // 如果存在现有日志器，先关闭它
    if (existingLogger && existingLogger.flush) {
      existingLogger.flush();
    }

    return this.createLogger();
  }

  /**
   * @private
   * @method buildPinoOptions
   * @description 构建Pino配置选项
   * @param {LogConfig} config 日志配置
   * @returns {pino.LoggerOptions} Pino配置选项
   */
  private buildPinoOptions(config: LogConfig): pino.LoggerOptions {
    const pinoOptions: pino.LoggerOptions = {
      level: config.level,
      timestamp: config.timestamp ? pino.stdTimeFunctions.isoTime : false,
    };

    // 配置传输器
    this.configureTransport(pinoOptions, config);

    return pinoOptions;
  }

  /**
   * @private
   * @method configureTransport
   * @description 配置传输器
   * @param {pino.LoggerOptions} pinoOptions Pino配置选项
   * @param {LogConfig} config 日志配置
   */
  private configureTransport(
    pinoOptions: pino.LoggerOptions,
    config: LogConfig,
  ): void {
    // 在开发环境中使用pino-pretty进行格式化
    if (this.configService.shouldUsePrettyFormat()) {
      pinoOptions.transport = {
        target: 'pino-pretty',
        options: {
          colorize: config.colorize,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      };
    }

    // 配置文件传输（如果指定了文件路径）
    if (config.filePath) {
      this.configureFileTransport(pinoOptions, config);
    }

    // 配置远程传输（如果启用了远程日志）
    if (config.remote) {
      this.configureRemoteTransport(pinoOptions, config);
    }
  }

  /**
   * @private
   * @method configureFileTransport
   * @description 配置文件传输
   * @param {pino.LoggerOptions} pinoOptions Pino配置选项
   * @param {LogConfig} config 日志配置
   */
  private configureFileTransport(
    pinoOptions: pino.LoggerOptions,
    config: LogConfig,
  ): void {
    if (!config.filePath) return;

    const fileTransport = {
      target: 'pino/file',
      level: config.level,
      options: {
        destination: config.filePath,
      },
    };

    // 如果已经有transport配置，使用targets数组
    if (pinoOptions.transport) {
      if (Array.isArray((pinoOptions.transport as any).targets)) {
        (pinoOptions.transport as any).targets.push(fileTransport);
      } else {
        pinoOptions.transport = {
          targets: [pinoOptions.transport, fileTransport],
        } as any;
      }
    } else {
      pinoOptions.transport = fileTransport;
    }
  }

  /**
   * @private
   * @method configureRemoteTransport
   * @description 配置远程传输
   * @param {pino.LoggerOptions} pinoOptions Pino配置选项
   * @param {LogConfig} config 日志配置
   */
  private configureRemoteTransport(
    pinoOptions: pino.LoggerOptions,
    config: LogConfig,
  ): void {
    if (!config.remote) return;

    const remoteTransport = {
      target: 'pino-http-send',
      level: config.level,
      options: {
        destination: config.remote.url,
        headers: {
          Authorization: config.remote.token
            ? `Bearer ${config.remote.token}`
            : undefined,
          'Content-Type': 'application/json',
        },
        timeout: config.remote.timeout,
        retries: config.remote.retries,
      },
    };

    // 如果已经有transport配置，使用targets数组
    if (pinoOptions.transport) {
      if (Array.isArray((pinoOptions.transport as any).targets)) {
        (pinoOptions.transport as any).targets.push(remoteTransport);
      } else {
        pinoOptions.transport = {
          targets: [pinoOptions.transport, remoteTransport],
        } as any;
      }
    } else {
      pinoOptions.transport = remoteTransport;
    }
  }
}
