import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import plugin from "../../../lib/plugins/plugin.js";
import getYxsrInfo, { refreshYxsrLog } from './mode/wikiCrawler.js';

const projectRoot = process.cwd();

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
  const contentRows = lines.map(line => `<div class="line">${line}</div>`).join('');

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
