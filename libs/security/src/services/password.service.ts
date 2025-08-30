/**
 * @file password.service.ts
 * @description 密码加密服务
 *
 * 该文件实现了密码加密服务，包括：
 * - 密码哈希
 * - 密码验证
 * - 密码复杂度验证
 * - 密码生成
 *
 * 遵循DDD和Clean Architecture原则，提供安全的密码管理功能。
 */

import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { PinoLoggerService, LogContext } from '@aiofix/logging';
import type { PasswordConfig } from '../interfaces/security.interface';

/**
 * @interface PasswordValidationResult
 * @description 密码验证结果接口
 */
export interface PasswordValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误信息 */
  errors: string[];
  /** 警告信息 */
  warnings: string[];
}

/**
 * @interface PasswordHashResult
 * @description 密码哈希结果接口
 */
export interface PasswordHashResult {
  /** 哈希后的密码 */
  hash: string;
  /** 盐值 */
  salt: string;
  /** 哈希算法版本 */
  version: string;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * @class PasswordService
 * @description 密码加密服务
 *
 * 提供安全的密码管理功能，包括：
 * - 密码哈希和验证
 * - 密码复杂度检查
 * - 密码生成
 * - 密码策略管理
 *
 * 使用bcrypt算法进行密码哈希，支持可配置的盐轮数。
 */
@Injectable()
export class PasswordService {
  private readonly logger: PinoLoggerService;
  private readonly config: PasswordConfig;

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    logger: PinoLoggerService
  ) {
    this.logger = logger;
    this.config = this.configService.get<PasswordConfig>(
      'security.password'
    ) ?? {
      saltRounds: 12,
      minLength: 8,
      maxLength: 128,
      complexity: {
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
      },
    };
  }

  /**
   * @method hash
   * @description 对密码进行哈希
   * @param password 原始密码
   * @param saltRounds 盐轮数（可选，默认使用配置值）
   * @returns {Promise<string>} 哈希后的密码
   */
  async hash(password: string, saltRounds?: number): Promise<string> {
    const rounds = saltRounds || this.config.saltRounds;

    try {
      this.logger.debug('Hashing password', LogContext.BUSINESS, {
        saltRounds: rounds,
      });

      const hash = await bcrypt.hash(password, rounds);

      this.logger.debug('Password hashed successfully', LogContext.BUSINESS, {
        saltRounds: rounds,
      });

      return hash;
    } catch (error) {
      this.logger.error(
        'Failed to hash password',
        LogContext.BUSINESS,
        { error: (error as Error).message, saltRounds: rounds },
        error as Error
      );
      throw new Error('Password hashing failed');
    }
  }

  /**
   * @method compare
   * @description 比较密码和哈希值
   * @param password 原始密码
   * @param hash 哈希值
   * @returns {Promise<boolean>} 是否匹配
   */
  async compare(password: string, hash: string): Promise<boolean> {
    try {
      this.logger.debug('Comparing password with hash', LogContext.BUSINESS);

      const isMatch = await bcrypt.compare(password, hash);

      this.logger.debug('Password comparison completed', LogContext.BUSINESS, {
        isMatch,
      });

      return isMatch;
    } catch (error) {
      this.logger.error(
        'Failed to compare password',
        LogContext.BUSINESS,
        { error: (error as Error).message },
        error as Error
      );
      return false;
    }
  }

  /**
   * @method validate
   * @description 验证密码复杂度
   * @param password 密码
   * @returns {PasswordValidationResult} 验证结果
   */
  validate(password: string): PasswordValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查长度
    if (password.length < this.config.minLength) {
      errors.push(
        `Password must be at least ${this.config.minLength} characters long`
      );
    }

    if (password.length > this.config.maxLength) {
      errors.push(
        `Password must be no more than ${this.config.maxLength} characters long`
      );
    }

