import fs from 'fs';
import path from 'path';
import plugin from '../../../lib/plugins/plugin.js';
import { refreshYxsrLog } from './mode/wikiCrawler.js';

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'config', 'config.yaml');

function parseYAML(yamlContent) {
  const config = {};
  const lines = yamlContent.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmedLine.substring(0, colonIndex).trim();
      let value = trimmedLine.substring(colonIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.substring(1, value.length - 1);
      }

      config[key] = value;
    }
  }

  return config;
}

function loadConfig() {
  try {
    const configData = fs.readFileSync(configPath, 'utf-8');
    return parseYAML(configData);
  } catch (error) {
    console.warn('读取配置文件失败，使用默认配置:', error.message);
    return {};
  }
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const v = String(value).trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(v);
}

function parseGroups(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPushSlotHour(date) {
  const h = date.getHours();
  const min = date.getMinutes();

  // 每个刷新节点后的 5 分钟推送：
  // 08:05、12:05、16:05、20:05
  // 为了防止 event-loop 抖动，允许 5~9 分钟窗口，只推送一次
  const targetHours = [8, 12, 16, 20];
  if (!targetHours.includes(h)) return null;
  if (min < 5 || min > 9) return null;

  return h;
}

function getCurrentSlotKey(date) {
  const slotHour = getPushSlotHour(date);
  if (slotHour === null) return null;
  return `${formatDateKey(date)} ${String(slotHour).padStart(2, '0')}:05`;
}

async function pushYxsrToConfiguredGroups() {
  const cfg = loadConfig();
  const pushEnable = parseBoolean(cfg.yxsrPushEnable, false);
  const groups = parseGroups(cfg.yxsrPushGroups);

  if (!pushEnable) {
    return { ok: false, reason: '未启用 yxsrPushEnable' };
  }

  if (!groups.length) {
    return { ok: false, reason: '未配置 yxsrPushGroups' };
  }

  const message = await refreshYxsrLog();

  if (!global.Bot || typeof Bot.pickGroup !== 'function') {
    throw new Error('Bot 实例不可用，无法发送群消息');
  }

  let successCount = 0;
  let failCount = 0;

  for (const groupId of groups) {
    try {
      const group = Bot.pickGroup(groupId);
      if (!group) {
        failCount++;
        console.warn(`[RocoYxsrPush] 群 ${groupId} 不存在或无法访问`);
        continue;
      }
      await group.sendMsg(message);
      successCount++;
    } catch (error) {
      failCount++;
      console.error(`[RocoYxsrPush] 推送到群 ${groupId} 失败:`, error);
    }
  }

  return {
    ok: successCount > 0,
    message,
    successCount,
    failCount
  };
}

export default class RocoYxsrPush extends plugin {
  constructor() {
    super({
      name: '远行商人-定时推送',
      dsc: '定时更新远行商人日志并推送到指定群',
      event: 'message',
      priority: 400,
      rule: [
        {
          reg: '^#(远行商人推送测试|测试远行商人推送)$',
          fnc: 'manualPush'
        }
      ]
    });

    this.initScheduler();
  }

  initScheduler() {
    if (global.__rocoYxsrPushTimer) return;

    const checkAndRun = async () => {
      try {
        const cfg = loadConfig();
        const pushEnable = parseBoolean(cfg.yxsrPushEnable, false);

        if (!pushEnable) return;

        const now = new Date();
        const slotKey = getCurrentSlotKey(now);
        if (!slotKey) return;

        if (global.__rocoYxsrPushLastSlot === slotKey) return;

        global.__rocoYxsrPushLastSlot = slotKey;

        const result = await pushYxsrToConfiguredGroups();
        if (result.ok) {
          console.log(
            `[RocoYxsrPush] ${slotKey} 推送完成：成功 ${result.successCount} 个群，失败 ${result.failCount} 个群`
          );
        } else {
          console.log(`[RocoYxsrPush] ${slotKey} 未执行推送：${result.reason}`);
        }
      } catch (error) {
        console.error('[RocoYxsrPush] 定时推送失败:', error);
      }
    };

    // 每 30 秒检查一次是否命中固定时间窗口
    global.__rocoYxsrPushTimer = setInterval(checkAndRun, 30 * 1000);

    // 启动后 10 秒做一次检查（只会在固定时间窗口内触发）
    setTimeout(checkAndRun, 10 * 1000);

    console.log('[RocoYxsrPush] 定时任务已启动，固定推送时间：08:05 / 12:05 / 16:05 / 20:05');
  }

  async manualPush(e) {
    if (!e.isMaster) {
      await this.reply('仅主人可执行该命令', false);
      return;
    }

    await this.reply('正在执行远行商人推送测试...', false);

    try {
      const result = await pushYxsrToConfiguredGroups();

      if (!result.ok) {
        await this.reply(`推送未执行：${result.reason}`, false);
        return;
      }

      await this.reply(
        `推送完成：成功 ${result.successCount} 个群，失败 ${result.failCount} 个群`,
        false
      );
    } catch (error) {
      console.error('[RocoYxsrPush] 手动推送失败:', error);
      await this.reply('推送失败，请查看后台日志', false);
    }
  }
}
