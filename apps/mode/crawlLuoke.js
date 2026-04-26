import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

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

function cleanText(text = '') {
  return text.replace(/\s+/g, ' ').trim();
}

function getMetricValue($container, labelText) {
  let value = '';

  $container.find('article').each((_, article) => {
    const $article = cheerio.load(article).root();
    const title = cleanText($article.find('span').first().text());
    const strong = cleanText($article.find('strong').first().text());

    if (title === labelText) {
      value = strong;
      return false;
    }
  });

  return value;
}

function parseLeadCard($) {
  const $leadCard = $('.lead-card').first();
  if (!$leadCard.length) return null;

  const $metrics = $leadCard.find('.lead-metrics').first();

  return {
    name: cleanText($leadCard.find('h3').first().text()),
    id: cleanText($leadCard.find('.lead-card__meta span').last().text()),
    tag: cleanText($leadCard.find('.el-tag__content').first().text()),
    probability: cleanText($leadCard.find('.lead-card__score strong').first().text()),
    probabilityLabel: cleanText($leadCard.find('.lead-card__score span').first().text()),
    reason: cleanText($leadCard.find('.lead-card__reason').first().text()),
    image: $leadCard.find('img').first().attr('src') || '',
    imageAlt: $leadCard.find('img').first().attr('alt') || '',
    metrics: {
      referenceSize: getMetricValue($metrics, '参考蛋尺寸'),
      referenceWeight: getMetricValue($metrics, '参考蛋重量'),
      matchRate: getMetricValue($metrics, '分布贴合')
    }
  };
}

function parseCandidateCard(cardElement) {
  const $ = cheerio.load(cardElement);
  const metricTexts = [];

  $('.candidate-card__metrics span').each((_, span) => {
    metricTexts.push(cleanText($(span).text()));
  });

  const progress = $('.el-progress').first().attr('aria-valuenow') || '';

  return {
    name: cleanText($('.candidate-card__info h3').first().text()),
    id: cleanText($('.candidate-card__info p').first().text()),
    tag: cleanText($('.el-tag__content').first().text()),
    reason: cleanText($('.candidate-card__reason').first().text()),
    image: $('img').first().attr('src') || '',
    imageAlt: $('img').first().attr('alt') || '',
    metrics: {
      size: metricTexts.find(text => text.startsWith('尺寸 '))?.replace(/^尺寸\s*/, '') || '',
      weight: metricTexts.find(text => text.startsWith('重量 '))?.replace(/^重量\s*/, '') || '',
      matchRate: metricTexts.find(text => text.startsWith('分布贴合 '))?.replace(/^分布贴合\s*/, '') || '',
      probability: metricTexts.find(text => text.startsWith('孵化概率参考 '))?.replace(/^孵化概率参考\s*/, '') || ''
    },
    progressValue: progress ? `${progress}%` : ''
  };
}

function extractLuokeDataFromHtml(htmlString) {
  const $ = cheerio.load(htmlString);

  const result = {
    title: cleanText($('h2').first().text()),
    sectionTip: cleanText($('.section-tip').first().text()),
    leadCandidate: parseLeadCard($),
    otherCandidates: []
  };

  $('.candidate-card').each((_, element) => {
    result.otherCandidates.push(parseCandidateCard($.html(element)));
  });

  return result;
}

