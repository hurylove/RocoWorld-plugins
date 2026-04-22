import fs from 'node:fs';
import initConfig from './apps/config.js';

if (!global.segment) {
  global.segment = (await import("oicq")).segment;
}

// 初始化配置文件
initConfig();

let ret = [];

logger.info(logger.yellow("- 正在载入 ROCOWORLD-PLUGIN"));

const files = fs
  .readdirSync('./plugins/RocoWorld-plugins/apps')
  .filter((file) => file.endsWith('.js') && file !== 'config.js');

files.forEach((file) => {
  ret.push(import(`./apps/${file}`))
})

ret = await Promise.allSettled(ret);

let apps = {};

for (let i in files) {
  let name = files[i].replace('.js', '');

  if (ret[i].status !== 'fulfilled') {
    logger.error(`载入插件错误：${logger.red(name)}`);
    logger.error(ret[i].reason);
    continue;
  }
  apps[name] = ret[i].value[Object.keys(ret[i].value)[0]];
}

logger.info(logger.green(`  ┌─────────────────────────────────────────┐`));
logger.info(logger.green(`  │                                         │`));
logger.info(logger.green(`  │  ██████      ████    ███████    ████    │`));
logger.info(logger.green(`  │  ██   ██    ██  ██   ██        ██  ██   │`));
logger.info(logger.green(`  │  ██████    ██    ██  ██       ██    ██  │`));
logger.info(logger.green(`  │  ██  ██     ██  ██   ██        ██  ██   │`));
logger.info(logger.green(`  │  ██   ██     ████    ███████    ████    │`));
logger.info(logger.green(`  │                                         │`));
logger.info(logger.green(`  └─────────────────────────────────────────┘`));
logger.info(logger.green(`ROCOWORLD-PLUGIN 已载入成功`));

export { apps };