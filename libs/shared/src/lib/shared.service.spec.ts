import { Test, TestingModule } from '@nestjs/testing';
import { SharedService } from './shared.service';

/**
 * @description
 * SharedService 的单元测试
 *
 * 测试覆盖：
 * 1. 服务实例化
 * 2. 基本方法功能
 * 3. 服务信息获取
 */
describe('SharedService', () => {
  let service: SharedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SharedService],
    }).compile();

    service = module.get<SharedService>(SharedService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return service info', () => {
    const info = service.getServiceInfo();
    expect(info).toBe('Shared Service - 提供跨领域共享的基础服务');
  });
});
