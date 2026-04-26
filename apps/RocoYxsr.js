import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import plugin from "../../../lib/plugins/plugin.js";
import getYxsrInfo, { refreshYxsrLog } from './mode/wikiCrawler.js';

const projectRoot = process.cwd();

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
    const configPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'config', 'config.yaml');
    const configData = fs.readFileSync(configPath, 'utf-8');
    return parseYAML(configData);
  } catch (error) {
    console.warn('读取配置文件失败，使用默认配置:', error.message);
    return {};
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
            <div class="badge">自动生成</div>
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

export default class yxsrPlugin extends plugin {
  constructor () {
    super({
      name: '远行商人',
      dsc: '获取洛克王国远行商人信息',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#?远行商人$',
          fnc: 'getYxsr',
        },
        {
          reg: '^#?商人$',
          fnc: 'getYxsr',
        }
      ]
    })
  }

  async getYxsr(e) {
    try {
      this.reply('正在查询远行商人信息，请稍候...', false);

      // 每次都强制刷新数据
      const yxsrInfo = await refreshYxsrLog();

      // 转图片并发送
      const base64Image = await renderYxsrImageBase64(yxsrInfo);
      this.reply(segment.image(`base64://${base64Image}`), false);
    } catch (error) {
      console.error('获取远行商人信息失败:', error);

      // 兜底：发送文本
      try {
        const yxsrInfo = await refreshYxsrLog();
        this.reply(yxsrInfo || '获取远行商人信息时出现错误，请稍后重试', false);
      } catch {
        this.reply('获取远行商人信息时出现错误，请稍后重试', false);
      }
    }
  }
}
