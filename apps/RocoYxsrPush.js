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
  const plainLines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  // 优先使用远行商人日志第一行（按空格分隔）的物品列表
  let items = getItemsFromYxsrLogFirstLine();

  // 兜底：日志读取失败时，回退到展示文案中的“本轮上架”行解析
  if (items.length === 0) {
    const itemLine = plainLines.find(line => /^本轮上架[:：]/.test(line)) || '';
    const itemText = itemLine.replace(/^本轮上架[:：]\s*/, '').trim();
    items = itemText
      .split(/[\s、,，]+/)
      .map(item => item.trim())
      .filter(item => item && item !== '待确认');
  }

  const fetchTime = (plainLines.find(line => /^数据获取时间[:：]/.test(line)) || '').replace(/^数据获取时间[:：]\s*/, '');
  const startTime = (plainLines.find(line => /^开始时间[:：]/.test(line)) || '').replace(/^开始时间[:：]\s*/, '');
  const endTime = (plainLines.find(line => /^结束时间[:：]/.test(line)) || '').replace(/^结束时间[:：]\s*/, '');

  const getRoundText = (start) => {
    if (!start) return '-- / 4轮';
    const hour = Number((start.match(/\b(\d{2}):\d{2}:\d{2}\b/) || [])[1]);
    const map = { 8: 1, 12: 2, 16: 3, 20: 4 };
    const round = map[hour] || '--';
    return `${round} / 4轮`;
  };

  const getDateText = () => {
    if (startTime) return startTime.slice(0, 10);
    const m = fetchTime.match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/);
    return m ? m[0].replaceAll('/', '-') : '未知日期';
  };

  const getPeriodText = () => {
    if (!startTime || !endTime) return '北京时间 --';
    const sm = startTime.match(/(\d{2})-(\d{2}) (\d{2}:\d{2})/);
    const em = endTime.match(/(\d{2})-(\d{2}) (\d{2}:\d{2})/);
    if (!sm || !em) return `北京时间 ${escapeHTML(startTime)} - ${escapeHTML(endTime)}`;
    return `北京时间 ${sm[1]}-${sm[2]} ${sm[3]} - ${em[3]}`;
  };

  const getRemainText = () => {
    if (!endTime) return '--';
    const end = new Date(endTime.replace(/-/g, '/'));
    if (Number.isNaN(end.getTime())) return '--';
    const diff = end.getTime() - Date.now();
    if (diff <= 0) return '已结束';
    const hour = Math.floor(diff / (1000 * 60 * 60));
    const min = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `剩余 ${hour}小时${min}分钟`;
  };

  let contentRows = '';
  if (items.length > 0) {
    items.forEach(itemName => {
      const imageUrl = getItemImageUrl(itemName);
      contentRows += `
        <div class="item-row">
          <div class="item-left">
            <div class="thumb-wrap">
              ${imageUrl ? `<img src="${imageUrl}" alt="${escapeHTML(itemName)}" class="thumb" />` : '<div class="thumb-fallback">?</div>'}
            </div>
            <div class="item-main">
              <div class="item-title">${escapeHTML(itemName)}</div>
              <div class="item-sub">远行商人当前轮次商品</div>
              <div class="item-time">${escapeHTML(getPeriodText())}</div>
            </div>
          </div>
          <div class="tag">本轮商品</div>
        </div>
      `;
    });
  } else {
    contentRows = `<div class="empty">暂无商品数据</div>`;
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
            width: 1520px;
            min-height: 800px;
            padding: 18px;
            font-family: 'Noto Sans SC', 'PingFang SC', sans-serif;
            color: #3d3024;
            background: #c7c2b7;
          }

          .board {
            border-radius: 28px;
            overflow: hidden;
          }

          .top {
            background: #ebe8e1;
            border-radius: 26px;
            padding: 22px 26px;
            border: 1px solid rgba(120, 102, 83, 0.15);
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
          }

          .title-wrap {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .title {
            margin: 0;
            font-size: 58px;
            line-height: 1;
            font-weight: 900;
            letter-spacing: 1px;
            color: #2f241a;
          }

          .date {
            font-size: 26px;
            color: #5f5245;
            font-weight: 600;
          }

          .stats {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
            justify-content: flex-end;
            max-width: 640px;
          }

          .chip {
            background: #f4f1ea;
            border: 1px solid rgba(120, 102, 83, 0.16);
            border-radius: 999px;
            padding: 10px 20px;
            font-size: 22px;
            font-weight: 800;
            color: #57493b;
            white-space: nowrap;
          }

          .chip strong {
            color: #8b5d23;
            margin-left: 6px;
          }

          .list {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          .item-row {
            background: #eeebe5;
            border-radius: 24px;
            border: 1px solid rgba(120, 102, 83, 0.12);
            padding: 18px 22px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .item-left {
            display: flex;
            align-items: center;
            gap: 20px;
            min-width: 0;
          }

          .thumb-wrap {
            width: 118px;
            height: 118px;
            border-radius: 18px;
            background: #f3f0e9;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(120, 102, 83, 0.12);
            flex-shrink: 0;
          }

          .thumb {
            width: 106px;
            height: 106px;
            object-fit: contain;
          }

          .thumb-fallback {
            font-size: 38px;
            font-weight: 900;
            color: #9b8b77;
          }

          .item-main {
            min-width: 0;
          }

          .item-title {
            font-size: 58px;
            line-height: 1.02;
            font-weight: 900;
            color: #2f241a;
            margin-bottom: 8px;
            word-break: break-word;
          }

          .item-sub {
            font-size: 24px;
            color: #6a5b4e;
            margin-bottom: 8px;
            font-weight: 700;
          }

          .item-time {
            display: inline-block;
            background: #f2e2c3;
            color: #8a5b22;
            border-radius: 999px;
            padding: 6px 14px;
            font-size: 20px;
            font-weight: 800;
          }

          .tag {
            flex-shrink: 0;
            background: #f5f1ea;
            border: 1px solid rgba(120, 102, 83, 0.14);
            border-radius: 20px;
            color: #6f532f;
            padding: 10px 18px;
            font-size: 34px;
            font-weight: 900;
          }

          .empty {
            border-radius: 16px;
            background: #eeebe5;
            border: 1px solid rgba(120, 102, 83, 0.12);
            padding: 28px;
            font-size: 24px;
            color: #6d5d50;
            text-align: center;
            font-weight: 700;
          }
        </style>
      </head>
      <body>
        <div class="board">
          <div class="top">
            <div class="title-wrap">
              <h1 class="title">远行商人</h1>
              <div class="date">${escapeHTML(getDateText())}</div>
            </div>
            <div class="stats">
              <div class="chip">当前商品数 <strong>${items.length}</strong></div>
              <div class="chip">第 ${escapeHTML(getRoundText(startTime))}</div>
              <div class="chip"><strong>${escapeHTML(getRemainText())}</strong></div>
            </div>
          </div>
          <div class="list">
            ${contentRows}
          </div>
        </div>
      </body>
      </html>
    `;

    await page.setViewport({ width: 1520, height: 800 });
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