    // 检查复杂度要求
    if (this.config.complexity.uppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.config.complexity.lowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.config.complexity.numbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (
      this.config.complexity.symbols &&
      !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
    ) {
      errors.push('Password must contain at least one special character');
    }

    // 检查常见弱密码
    const commonPasswords = [
      'password',
      '123456',
      '123456789',
      'qwerty',
      'abc123',
      'password123',
      'admin',
      'letmein',
      'welcome',
      'monkey',
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      warnings.push(
        'Password is too common, consider using a stronger password'
      );
    }

    // 检查重复字符
    if (/(.)\1{2,}/.test(password)) {
      warnings.push('Password contains repeated characters');
    }

    // 检查连续字符
    if (
      /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|123|234|345|456|567|678|789|012)/i.test(
        password
      )
    ) {
      warnings.push('Password contains sequential characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * @method generate
   * @description 生成随机密码
   * @param length 密码长度（可选，默认16）
   * @param options 生成选项（可选）
   * @returns {string} 生成的密码
   */
  generate(
    length = 16,
    options?: {
      includeUppercase?: boolean;
      includeLowercase?: boolean;
      includeNumbers?: boolean;
      includeSymbols?: boolean;
      excludeSimilar?: boolean;
    }
  ): string {
    const {
      includeUppercase = true,
      includeLowercase = true,
      includeNumbers = true,
      includeSymbols = true,
      excludeSimilar = true,
    } = options ?? {};

    let charset = '';
    let password = '';

    // 构建字符集
    if (includeUppercase) {
      charset += excludeSimilar
        ? 'ABCDEFGHJKLMNPQRSTUVWXYZ'
        : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }
    if (includeLowercase) {
      charset += excludeSimilar
        ? 'abcdefghijkmnpqrstuvwxyz'
        : 'abcdefghijklmnopqrstuvwxyz';
    }
    if (includeNumbers) {
      charset += excludeSimilar ? '23456789' : '0123456789';
    }
    if (includeSymbols) {
      charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';
    }

    if (charset.length === 0) {
      throw new Error('At least one character type must be included');
    }

    // 生成密码
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }

    // 确保包含所有要求的字符类型
    if (includeUppercase && !/[A-Z]/.test(password)) {
      password = this.replaceRandomChar(password, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    }
    if (includeLowercase && !/[a-z]/.test(password)) {
      password = this.replaceRandomChar(password, 'abcdefghijklmnopqrstuvwxyz');
    }
    if (includeNumbers && !/\d/.test(password)) {
      password = this.replaceRandomChar(password, '0123456789');
    }
    if (
      includeSymbols &&
      !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
    ) {
      password = this.replaceRandomChar(password, '!@#$%^&*()_+-=[]{}|;:,.<>?');
    }

    return password;
  }

  /**
   * @method generateHash
   * @description 生成密码哈希（包含元数据）
   * @param password 原始密码
   * @param saltRounds 盐轮数（可选）
   * @returns {Promise<PasswordHashResult>} 哈希结果
   */
  async generateHash(
    password: string,
    saltRounds?: number
  ): Promise<PasswordHashResult> {
    const hash = await this.hash(password, saltRounds);
    const salt = hash.split('$')[3] || '';

    return {
      hash,
      salt,
      version: 'bcrypt',
      createdAt: new Date(),
    };
  }

  /**
   * @method getRounds
   * @description 获取哈希的盐轮数
   * @param hash 哈希值
   * @returns {number} 盐轮数
   */
  getRounds(hash: string): number {
    try {
      return bcrypt.getRounds(hash);
    } catch (error) {
      this.logger.error(
        'Failed to get rounds from hash',
        LogContext.BUSINESS,
        { error: (error as Error).message },
        error as Error
      );
      return 0;
    }
  }

  /**
   * @method needsRehash
   * @description 检查哈希是否需要重新生成
   * @param hash 哈希值
   * @param saltRounds 目标盐轮数（可选）
   * @returns {boolean} 是否需要重新生成
   */
  needsRehash(hash: string, saltRounds?: number): boolean {
    const targetRounds = saltRounds || this.config.saltRounds;
    const currentRounds = this.getRounds(hash);

    return currentRounds < targetRounds;
  }

  /**
   * @private
   * @method replaceRandomChar
   * @description 替换随机字符
   * @param str 原字符串
   * @param charset 字符集
   * @returns {string} 替换后的字符串
   */
  private replaceRandomChar(str: string, charset: string): string {
    const randomIndex = Math.floor(Math.random() * str.length);
    const randomChar = charset[Math.floor(Math.random() * charset.length)];
    return (
      str.substring(0, randomIndex) +
      randomChar +
      str.substring(randomIndex + 1)
    );
  }

  /**
   * @method getConfig
   * @description 获取密码配置
   * @returns {PasswordConfig} 密码配置
   */
  getConfig(): PasswordConfig {
    return { ...this.config };
  }
}
