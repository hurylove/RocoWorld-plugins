import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import plugin from '../../../lib/plugins/plugin.js';
import { refreshYxsrLog } from './mode/wikiCrawler.js';

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

// 从远行商人日志第一行读取物品列表（按空格分隔）
function getItemsFromYxsrLogFirstLine() {
  try {
    const logPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'yxsr', '远行商人日志.txt');
    const logContent = fs.readFileSync(logPath, 'utf-8');
    const firstLine = logContent.split(/\r?\n/)[0]?.trim() || '';
    if (!firstLine) return [];
    return firstLine.split(/\s+/).map(item => item.trim()).filter(Boolean);
  } catch (error) {
    console.warn('读取远行商人日志失败:', error.message);
    return [];
  }
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
  
  // 处理物品信息，添加图片
  let contentRows = '';
  if (lines.length > 0) {
    // 优先使用远行商人日志第一行（按空格分隔）的物品列表
    let items = getItemsFromYxsrLogFirstLine();

    // 兜底：日志读取失败时，回退到展示文案中的“本轮上架”行解析
    let itemLineIndex = -1;
    if (items.length === 0) {
      itemLineIndex = lines.findIndex(line => /^本轮上架[:：]/.test(line));
      const itemLine = itemLineIndex >= 0 ? lines[itemLineIndex] : '';
      const itemText = itemLine.replace(/^本轮上架[:：]\s*/, '').trim();
      items = itemText
        .split(/[\s、,，]+/)
        .map(item => item.trim())
        .filter(item => item && item !== '待确认');
    }

    // 仅在成功解析到物品时渲染物品图片行
    if (items.length > 0) {
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
    }

    // 展示其余文本行（避免重复展示物品行）
    lines.forEach((line, index) => {
      if (index === itemLineIndex) return;
      const isMetaLine = /^(数据获取时间|开始时间|结束时间)[:：]/.test(line);
      contentRows += `<div class="line${isMetaLine ? ' meta-line' : ''}">${line}</div>`;
    });
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
            padding: 32px;
            font-family: 'Noto Sans SC', sans-serif;
            color: #1f2937;
            background:
              radial-gradient(circle at 8% 8%, rgba(34, 211, 238, 0.20), transparent 30%),
              radial-gradient(circle at 92% 12%, rgba(99, 102, 241, 0.18), transparent 32%),
              radial-gradient(circle at 70% 90%, rgba(16, 185, 129, 0.12), transparent 28%),
              linear-gradient(145deg, #f6faff, #eaf2ff 55%, #f5f8ff);
          }

          .card {
            width: 100%;
            border: 1px solid rgba(148, 163, 184, 0.24);
            border-radius: 24px;
            background: rgba(255, 255, 255, 0.88);
            backdrop-filter: blur(5px);
            box-shadow:
              0 12px 34px rgba(15, 23, 42, 0.10),
              0 2px 8px rgba(59, 130, 246, 0.10);
            padding: 26px 24px 20px;
          }

          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 14px;
          }

          .title {
            margin: 0;
            font-size: 34px;
            line-height: 1.15;
            font-weight: 900;
            letter-spacing: 0.6px;
            background: linear-gradient(90deg, #0f172a, #1d4ed8 55%, #0ea5e9);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          .badge {
            border: 1px solid rgba(59, 130, 246, 0.24);
            border-radius: 999px;
            padding: 8px 14px;
            font-size: 12px;
            font-weight: 700;
            color: #1d4ed8;
            background: linear-gradient(135deg, #eff6ff, #f0f9ff);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
          }

          .content {
            border: 1px solid rgba(148, 163, 184, 0.18);
            border-radius: 16px;
            background: linear-gradient(180deg, #ffffff, #f8fbff);
            padding: 14px;
          }

          .line {
            font-size: 19px;
            line-height: 1.72;
            padding: 6px 6px;
            border-bottom: 1px dashed rgba(148, 163, 184, 0.24);
            word-break: break-word;
          }

          .line:last-child {
            border-bottom: none;
          }

          .line.meta-line {
            font-size: 15px;
            color: #64748b;
            background: rgba(241, 245, 249, 0.55);
            border-radius: 10px;
            border-bottom: none;
            margin-top: 8px;
            padding: 8px 10px;
          }

          /* 物品行样式 */
          .items-line {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            align-items: stretch;
            padding: 6px 2px 10px;
            border-bottom: none;
          }

          .item {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 7px;
            width: 96px;
            padding: 10px 8px 8px;
            border-radius: 14px;
            border: 1px solid rgba(148, 163, 184, 0.20);
            background: linear-gradient(180deg, #ffffff, #f8fbff);
            box-shadow: 0 3px 10px rgba(15, 23, 42, 0.06);
          }

          .item-image {
            width: 64px;
            height: 64px;
            object-fit: contain;
            border-radius: 10px;
            background: radial-gradient(circle at 35% 30%, #ffffff, #edf4ff);
            border: 1px solid rgba(148, 163, 184, 0.20);
            padding: 5px;
          }

          .item-name {
            font-size: 13px;
            font-weight: 600;
            line-height: 1.35;
            text-align: center;
            word-break: break-word;
            color: #334155;
            max-width: 80px;
          }

          .footer {
            margin-top: 12px;
            text-align: right;
            font-size: 12px;
            color: #64748b;
            letter-spacing: 0.3px;
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

  const seg = global.segment;
  if (!seg || typeof seg.image !== 'function') {
    throw new Error('segment 不可用，无法构造图片消息');
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
      await group.sendMsg(seg.image(`base64://${base64Image}`));
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
