/**
 * @file database.module.spec.ts
 * @description 数据库模块测试
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseModule } from './database.module';

describe('DatabaseModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseModule.register({
          config: {
            type: 'postgresql',
            host: 'localhost',
            port: 5432,
            username: 'test',
            password: 'test',
            database: 'test',
          },
          postgresql: false, // 禁用PostgreSQL以避免连接测试
        }),
      ],
    })
      .overrideProvider('IDatabaseAdapter')
      .useValue({})
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have database config provider', () => {
    const config = module.get('DATABASE_CONFIG');
    expect(config).toBeDefined();
    expect(config.type).toBe('postgresql');
  });

  it('should have database name provider', () => {
    const name = module.get('DATABASE_NAME');
    expect(name).toBeDefined();
  });
});
