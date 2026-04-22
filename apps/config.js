import fs from 'fs';
import path from 'path';

// 使用process.cwd()作为项目根目录的基准
const projectRoot = process.cwd();

// 配置文件路径
const configPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'config', 'config.yaml');
const defaultConfigPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'config', 'defaultConfig', 'config.yaml');

// 检查并复制配置文件
function checkAndCopyConfig() {
  try {
    // 检查config目录是否存在
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log('创建config目录成功');
    }

    // 检查config.yaml文件是否存在
    if (!fs.existsSync(configPath)) {
      // 检查默认配置文件是否存在
      if (fs.existsSync(defaultConfigPath)) {
        // 复制默认配置文件
        fs.copyFileSync(defaultConfigPath, configPath);
        console.log('配置文件不存在，已从默认配置复制');
      } else {
        console.warn('默认配置文件不存在，无法复制');
      }
    } else {
      console.log('配置文件已存在，无需复制');
    }
  } catch (error) {
    console.error('检查配置文件时出错:', error);
  }
}

// 导出函数
function initConfig() {
  checkAndCopyConfig();
}

export default initConfig;

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  initConfig();
}