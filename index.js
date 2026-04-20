import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

logger.info(logger.yellow("- 正在载入 ROCOWORLD-PLUGIN"));

// 导入插件模块
const plugins = [];

// 读取apps目录下的所有js文件
const appsDir = path.join(__dirname, 'apps');
const files = fs.readdirSync(appsDir).filter(file => file.endsWith('.js'));

// 导入每个插件文件
for (const file of files) {
  try {
    const modulePath = path.join(appsDir, file);
    const module = await import(`file://${modulePath}`);
    
    // 注册插件
    if (module.register) {
      module.register();
    } else {
      // 尝试获取导出的类
      const exportKeys = Object.keys(module);
      for (const key of exportKeys) {
        const ExportClass = module[key];
        if (typeof ExportClass === 'function') {
          try {
            new ExportClass();
          } catch (e) {
            logger.error(`注册插件 ${file} 失败: ${e.message}`);
          }
        }
      }
    }
    
    logger.info(`- 成功载入插件: ${file}`);
  } catch (error) {
    logger.error(`载入插件 ${file} 失败: ${error.message}`);
  }
}

logger.info(logger.green("- ROCOWORLD-PLUGIN 载入成功"));

// 导出空对象，符合Yunzai插件格式
export default {
  /** 插件信息 */
  info: {
    name: 'RocoWorld-plugins',
    version: '1.0.0',
    author: '',
    description: '洛克王国世界查询插件'
  }
};