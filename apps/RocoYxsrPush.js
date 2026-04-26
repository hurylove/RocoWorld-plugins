import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import plugin from '../../../lib/plugins/plugin.js';
import { refreshYxsrLog } from './mode/wikiCrawler.js';

// 导入 segment 对象
import segment from '../../../lib/segment/index.js';

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'config', 'config.yaml');

// 加载物品信息
function loadItemsInfo() {
  try {
    const itemsInfoPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'wptj', 'items_info.json');
    const itemsData = fs.readFileSync(itemsInfoPath, 'utf-8');
    return JSON.parse(itemsData);
  } catch (error) {
    console.warn('读取物品信息失败:', error.message);
    return [];
  }
}

// 物品信息缓存
let itemsInfoCache = null;

// 获取物品信息，带缓存
function getItemsInfo() {
  if (!itemsInfoCache) {
    itemsInfoCache = loadItemsInfo();
  }
  return itemsInfoCache;
}

// 根据物品名称获取图片URL
function getItemImageUrl(itemName) {
  const itemsInfo = getItemsInfo();
  const item = itemsInfo.find(item => item.name === itemName);
  return item ? item.imageUrl : null;
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', String.fromCharCode(38) + 'amp;')
    .replaceAll('<', String.fromCharCode(38) + 'lt;')
    .replaceAll('>', String.fromCharCode(38) + 'gt;')
    .replaceAll('"', String.fromCharCode(38) + 'quot;')
    .replaceAll("'", String.fromCharCode(38) + '#39;');
}

async function renderYxsrImageBase64(rawText) {
  const config = loadConfig();
  const text = String(rawText ?? '').trim();
  const safeText = escapeHTML(text || '暂无远行商人信息');
  const lines = safeText.split(/\r?\n/).filter(Boolean);
  
  // 处理第一行的物品信息，添加图片
  let contentRows = '';
  if (lines.length > 0) {
    // 第一行是物品列表
    const firstLine = lines[0];
    const items = firstLine.split(/\s+/).filter(item => item);
    
    // 生成物品行，包含图片
    let itemsHTML = '<div class="line items-line">';
    items.forEach(itemName => {
      const imageUrl = getItemImageUrl(itemName);
      itemsHTML += `
        <div class="item">
          ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHTML(itemName)}" class="item-image" />` : ''}
          <span class="item-name">${escapeHTML(itemName)}</span>
        </div>
      `;
    });
    itemsHTML += '</div>';
    contentRows += itemsHTML;
    
    // 处理剩余行
    for (let i = 1; i < lines.length; i++) {
      contentRows += `<div class="line">${lines[i]}</div>`;
    }
  } else {
    contentRows = '<div class="line">暂无数据</div>';
  }

  const launchOptions = {
    headless: 'new',
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  };

  if (config.chromiumPath) {
    console.log(`使用配置的Chrome路径: ${config.chromiumPath}`);
    launchOptions.executablePath = config.chromiumPath;
  } else {
    console.log('使用默认Chrome路径');
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  try {
    const html = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            width: 980px;
            min-height: 560px;
            padding: 36px;
            font-family: 'Noto Sans SC', sans-serif;
            color: #1f2937;
            background:
              radial-gradient(circle at 15% 12%, rgba(56, 189, 248, 0.14), transparent 34%),
              radial-gradient(circle at 88% 10%, rgba(129, 140, 248, 0.10), transparent 32%),
              linear-gradient(150deg, #f8fbff, #eef5ff);
          }

          .card {
            width: 100%;
            border: 1px solid rgba(148, 163, 184, 0.26);
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.95);
            box-shadow: 0 10px 28px rgba(15, 23, 42, 0.10);
            padding: 24px;
          }

          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 16px;
          }

          .title {
            margin: 0;
            font-size: 32px;
            line-height: 1.2;
            font-weight: 800;
            letter-spacing: 0.4px;
            background: linear-gradient(90deg, #0f172a, #2563eb);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          .badge {
            border: 1px solid rgba(148, 163, 184, 0.30);
            border-radius: 999px;
            padding: 8px 12px;
            font-size: 13px;
            color: #475569;
            background: #f8fafc;
          }

          .content {
            border: 1px solid rgba(148, 163, 184, 0.22);
            border-radius: 14px;
            background: #ffffff;
            padding: 14px;
          }

          .line {
            font-size: 20px;
            line-height: 1.75;
            padding: 4px 2px;
            border-bottom: 1px dashed rgba(148, 163, 184, 0.24);
            word-break: break-word;
          }

          .line:last-child {
            border-bottom: none;
          }

          /* 物品行样式 */
          .items-line {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: center;
            padding: 12px 0;
          }

          .item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            min-width: 80px;
          }

          .item-image {
            width: 60px;
            height: 60px;
            object-fit: contain;
            border-radius: 8px;
            background: #f8fafc;
            padding: 4px;
          }

          .item-name {
            font-size: 14px;
            text-align: center;
            word-break: break-word;
            max-width: 80px;
          }

          .footer {
            margin-top: 12px;
            text-align: right;
            font-size: 12px;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 class="title">远行商人信息</h1>
            <div class="badge">自动推送</div>
          </div>
          <div class="content">
            ${contentRows || '<div class="line">暂无数据</div>'}
          </div>
          <div class="footer">RocoWorld 插件渲染</div>
        </div>
      </body>
      </html>
    `;

    await page.setViewport({ width: 980, height: 560 });
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const image = await page.screenshot({
      encoding: 'base64',
      fullPage: true,
      omitBackground: false
    });

    return image;
  } finally {
    await browser.close();
  }
}

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

  const yxsrInfo = await refreshYxsrLog();
  
  // 渲染图片
  let base64Image;
  try {
    base64Image = await renderYxsrImageBase64(yxsrInfo);
  } catch (error) {
    console.error('[RocoYxsrPush] 渲染图片失败:', error);
    return { ok: false, reason: '渲染图片失败' };
  }

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
      
      // 发送图片
      await group.sendMsg(segment.image(`base64://${base64Image}`));
      successCount++;
    } catch (error) {
      failCount++;
      console.error(`[RocoYxsrPush] 推送到群 ${groupId} 失败:`, error);
    }
  }

  return {
    ok: successCount > 0,
    message: yxsrInfo,
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
