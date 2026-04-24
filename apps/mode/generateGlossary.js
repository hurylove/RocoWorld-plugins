import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// 使用 process.cwd() 作为项目根目录
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

function normalizeKeyword(keyword) {
  return String(keyword || '').trim().toLowerCase();
}

function filterGlossaryData(glossaryData, keyword) {
  const normalized = normalizeKeyword(keyword);

  if (!normalized) {
    return glossaryData.categories || [];
  }

  return (glossaryData.categories || [])
    .map((category) => {
      const filteredItems = (category.items || []).filter((item) => {
        const name = String(item.词条名称 || '').toLowerCase();
        const detail = String(item.详情 || '').toLowerCase();
        return name.includes(normalized) || detail.includes(normalized);
      });

      return {
        ...category,
        items: filteredItems
      };
    })
    .filter((category) => category.items.length > 0);
}

function countItems(categories = []) {
  return categories.reduce((sum, category) => sum + (category.items?.length || 0), 0);
}

async function generateGlossary(keyword = '') {
  const jsonPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'jllb', '词条列表.json');
  const config = loadConfig();

  let glossaryData;
  try {
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    glossaryData = JSON.parse(rawData);
  } catch (error) {
    console.error('❌ 读取词条列表失败:', error);
    throw error;
  }

  const categories = filterGlossaryData(glossaryData, keyword);
  const itemCount = countItems(categories);
  const hasKeyword = Boolean(String(keyword || '').trim());

  const dynamicWidth = 1800;
  const dynamicHeight = Math.max(900, 280 + itemCount * 74 + categories.length * 80);

  const launchOptions = {
    headless: 'new',
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  };

  if (config.chromiumPath) {
    launchOptions.executablePath = config.chromiumPath;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  try {
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');

        :root {
          --bg-1: #f7f9fc;
          --bg-2: #edf2ff;
          --panel: rgba(255, 255, 255, 0.96);
          --line: rgba(148, 163, 184, 0.28);
          --text-main: #1f2937;
          --text-sub: #64748b;
          --accent-1: #6366f1;
          --accent-2: #8b5cf6;
          --accent-3: #ec4899;
        }

        * { box-sizing: border-box; }

        body {
          margin: 0;
          width: ${dynamicWidth}px;
          min-height: ${dynamicHeight}px;
          padding: 34px;
          color: var(--text-main);
          font-family: 'Noto Sans SC', sans-serif;
          background:
            radial-gradient(circle at 9% 10%, rgba(99, 102, 241, 0.14), transparent 32%),
            radial-gradient(circle at 86% 14%, rgba(236, 72, 153, 0.10), transparent 35%),
            radial-gradient(circle at 84% 92%, rgba(56, 189, 248, 0.10), transparent 30%),
            linear-gradient(150deg, var(--bg-1), var(--bg-2));
        }

        .card {
          width: 100%;
          background: var(--panel);
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 24px;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.10);
          padding: 24px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 18px;
        }

        .title h1 {
          margin: 0;
          font-size: 40px;
          line-height: 1.1;
          letter-spacing: 0.5px;
          font-family: 'Orbitron', 'Noto Sans SC', sans-serif;
          background: linear-gradient(90deg, #0f172a, #4f46e5, #db2777);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .title p {
          margin: 8px 0 0;
          color: var(--text-sub);
          font-size: 15px;
        }

        .meta {
          text-align: right;
          color: var(--text-sub);
          font-size: 13px;
          line-height: 1.6;
        }

        .keyword {
          margin: 12px 0 18px;
          display: inline-block;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.9);
          color: #4338ca;
          font-size: 13px;
        }

        .empty {
          margin-top: 8px;
          padding: 30px 20px;
          text-align: center;
          border-radius: 16px;
          border: 1px dashed rgba(148, 163, 184, 0.45);
          color: var(--text-sub);
          background: rgba(248, 250, 252, 0.8);
          font-size: 16px;
        }

        .section {
          border: 1px solid var(--line);
          border-radius: 16px;
          overflow: hidden;
          margin-top: 14px;
          background: rgba(255, 255, 255, 0.94);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: linear-gradient(90deg, rgba(99, 102, 241, 0.92), rgba(139, 92, 246, 0.88));
          color: #fff;
        }

        .section-header .name {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.4px;
        }

        .section-header .count {
          font-size: 13px;
          opacity: 0.95;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        th, td {
          border-top: 1px solid rgba(148, 163, 184, 0.2);
          padding: 14px 14px;
          vertical-align: top;
        }

        th {
          width: 230px;
          color: #4f46e5;
          font-size: 31px;
          text-align: center;
          font-weight: 700;
          background: rgba(99, 102, 241, 0.05);
        }

        td {
          font-size: 30px;
          line-height: 1.7;
          color: #1e293b;
        }

        .footer {
          margin-top: 16px;
          text-align: right;
          color: var(--text-sub);
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <div class="title">
            <h1>${escapeHTML(glossaryData.title || '词条列表')}</h1>
            <p>${escapeHTML(glossaryData.subtitle || '')}</p>
          </div>
          <div class="meta">
            <div>词条总数：${itemCount}</div>
            <div>分类数量：${categories.length}</div>
            <div>版本：${escapeHTML(glossaryData.version || '1.0.0')}</div>
          </div>
        </div>

        ${hasKeyword ? `<div class="keyword">筛选关键词：${escapeHTML(keyword)}</div>` : ''}

        ${
          itemCount === 0
            ? '<div class="empty">未匹配到任何词条，请更换关键词后重试。</div>'
            : categories
                .map(
                  (category) => `
                  <section class="section">
                    <div class="section-header">
                      <span class="name">${escapeHTML(category.name)}</span>
                      <span class="count">${category.items.length} 条</span>
                    </div>
                    <table>
                      <tbody>
                        ${category.items
                          .map(
                            (item) => `
                            <tr>
                              <th>${escapeHTML(item.词条名称)}</th>
                              <td>${escapeHTML(item.详情)}</td>
                            </tr>
                          `
                          )
                          .join('')}
                      </tbody>
                    </table>
                  </section>
                `
                )
                .join('')
        }

        <div class="footer">${escapeHTML(glossaryData.description || '')}</div>
      </div>
    </body>
    </html>
    `;

    await page.setViewport({ width: dynamicWidth, height: dynamicHeight });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    await new Promise((resolve) => setTimeout(resolve, 600));

    const base64Image = await page.screenshot({
      encoding: 'base64',
      fullPage: true,
      omitBackground: false
    });

    return base64Image;
  } catch (error) {
    console.error('❌ 词条列表渲染失败:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default generateGlossary;
