import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';

/**
 * @describe ConfigService
 * @description
 * ConfigService 的单元测试套件，测试配置服务的各种功能。
 *
 * 主要测试内容：
 * 1. 服务实例化测试
 * 2. 配置获取测试
 * 3. 环境变量处理测试
 * 4. 配置验证测试
 */
describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigService],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
  });

  /**
   * @test 服务实例化测试
   * @description 验证 ConfigService 能够正确实例化
   */
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * @test 配置获取测试
   * @description 验证能够正确获取各种配置
   */
  it('should return app config', () => {
    const appConfig = service.appConfig;
    expect(appConfig).toBeDefined();
    expect(typeof appConfig).toBe('object');
  });

  /**
   * @test 数据库配置测试
   * @description 验证能够正确获取数据库配置
   */
  it('should return database config', () => {
    const dbConfig = service.databaseConfig;
    expect(dbConfig).toBeDefined();
    expect(typeof dbConfig).toBe('object');
  });

  /**
   * @test Redis配置测试
   * @description 验证能够正确获取Redis配置
   */
  it('should return redis config', () => {
    const redisConfig = service.redisConfig;
    expect(redisConfig).toBeDefined();
    expect(typeof redisConfig).toBe('object');
  });

  /**
   * @test JWT配置测试
   * @description 验证能够正确获取JWT配置
   */
  it('should return jwt config', () => {
    const jwtConfig = service.jwtConfig;
    expect(jwtConfig).toBeDefined();
    expect(typeof jwtConfig).toBe('object');
  });
});
