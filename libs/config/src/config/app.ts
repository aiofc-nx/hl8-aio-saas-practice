import { registerAs } from '@nestjs/config';

/**
 * Application Configuration
 *
 * Defines configuration settings for the application using the @nestjs/config library.
 * This configuration includes properties such as the application name and logo URL.
 * The configuration values are retrieved from environment variables, with default values provided.
 *
 * @returns An object representing the application configuration.
 */
export default registerAs('app', () => ({
  /**
   * 应用名称
   * 如果未通过环境变量APP_NAME提供，默认为'Aiofix IAM'
   */
  app_name: process.env.APP_NAME || 'Aiofix IAM',

  /**
   * 应用版本
   */
  app_version: process.env.APP_VERSION || '1.0.0',

  /**
   * 应用描述
   */
  app_description:
    process.env.APP_DESCRIPTION ||
    '基于DDD和Clean Architecture的多租户SaaS平台',

  /**
   * 应用Logo URL
   * 如果未通过环境变量APP_LOGO提供，默认使用CLIENT_BASE_URL构建
   */
  app_logo:
    process.env.APP_LOGO ||
    `${process.env.CLIENT_BASE_URL}/assets/images/logos/logo_aiofix.png`,

  /**
   * 应用环境
   */
  environment: process.env.NODE_ENV || 'development',

  /**
   * 是否启用调试模式
   */
  debug: process.env.APP_DEBUG === 'true',

  /**
   * 是否启用演示模式
   */
  demo: process.env.APP_DEMO === 'true',

  /**
   * 客户端基础URL
   */
  client_base_url: process.env.CLIENT_BASE_URL || 'http://localhost:3000',

  /**
   * API基础URL
   */
  api_base_url: process.env.API_BASE_URL || 'http://localhost:3000/api/v1',

  /**
   * 文档URL
   */
  docs_url: process.env.DOCS_URL || 'http://localhost:3000/api/v1/docs',
}));
