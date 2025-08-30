/**
 * @file security.interface.ts
 * @description 安全配置接口定义
 *
 * 该文件定义了安全配置相关的接口，包括：
 * - JWT配置接口
 * - 密码加密配置接口
 * - CORS配置接口
 * - 安全头配置接口
 * - 认证策略接口
 *
 * 遵循DDD和Clean Architecture原则，提供统一的安全配置抽象。
 */

/**
 * @interface JwtConfig
 * @description JWT配置接口
 */
export interface JwtConfig {
  /** JWT密钥 */
  secret: string;
  /** JWT过期时间（秒） */
  expiresIn: string;
  /** JWT刷新令牌过期时间（秒） */
  refreshExpiresIn: string;
  /** JWT发行者 */
  issuer?: string;
  /** JWT受众 */
  audience?: string;
  /** 是否启用JWT */
  enabled: boolean;
}

/**
 * @interface PasswordConfig
 * @description 密码加密配置接口
 */
export interface PasswordConfig {
  /** 密码加密轮数 */
  saltRounds: number;
  /** 密码最小长度 */
  minLength: number;
  /** 密码最大长度 */
  maxLength: number;
  /** 密码复杂度要求 */
  complexity: {
    /** 是否要求大写字母 */
    uppercase: boolean;
    /** 是否要求小写字母 */
    lowercase: boolean;
    /** 是否要求数字 */
    numbers: boolean;
    /** 是否要求特殊字符 */
    symbols: boolean;
  };
}

/**
 * @interface CorsConfig
 * @description CORS配置接口
 */
export interface CorsConfig {
  /** 是否启用CORS */
  enabled: boolean;
  /** 允许的源 */
  origin: string | string[] | boolean;
  /** 允许的方法 */
  methods: string[];
  /** 允许的头部 */
  allowedHeaders: string[];
  /** 暴露的头部 */
  exposedHeaders: string[];
  /** 是否允许凭证 */
  credentials: boolean;
  /** 预检请求缓存时间 */
  maxAge: number;
}

/**
 * @interface SecurityHeadersConfig
 * @description 安全头配置接口
 */
export interface SecurityHeadersConfig {
  /** 是否启用安全头 */
  enabled: boolean;
  /** 内容安全策略 */
  contentSecurityPolicy?: {
    /** CSP指令 */
    directives: Record<string, string[]>;
    /** 是否报告违规 */
    reportOnly: boolean;
  };
  /** 严格传输安全 */
  hsts?: {
    /** 最大年龄 */
    maxAge: number;
    /** 是否包含子域名 */
    includeSubDomains: boolean;
    /** 是否预加载 */
    preload: boolean;
  };
  /** X-Frame-Options */
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
  /** X-Content-Type-Options */
  xContentTypeOptions?: boolean;
  /** X-XSS-Protection */
  xssProtection?: boolean;
  /** Referrer-Policy */
  referrerPolicy?: string;
  /** Permissions-Policy */
  permissionsPolicy?: Record<string, string[]>;
}

/**
 * @interface RateLimitConfig
 * @description 速率限制配置接口
 */
export interface RateLimitConfig {
  /** 是否启用速率限制 */
  enabled: boolean;
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 最大请求数 */
  max: number;
  /** 跳过成功的请求 */
  skipSuccessfulRequests: boolean;
  /** 跳过失败的请求 */
  skipFailedRequests: boolean;
  /** 消息 */
  message: string;
  /** 状态码 */
  statusCode: number;
}

/**
 * @interface AuthenticationConfig
 * @description 认证配置接口
 */
export interface AuthenticationConfig {
  /** 是否启用认证 */
  enabled: boolean;
  /** 默认策略 */
  defaultStrategy: string;
  /** 会话配置 */
  session?: {
    /** 是否启用会话 */
    enabled: boolean;
    /** 会话密钥 */
    secret: string;
    /** 会话名称 */
    name: string;
    /** 会话过期时间 */
    maxAge: number;
    /** 是否重新保存 */
    resave: boolean;
    /** 是否强制保存 */
    saveUninitialized: boolean;
  };
  /** 策略配置 */
  strategies: {
    /** JWT策略 */
    jwt?: {
      enabled: boolean;
      secret: string;
      expiresIn: string;
    };
    /** 本地策略 */
    local?: {
      enabled: boolean;
      usernameField: string;
      passwordField: string;
    };
    /** OAuth策略 */
    oauth?: {
      enabled: boolean;
      providers: Record<string, any>;
    };
  };
}

/**
 * @interface AuthorizationConfig
 * @description 授权配置接口
 */
export interface AuthorizationConfig {
  /** 是否启用授权 */
  enabled: boolean;
  /** 默认角色 */
  defaultRole: string;
  /** 超级管理员角色 */
  superAdminRole: string;
  /** 角色层次结构 */
  roleHierarchy: Record<string, string[]>;
  /** 权限配置 */
  permissions: {
    /** 是否启用权限 */
    enabled: boolean;
    /** 权限缓存时间 */
    cacheTtl: number;
  };
}

/**
 * @interface SecurityConfig
 * @description 安全配置主接口
 */
export interface SecurityConfig {
  /** JWT配置 */
  jwt: JwtConfig;
  /** 密码配置 */
  password: PasswordConfig;
  /** CORS配置 */
  cors: CorsConfig;
  /** 安全头配置 */
  securityHeaders: SecurityHeadersConfig;
  /** 速率限制配置 */
  rateLimit: RateLimitConfig;
  /** 认证配置 */
  authentication: AuthenticationConfig;
  /** 授权配置 */
  authorization: AuthorizationConfig;
}

/**
 * @interface SecurityHealth
 * @description 安全健康状态接口
 */
export interface SecurityHealth {
  /** 是否健康 */
  healthy: boolean;
  /** 检查时间 */
  timestamp: Date;
  /** 错误信息 */
  error?: string;
  /** 组件状态 */
  components: {
    /** JWT状态 */
    jwt: boolean;
    /** 密码加密状态 */
    password: boolean;
    /** CORS状态 */
    cors: boolean;
    /** 安全头状态 */
    securityHeaders: boolean;
    /** 速率限制状态 */
    rateLimit: boolean;
    /** 认证状态 */
    authentication: boolean;
    /** 授权状态 */
    authorization: boolean;
  };
}

/**
 * @interface SecurityStats
 * @description 安全统计信息接口
 */
export interface SecurityStats {
  /** 总请求数 */
  totalRequests: number;
  /** 认证请求数 */
  authRequests: number;
  /** 授权请求数 */
  authzRequests: number;
  /** 失败的认证请求数 */
  failedAuthRequests: number;
  /** 失败的授权请求数 */
  failedAuthzRequests: number;
  /** 速率限制触发次数 */
  rateLimitHits: number;
  /** 安全违规次数 */
  securityViolations: number;
  /** 最后重置时间 */
  lastReset: Date;
}
