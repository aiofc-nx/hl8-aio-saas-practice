/**
 * @file jwt.service.ts
 * @description JWT服务
 *
 * 该文件实现了JWT服务，包括：
 * - JWT令牌生成
 * - JWT令牌验证
 * - JWT令牌刷新
 * - JWT令牌撤销
 *
 * 遵循DDD和Clean Architecture原则，提供安全的JWT管理功能。
 */

import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { PinoLoggerService, LogContext } from '@aiofix/logging';
import type { JwtConfig } from '../interfaces/security.interface';

/**
 * @interface JwtPayload
 * @description JWT载荷接口
 */
export interface JwtPayload {
  /** 用户ID */
  sub: string;
  /** 用户名 */
  username: string;
  /** 邮箱 */
  email?: string;
  /** 角色 */
  roles?: string[];
  /** 权限 */
  permissions?: string[];
  /** 租户ID */
  tenantId?: string;
  /** 发行时间 */
  iat?: number;
  /** 过期时间 */
  exp?: number;
  /** 发行者 */
  iss?: string;
  /** 受众 */
  aud?: string;
  /** JWT ID */
  jti?: string;
}

/**
 * @interface JwtTokenResult
 * @description JWT令牌结果接口
 */
export interface JwtTokenResult {
  /** 访问令牌 */
  accessToken: string;
  /** 刷新令牌 */
  refreshToken: string;
  /** 令牌类型 */
  tokenType: string;
  /** 过期时间（秒） */
  expiresIn: number;
  /** 刷新过期时间（秒） */
  refreshExpiresIn: number;
  /** 载荷 */
  payload: JwtPayload;
}

/**
 * @interface JwtVerifyResult
 * @description JWT验证结果接口
 */
export interface JwtVerifyResult {
  /** 是否有效 */
  isValid: boolean;
  /** 载荷 */
  payload?: JwtPayload;
  /** 错误信息 */
  error?: string;
  /** 是否过期 */
  isExpired?: boolean;
  /** 是否即将过期 */
  isExpiringSoon?: boolean;
}

/**
 * @class JwtService
 * @description JWT服务
 *
 * 提供安全的JWT管理功能，包括：
 * - JWT令牌生成和验证
 * - 访问令牌和刷新令牌管理
 * - 令牌撤销和黑名单
 * - 令牌统计和监控
 *
 * 支持可配置的密钥、过期时间和签名算法。
 */