function normalizeImageUrl(imageUrl = '') {
  const baseUrl = 'https://luoke.help';
  const raw = String(imageUrl || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${baseUrl}${raw.startsWith('/') ? '' : '/'}${raw}`;
}

function patchLuokeResultImageUrls(data) {
  if (!data || typeof data !== 'object') return data;

  if (data.leadCandidate && typeof data.leadCandidate === 'object') {
    data.leadCandidate.image = normalizeImageUrl(data.leadCandidate.image);
  }

  if (Array.isArray(data.otherCandidates)) {
    data.otherCandidates.forEach((candidate) => {
      if (candidate && typeof candidate === 'object') {
        candidate.image = normalizeImageUrl(candidate.image);
      }
    });
  }

  return data;
}

async function renderLuokeImage(data) {
  const config = loadConfig();
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
            padding: 30px;
            font-family: 'Noto Sans SC', sans-serif;
            color: #1e293b;
            background:
              radial-gradient(circle at 12% 10%, rgba(14, 165, 233, 0.18), transparent 34%),
              radial-gradient(circle at 90% 12%, rgba(99, 102, 241, 0.12), transparent 35%),
              linear-gradient(145deg, #f7fbff, #edf4ff);
          }

          .card {
            width: 100%;
            border: 1px solid rgba(148, 163, 184, 0.22);
            border-radius: 22px;
            background: rgba(255, 255, 255, 0.9);
            box-shadow:
              0 12px 30px rgba(15, 23, 42, 0.10),
              0 2px 8px rgba(59, 130, 246, 0.10);
            backdrop-filter: blur(4px);
            padding: 22px;
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
            background: linear-gradient(90deg, #0f172a, #1d4ed8 58%, #0284c7);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          .badge {
            border: 1px solid rgba(59, 130, 246, 0.24);
            border-radius: 999px;
            padding: 7px 14px;
            font-size: 12px;
            font-weight: 700;
            color: #1d4ed8;
            background: linear-gradient(135deg, #eff6ff, #f0f9ff);
          }

          .content {
            border: 1px solid rgba(148, 163, 184, 0.18);
            border-radius: 16px;
            background: linear-gradient(180deg, #ffffff, #f8fbff);
            padding: 14px;
          }

          .section-tip {
            margin: 0 0 14px 0;
            display: inline-block;
            font-size: 13px;
            font-weight: 700;
            color: #475569;
            background: #f1f5f9;
            border: 1px solid rgba(148, 163, 184, 0.25);
            border-radius: 999px;
            padding: 6px 12px;
          }

          .lead-candidate {
            display: flex;
            gap: 18px;
            padding: 16px;
            border: 1px solid rgba(59, 130, 246, 0.26);
            border-radius: 14px;
            background: linear-gradient(145deg, rgba(219, 234, 254, 0.55), rgba(236, 254, 255, 0.72));
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
            margin-bottom: 16px;
          }

          .lead-image {
            width: 108px;
            height: 108px;
            object-fit: contain;
            border-radius: 12px;
            border: 1px solid rgba(148, 163, 184, 0.20);
            background: radial-gradient(circle at 30% 30%, #ffffff, #eef5ff);
            padding: 8px;
            flex-shrink: 0;
          }

          .lead-info {
            flex: 1;
            min-width: 0;
          }

          .lead-name {
            font-size: 22px;
            font-weight: 800;
            margin: 0 0 8px 0;
            color: #1e3a8a;
          }

          .lead-info p {
            margin: 0;
            color: #334155;
            line-height: 1.6;
          }

          .lead-metrics {
            display: flex;
            gap: 10px;
            margin: 12px 0 0;
            flex-wrap: wrap;
          }

          .metric-item {
            min-width: 120px;
            padding: 8px 10px;
            border-radius: 10px;
            border: 1px solid rgba(148, 163, 184, 0.22);
            background: rgba(255, 255, 255, 0.7);
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .metric-label {
            font-size: 12px;
            color: #64748b;
          }

          .metric-value {
            font-size: 16px;
            font-weight: 700;
            color: #1e293b;
          }

          .candidates-list {
            margin-top: 16px;
          }

          .candidates-list h3 {
            margin: 0 0 10px;
            font-size: 18px;
            color: #334155;
          }

          .candidate-item {
            display: flex;
            gap: 14px;
            padding: 12px;
            border: 1px solid rgba(148, 163, 184, 0.20);
            border-radius: 12px;
            margin-bottom: 10px;
            background: linear-gradient(180deg, #ffffff, #f8fafc);
          }

          .candidate-image {
            width: 82px;
            height: 82px;
            object-fit: contain;
            border-radius: 10px;
            border: 1px solid rgba(148, 163, 184, 0.20);
            background: #ffffff;
            padding: 6px;
            flex-shrink: 0;
          }

          .candidate-info {
            flex: 1;
            min-width: 0;
          }

          .candidate-name {
            font-size: 17px;
            font-weight: 700;
            margin: 0 0 6px 0;
            color: #1e293b;
          }

          .candidate-info p {
            margin: 0;
            color: #475569;
            line-height: 1.5;
          }

          .candidate-metrics {
            display: flex;
            gap: 14px;
            margin: 8px 0 0;
            flex-wrap: wrap;
            font-size: 14px;
          }

          .candidate-metric {
            color: #475569;
          }

          .probability {
            font-weight: 700;
            color: #dc2626;
          }

          .footer {
            margin-top: 12px;
            text-align: right;
            font-size: 12px;
            color: #64748b;
            letter-spacing: 0.2px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 class="title">洛克王国孵蛋查询</h1>
            <div class="badge">自动生成</div>
          </div>
          <div class="content">
            <div class="section-tip">${data.sectionTip || '查询结果'}</div>

            ${data.leadCandidate ? `
            <div class="lead-candidate">
              <img src="${data.leadCandidate.image}" alt="${data.leadCandidate.imageAlt}" class="lead-image" />
              <div class="lead-info">
                <h2 class="lead-name">${data.leadCandidate.name} ${data.leadCandidate.id}</h2>
                <p>${data.leadCandidate.reason}</p>
                <div class="lead-metrics">
                  <div class="metric-item">
                    <span class="metric-label">参考蛋尺寸</span>
                    <span class="metric-value">${data.leadCandidate.metrics.referenceSize}</span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">参考蛋重量</span>
                    <span class="metric-value">${data.leadCandidate.metrics.referenceWeight}</span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">分布贴合</span>
                    <span class="metric-value">${data.leadCandidate.metrics.matchRate}</span>
                  </div>
                  <div class="metric-item">
                    <span class="metric-label">孵化概率</span>
                    <span class="metric-value probability">${data.leadCandidate.probability}</span>
                  </div>
                </div>
              </div>
            </div>
            ` : ''}

            ${data.otherCandidates && data.otherCandidates.length > 0 ? `
            <div class="candidates-list">
              <h3>其他候选</h3>
              ${data.otherCandidates.map(candidate => `
                <div class="candidate-item">
                  <img src="${candidate.image}" alt="${candidate.imageAlt}" class="candidate-image" />
                  <div class="candidate-info">
                    <h4 class="candidate-name">${candidate.name} ${candidate.id}</h4>
                    <p>${candidate.reason}</p>
                    <div class="candidate-metrics">
                      <span class="candidate-metric">尺寸: ${candidate.metrics.size}</span>
                      <span class="candidate-metric">重量: ${candidate.metrics.weight}</span>
                      <span class="candidate-metric">分布贴合: ${candidate.metrics.matchRate}</span>
                      <span class="candidate-metric probability">孵化概率: ${candidate.metrics.probability}</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
            ` : ''}
          </div>
          <div class="footer">RocoWorld 插件渲染</div>
        </div>
      </body>
      </html>
    `;

    await page.setViewport({ width: 980, height: 800 });
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

async function crawlLuoke(height = 0.28, weight = 2.36) {
  const url = 'https://luoke.help';
  const config = loadConfig();

  const launchOptions = {
    headless: 'new',
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  };

  if (config.chromiumPath) {
    launchOptions.executablePath = config.chromiumPath;
  }

  console.log('正在启动浏览器...');
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    await new Promise(resolve => setTimeout(resolve, 500));

    const heightInput = await page.$('input[placeholder="例如 0.58"]');
    if (heightInput) {
      await heightInput.type(height.toString());
    }

    const weightInput = await page.$('input[placeholder="例如 34.20"]');
    if (weightInput) {
      await weightInput.type(weight.toString());
    }

    const queryButton = await page.$('.primary-btn');
    if (queryButton) {
      await queryButton.click();
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    const rawHtml = await page.content();

    const extractedData = extractLuokeDataFromHtml(rawHtml);
    patchLuokeResultImageUrls(extractedData);

    console.log('正在渲染图片...');
    const base64Image = await renderLuokeImage(extractedData);

    return {
      data: extractedData,
      imageBase64: base64Image
    };
  } catch (error) {
    console.error('爬取失败:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default crawlLuoke;

// 测试代码（当直接运行时）
if (import.meta.url === `file://${process.argv[1]}`) {
  const height = process.argv[2] ? parseFloat(process.argv[2]) : 0.28;
  const weight = process.argv[3] ? parseFloat(process.argv[3]) : 2.36;
  
  crawlLuoke(height, weight)
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error('执行失败:', error);
      process.exit(1);
    });
}
