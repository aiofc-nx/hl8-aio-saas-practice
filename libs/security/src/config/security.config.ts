/**
 * @file security.config.ts
 * @description 安全配置类
 *
 * 该文件定义了安全配置类，包括：
 * - JWT配置
 * - 密码加密配置
 * - CORS配置
 * - 安全头配置
 * - 速率限制配置
 * - 认证配置
 * - 授权配置
 *
 * 遵循DDD和Clean Architecture原则，提供统一的安全配置管理。
 */

import { registerAs } from '@nestjs/config';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  SecurityConfig,
  JwtConfig,
  PasswordConfig,
  CorsConfig,
  SecurityHeadersConfig,
  RateLimitConfig,
  AuthenticationConfig,
  AuthorizationConfig,
} from '../interfaces/security.interface';

/**
 * @class JwtConfigClass
 * @description JWT配置类
 */
export class JwtConfigClass implements JwtConfig {
  @IsString()
  secret: string =
    process.env.JWT_ACCESS_TOKEN_SECRET ||
    'your-super-secret-jwt-key-change-in-production';

  @IsString()
  expiresIn: string = process.env.JWT_EXPIRES_IN || '15m';

  @IsString()
  refreshExpiresIn: string = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  @IsString()
  @IsOptional()
  issuer?: string = process.env.JWT_ISSUER;

  @IsString()
  @IsOptional()
  audience?: string = process.env.JWT_AUDIENCE;

  @IsBoolean()
  enabled: boolean = process.env.JWT_ENABLED !== 'false';
}

/**
 * @class PasswordConfigClass
 * @description 密码配置类
 */
export class PasswordConfigClass implements PasswordConfig {
  @IsNumber()
  saltRounds: number = parseInt(process.env.PASSWORD_SALT_ROUNDS || '12', 10);

  @IsNumber()
  minLength: number = parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10);

  @IsNumber()
  maxLength: number = parseInt(process.env.PASSWORD_MAX_LENGTH || '128', 10);

  @ValidateNested()
  @Type(() => Object)
  complexity: {
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
  } = {
    uppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
    lowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== 'false',
    numbers: process.env.PASSWORD_REQUIRE_NUMBERS !== 'false',
    symbols: process.env.PASSWORD_REQUIRE_SYMBOLS !== 'false',
  };
}

/**
 * @class CorsConfigClass
 * @description CORS配置类
 */
export class CorsConfigClass implements CorsConfig {
  @IsBoolean()
  enabled: boolean = process.env.CORS_ENABLED !== 'false';

  origin: string | string[] | boolean = process.env.CORS_ORIGIN || true;

  @IsArray()
  @IsString({ each: true })
  methods: string[] = (
    process.env.CORS_METHODS || 'GET,HEAD,PUT,PATCH,POST,DELETE'
  ).split(',');

  @IsArray()
  @IsString({ each: true })
  allowedHeaders: string[] = (
    process.env.CORS_ALLOWED_HEADERS ||
    'Content-Type,Authorization,X-Requested-With'
  ).split(',');

  @IsArray()
  @IsString({ each: true })
  exposedHeaders: string[] = (process.env.CORS_EXPOSED_HEADERS || '')
    .split(',')
    .filter(Boolean);

  @IsBoolean()
  credentials: boolean = process.env.CORS_CREDENTIALS === 'true';

  @IsNumber()
  maxAge: number = parseInt(process.env.CORS_MAX_AGE || '86400', 10);
}

/**
 * @class SecurityHeadersConfigClass
 * @description 安全头配置类
 */
export class SecurityHeadersConfigClass implements SecurityHeadersConfig {
  @IsBoolean()
  enabled: boolean = process.env.SECURITY_HEADERS_ENABLED !== 'false';

  @ValidateNested()
  @Type(() => Object)
  @IsOptional()
  contentSecurityPolicy?: {
    directives: Record<string, string[]>;
    reportOnly: boolean;
  } =
    process.env.CSP_ENABLED === 'true'
      ? {
          directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'", "'unsafe-inline'"],
            'style-src': ["'self'", "'unsafe-inline'"],
            'img-src': ["'self'", 'data:', 'https:'],
            'connect-src': ["'self'"],
            'font-src': ["'self'"],
            'object-src': ["'none'"],
            'media-src': ["'self'"],
            'frame-src': ["'none'"],
          },
          reportOnly: process.env.CSP_REPORT_ONLY === 'true',
        }
      : undefined;

  @ValidateNested()
  @Type(() => Object)
  @IsOptional()
  hsts?: {
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  } =
    process.env.HSTS_ENABLED === 'true'
      ? {
          maxAge: parseInt(process.env.HSTS_MAX_AGE || '31536000', 10),
          includeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS === 'true',
          preload: process.env.HSTS_PRELOAD === 'true',
        }
      : undefined;

  @IsOptional()
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM' =
    (process.env.X_FRAME_OPTIONS as 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM') ||
    'DENY';

  @IsBoolean()
  @IsOptional()
  xContentTypeOptions?: boolean =
    process.env.X_CONTENT_TYPE_OPTIONS !== 'false';

  @IsBoolean()
  @IsOptional()
  xssProtection?: boolean = process.env.XSS_PROTECTION !== 'false';

  @IsString()
  @IsOptional()
  referrerPolicy?: string =
    process.env.REFERRER_POLICY || 'strict-origin-when-cross-origin';

  @ValidateNested()
  @Type(() => Object)
  @IsOptional()
  permissionsPolicy?: Record<string, string[]> =
    process.env.PERMISSIONS_POLICY_ENABLED === 'true'
      ? {
          camera: ['self'],
          microphone: ['self'],
          geolocation: ['self'],
          payment: ['self'],
        }
      : undefined;
}