@Injectable()
export class JwtService {
  private readonly logger: PinoLoggerService;
  private readonly config: JwtConfig;
  private readonly revokedTokens: Set<string> = new Set();

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(NestJwtService) private readonly jwtService: NestJwtService,
    logger: PinoLoggerService
  ) {
    this.logger = logger;
    this.config = this.configService.get<JwtConfig>('security.jwt') ?? {
      secret: 'default-secret-key',
      expiresIn: '1h',
      refreshExpiresIn: '7d',
      enabled: true,
    };

    if (!this.config) {
      this.logger.error('JWT configuration not found', LogContext.BUSINESS);
      throw new Error('JWT configuration not found');
    }

    this.logger.debug('JWT configuration loaded', LogContext.BUSINESS, {
      secret: this.config.secret ? '***' : 'undefined',
      expiresIn: this.config.expiresIn,
      enabled: this.config.enabled,
    });
  }

  /**
   * @method generateToken
   * @description 生成JWT令牌
   * @param payload JWT载荷
   * @param options 生成选项（可选）
   * @returns {JwtTokenResult} JWT令牌结果
   */
  generateToken(
    payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'>,
    options?: {
      expiresIn?: string;
      refreshExpiresIn?: string;
      issuer?: string;
      audience?: string;
    }
  ): JwtTokenResult {
    const {
      expiresIn = this.config.expiresIn,
      refreshExpiresIn = this.config.refreshExpiresIn,
    } = options || {};

    const jti = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    // 构建访问令牌载荷
    const accessPayload: JwtPayload = {
      ...payload,
      iat: now,
      jti,
    };

    // 构建刷新令牌载荷
    const refreshPayload: JwtPayload = {
      sub: payload.sub,
      username: payload.username,
      jti: uuidv4(),
      iat: now,
    };

    try {
      this.logger.debug('Generating JWT tokens', LogContext.BUSINESS, {
        userId: payload.sub,
        jti,
      });

      const accessToken = this.jwtService.sign(accessPayload, {
        expiresIn: expiresIn,
      });
      const refreshToken = this.jwtService.sign(refreshPayload, {
        expiresIn: refreshExpiresIn,
      });

      this.logger.debug(
        'JWT tokens generated successfully',
        LogContext.BUSINESS,
        { userId: payload.sub, jti }
      );

      return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.parseExpiresIn(expiresIn),
        refreshExpiresIn: this.parseExpiresIn(refreshExpiresIn),
        payload: accessPayload,
      };
    } catch (error) {
      this.logger.error(
        'Failed to generate JWT tokens',
        LogContext.BUSINESS,
        {
          error: (error as Error).message,
          userId: payload.sub,
          config: {
            secret: this.config.secret ? '***' : 'undefined',
            expiresIn: this.config.expiresIn,
            enabled: this.config.enabled,
          },
        },
        error as Error
      );
      throw new Error(
        `JWT token generation failed: ${(error as Error).message}`
      );
    }
  }

  /**
   * @method verifyToken
   * @description 验证JWT令牌
   * @param token JWT令牌
   * @param options 验证选项（可选）
   * @returns {JwtVerifyResult} 验证结果
   */
  verifyToken(
    token: string,
    options?: {
      ignoreExpiration?: boolean;
      issuer?: string;
      audience?: string;
    }
  ): JwtVerifyResult {
    const {
      ignoreExpiration = false,
      issuer = this.config.issuer,
      audience = this.config.audience,
    } = options || {};

    try {
      // 检查令牌是否被撤销
      if (this.revokedTokens.has(token)) {
        return {
          isValid: false,
          error: 'Token has been revoked',
        };
      }

      this.logger.debug('Verifying JWT token', LogContext.BUSINESS);

      const payload = this.jwtService.verify<JwtPayload>(token, {
        ignoreExpiration,
        issuer,
        audience,
      });

      const now = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp ? payload.exp < now : false;
      const isExpiringSoon = payload.exp ? payload.exp - now < 300 : false; // 5分钟内过期

      this.logger.debug(
        'JWT token verified successfully',
        LogContext.BUSINESS,
        { userId: payload.sub, isExpired, isExpiringSoon }
      );

      return {
        isValid: true,
        payload,
        isExpired,
        isExpiringSoon,
      };
    } catch (error) {
      const errorMessage = (error as Error).message;
      const isExpired = errorMessage.includes('jwt expired');

      this.logger.warn('JWT token verification failed', LogContext.BUSINESS, {
        error: errorMessage,
        isExpired,
      });

      return {
        isValid: false,
        error: errorMessage,
        isExpired,
      };
    }
  }

  /**
   * @method refreshToken
   * @description 刷新JWT令牌
   * @param refreshToken 刷新令牌
   * @param newPayload 新的载荷（可选）
   * @returns {JwtTokenResult} 新的JWT令牌结果
   */
  refreshToken(
    refreshToken: string,
    newPayload?: Partial<JwtPayload>
  ): JwtTokenResult {
    const verifyResult = this.verifyToken(refreshToken);

    if (!verifyResult.isValid || !verifyResult.payload) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 撤销旧的刷新令牌
    this.revokeToken(refreshToken);

    // 构建新的载荷
    const payload: Omit<JwtPayload, 'iat' | 'exp' | 'jti'> = {
      sub: verifyResult.payload.sub,
      username: verifyResult.payload.username,
      ...(verifyResult.payload.email && { email: verifyResult.payload.email }),
      ...(verifyResult.payload.roles && { roles: verifyResult.payload.roles }),
      ...(verifyResult.payload.permissions && {
        permissions: verifyResult.payload.permissions,
      }),
      ...(verifyResult.payload.tenantId && {
        tenantId: verifyResult.payload.tenantId,
      }),
      ...newPayload,
    };

    return this.generateToken(payload);
  }

  /**
   * @method revokeToken
   * @description 撤销JWT令牌
   * @param token JWT令牌
   * @returns {boolean} 是否成功撤销
   */
  revokeToken(token: string): boolean {
    try {
      this.logger.debug('Revoking JWT token', LogContext.BUSINESS);

      this.revokedTokens.add(token);

      this.logger.debug('JWT token revoked successfully', LogContext.BUSINESS);

      return true;
    } catch (error) {
      this.logger.error(
        'Failed to revoke JWT token',
        LogContext.BUSINESS,
        { error: (error as Error).message },
        error as Error
      );
      return false;
    }
  }

  /**
   * @method revokeAllUserTokens
   * @description 撤销用户的所有令牌
   * @param userId 用户ID
   * @returns {number} 撤销的令牌数量
   */
  revokeAllUserTokens(userId: string): number {
    // 注意：这是一个简化的实现
    // 在生产环境中，应该使用Redis或其他存储来管理令牌黑名单
    this.logger.warn(
      'Revoking all tokens for user (simplified implementation)',
      LogContext.BUSINESS,
      { userId }
    );
    return 0;
  }

  /**
   * @method decodeToken
   * @description 解码JWT令牌（不验证签名）
   * @param token JWT令牌
   * @returns {JwtPayload | null} 解码后的载荷
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      return this.jwtService.decode(token);
    } catch (error) {
      this.logger.error(
        'Failed to decode JWT token',
        LogContext.BUSINESS,
        { error: (error as Error).message },
        error as Error
      );
      return null;
    }
  }

  /**
   * @method extractTokenFromHeader
   * @description 从请求头中提取JWT令牌
   * @param authorizationHeader 授权头
   * @returns {string | null} JWT令牌
   */
  extractTokenFromHeader(authorizationHeader: string): string | null {
    if (!authorizationHeader) {
      return null;
    }

    const [type, token] = authorizationHeader.split(' ');

    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  /**
   * @method isTokenRevoked
   * @description 检查令牌是否被撤销
   * @param token JWT令牌
   * @returns {boolean} 是否被撤销
   */
  isTokenRevoked(token: string): boolean {
    return this.revokedTokens.has(token);
  }

  /**
   * @method getRevokedTokensCount
   * @description 获取撤销令牌数量
   * @returns {number} 撤销令牌数量
   */
  getRevokedTokensCount(): number {
    return this.revokedTokens.size;
  }

  /**
   * @method clearRevokedTokens
   * @description 清除撤销令牌缓存
   * @returns {number} 清除的令牌数量
   */
  clearRevokedTokens(): number {
    const count = this.revokedTokens.size;
    this.revokedTokens.clear();

    this.logger.info('Cleared revoked tokens cache', LogContext.BUSINESS, {
      count,
    });

    return count;
  }

  /**
   * @method getConfig
   * @description 获取JWT配置
   * @returns {JwtConfig} JWT配置
   */
  getConfig(): JwtConfig {
    return { ...this.config };
  }

  /**
   * @private
   * @method parseExpiresIn
   * @description 解析过期时间字符串为秒数
   * @param expiresIn 过期时间字符串
   * @returns {number} 秒数
   */
  private parseExpiresIn(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expiresIn format: ${expiresIn}`);
    }

    const [, value, unit] = match;
    const numValue = parseInt(value || '0', 10);

    switch (unit) {
      case 's':
        return numValue;
      case 'm':
        return numValue * 60;
      case 'h':
        return numValue * 60 * 60;
      case 'd':
        return numValue * 60 * 60 * 24;
      default:
        throw new Error(`Unknown time unit: ${unit}`);
    }
  }
}
