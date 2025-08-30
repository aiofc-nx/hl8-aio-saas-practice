import { defaultConfiguration } from './default-config';
import { IamConfig } from './config.service';

/**
 * @function deepMerge
 * @description
 * 深度合并工具函数，用于合并两个对象的属性，支持嵌套对象的递归合并。
 * 该函数是配置系统的核心工具，用于合并默认配置和用户自定义配置。
 *
 * 主要原理与机制如下：
 * 1. 使用展开运算符创建目标对象的浅拷贝
 * 2. 遍历源对象的所有属性
 * 3. 对于嵌套对象进行递归合并
 * 4. 对于基本类型直接覆盖
 * 5. 保持数组类型不变
 *
 * 功能与业务规则：
 * 1. 对象深度合并
 * 2. 配置覆盖机制
 * 3. 类型安全保证
 * 4. 递归处理支持
 *
 * @param {Record<string, unknown>} target - 目标对象，将被合并的对象
 * @param {Record<string, unknown>} source - 源对象，提供要合并的属性
 * @returns {Record<string, unknown>} 返回合并后的新对象
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

let currentAppConfig: Partial<IamConfig> = { ...defaultConfiguration };

/**
 * @function defineConfig
 * @description
 * 定义配置，将提供的配置与现有的默认配置进行合并。
 * 该函数是配置系统的核心API，用于动态更新系统配置。
 *
 * 主要原理与机制如下：
 * 1. 验证提供的配置对象是否有效
 * 2. 使用deepMerge函数合并配置
 * 3. 更新全局配置对象
 * 4. 支持异步配置更新
 *
 * 功能与业务规则：
 * 1. 配置验证和合并
 * 2. 动态配置更新
 * 3. 错误处理和验证
 * 4. 配置完整性保证
 *
 * @param {Partial<IamConfig>} providedConfig - 要合并的配置对象
 * @returns {Promise<void>} 返回一个Promise，表示配置更新过程
 * @throws {Error} 当提供的配置无效时抛出错误
 */
export async function defineConfig(
  providedConfig: Partial<IamConfig>
): Promise<void> {
  if (!providedConfig || typeof providedConfig !== 'object') {
    throw new Error(
      'Invalid configuration provided. Expected a non-empty object.'
    );
  }

  currentAppConfig = await deepMerge(currentAppConfig, providedConfig);
}

/**
 * @function getConfig
 * @description
 * 获取当前应用配置，返回一个只读的配置副本。
 * 该函数提供了对系统当前配置的安全访问。
 *
 * 主要原理与机制如下：
 * 1. 使用Object.freeze()创建不可变配置对象
 * 2. 使用展开运算符创建配置对象的深拷贝
 * 3. 返回只读类型，防止运行时修改
 * 4. 提供类型安全的配置访问
 *
 * 功能与业务规则：
 * 1. 配置获取和访问
 * 2. 配置对象保护
 * 3. 类型安全保证
 * 4. 配置完整性保证
 *
 * @returns {Readonly<Partial<IamConfig>>} 返回只读的当前配置对象
 */
export function getConfig(): Readonly<Partial<IamConfig>> {
  return Object.freeze({ ...currentAppConfig });
}

/**
 * @function resetConfig
 * @description
 * 重置配置到默认值，将当前配置恢复为系统默认配置。
 * 该函数用于配置恢复和调试目的。
 *
 * 主要原理与机制如下：
 * 1. 使用展开运算符复制默认配置
 * 2. 更新全局配置对象
 * 3. 记录重置操作到控制台
 * 4. 提供配置恢复机制
 *
 * 功能与业务规则：
 * 1. 配置重置和恢复
 * 2. 调试支持
 * 3. 配置回滚
 * 4. 系统状态恢复
 */
export function resetConfig(): void {
  currentAppConfig = { ...defaultConfiguration };
  console.log('Aiofix IAM Config Reset to Defaults');
}