/**
 * @class RateLimitConfigClass
 * @description 速率限制配置类
 */
export class RateLimitConfigClass implements RateLimitConfig {
  @IsBoolean()
  enabled: boolean = process.env.RATE_LIMIT_ENABLED !== 'false';

  @IsNumber()
  windowMs: number = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10); // 15 minutes

  @IsNumber()
  max: number = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);

  @IsBoolean()
  skipSuccessfulRequests: boolean =
    process.env.RATE_LIMIT_SKIP_SUCCESSFUL === 'true';

  @IsBoolean()
  skipFailedRequests: boolean = process.env.RATE_LIMIT_SKIP_FAILED === 'false';

  @IsString()
  message: string =
    process.env.RATE_LIMIT_MESSAGE ||
    'Too many requests from this IP, please try again later.';

  @IsNumber()
  statusCode: number = parseInt(
    process.env.RATE_LIMIT_STATUS_CODE || '429',
    10,
  );
}

/**
 * @class AuthenticationConfigClass
 * @description 认证配置类
 */
export class AuthenticationConfigClass implements AuthenticationConfig {
  @IsBoolean()
  enabled: boolean = process.env.AUTH_ENABLED !== 'false';

  @IsString()
  defaultStrategy: string = process.env.AUTH_DEFAULT_STRATEGY || 'jwt';

  @ValidateNested()
  @Type(() => Object)
  @IsOptional()
  session?: {
    enabled: boolean;
    secret: string;
    name: string;
    maxAge: number;
    resave: boolean;
    saveUninitialized: boolean;
  } =
    process.env.AUTH_SESSION_ENABLED === 'true'
      ? {
          enabled: true,
          secret: process.env.AUTH_SESSION_SECRET || 'your-session-secret',
          name: process.env.AUTH_SESSION_NAME || 'sid',
          maxAge: parseInt(process.env.AUTH_SESSION_MAX_AGE || '86400000', 10),
          resave: process.env.AUTH_SESSION_RESAVE === 'true',
          saveUninitialized:
            process.env.AUTH_SESSION_SAVE_UNINITIALIZED === 'true',
        }
      : undefined;

  @ValidateNested()
  @Type(() => Object)
  strategies: {
    jwt?: {
      enabled: boolean;
      secret: string;
      expiresIn: string;
    };
    local?: {
      enabled: boolean;
      usernameField: string;
      passwordField: string;
    };
    oauth?: {
      enabled: boolean;
      providers: Record<string, any>;
    };
  } = {
    jwt: {
      enabled: process.env.AUTH_JWT_ENABLED !== 'false',
      secret: process.env.JWT_SECRET || 'your-jwt-secret',
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    },
    local: {
      enabled: process.env.AUTH_LOCAL_ENABLED !== 'false',
      usernameField: process.env.AUTH_LOCAL_USERNAME_FIELD || 'username',
      passwordField: process.env.AUTH_LOCAL_PASSWORD_FIELD || 'password',
    },
    oauth: {
      enabled: process.env.AUTH_OAUTH_ENABLED === 'true',
      providers: {},
    },
  };
}

/**
 * @class AuthorizationConfigClass
 * @description 授权配置类
 */
export class AuthorizationConfigClass implements AuthorizationConfig {
  @IsBoolean()
  enabled: boolean = process.env.AUTHZ_ENABLED !== 'false';

  @IsString()
  defaultRole: string = process.env.AUTHZ_DEFAULT_ROLE || 'user';

  @IsString()
  superAdminRole: string = process.env.AUTHZ_SUPER_ADMIN_ROLE || 'super-admin';

  @ValidateNested()
  @Type(() => Object)
  roleHierarchy: Record<string, string[]> = {
    'super-admin': ['admin', 'user'],
    admin: ['user'],
    user: [],
  };

  @ValidateNested()
  @Type(() => Object)
  permissions: {
    enabled: boolean;
    cacheTtl: number;
  } = {
    enabled: process.env.AUTHZ_PERMISSIONS_ENABLED !== 'false',
    cacheTtl: parseInt(process.env.AUTHZ_PERMISSIONS_CACHE_TTL || '300000', 10), // 5 minutes
  };
}

/**
 * @class SecurityConfigClass
 * @description 安全配置主类
 */
export class SecurityConfigClass implements SecurityConfig {
  @ValidateNested()
  @Type(() => JwtConfigClass)
  jwt: JwtConfigClass = new JwtConfigClass();

  @ValidateNested()
  @Type(() => PasswordConfigClass)
  password: PasswordConfigClass = new PasswordConfigClass();

  @ValidateNested()
  @Type(() => CorsConfigClass)
  cors: CorsConfigClass = new CorsConfigClass();

  @ValidateNested()
  @Type(() => SecurityHeadersConfigClass)
  securityHeaders: SecurityHeadersConfigClass =
    new SecurityHeadersConfigClass();

  @ValidateNested()
  @Type(() => RateLimitConfigClass)
  rateLimit: RateLimitConfigClass = new RateLimitConfigClass();

  @ValidateNested()
  @Type(() => AuthenticationConfigClass)
  authentication: AuthenticationConfigClass = new AuthenticationConfigClass();

  @ValidateNested()
  @Type(() => AuthorizationConfigClass)
  authorization: AuthorizationConfigClass = new AuthorizationConfigClass();
}

/**
 * @function securityConfig
 * @description 安全配置注册函数
 * @returns {SecurityConfig} 安全配置对象
 */
export const securityConfig = registerAs('security', (): SecurityConfig => {
  const config = new SecurityConfigClass();
  return config;
});
