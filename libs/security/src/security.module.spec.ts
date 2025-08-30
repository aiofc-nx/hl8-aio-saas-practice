/**
 * @file security.module.spec.ts
 * @description 安全模块测试
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SecurityModule } from './security.module';

describe('SecurityModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SecurityModule.register({
          config: {
            jwt: {
              secret: 'test-secret',
              expiresIn: '1h',
              refreshExpiresIn: '7d',
              enabled: true,
            },
            password: {
              saltRounds: 10,
              minLength: 8,
              maxLength: 128,
              complexity: {
                uppercase: true,
                lowercase: true,
                numbers: true,
                symbols: true,
              },
            },
          },
          jwt: false, // 禁用JWT以避免配置依赖问题
          password: false, // 禁用密码服务以避免依赖问题
        }),
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have security config provider', () => {
    const config = module.get('SECURITY_CONFIG');
    expect(config).toBeDefined();
  });
});
