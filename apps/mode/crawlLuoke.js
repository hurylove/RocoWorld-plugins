import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

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

async function renderLuokeImage(data) {
  const launchOptions = {
    headless: 'new',
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  };

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

          .lead-candidate {
            display: flex;
            gap: 20px;
            padding: 16px;
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 12px;
            background: rgba(219, 234, 254, 0.3);
            margin-bottom: 20px;
          }

          .lead-image {
            width: 100px;
            height: 100px;
            object-fit: contain;
            border-radius: 8px;
            background: #f8fafc;
            padding: 8px;
          }

          .lead-info {
            flex: 1;
          }

          .lead-name {
            font-size: 20px;
            font-weight: 700;
            margin: 0 0 8px 0;
            color: #1e40af;
          }

          .lead-metrics {
            display: flex;
            gap: 20px;
            margin: 12px 0;
            flex-wrap: wrap;
          }

          .metric-item {
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
            font-weight: 600;
            color: #1e293b;
          }

          .candidates-list {
            margin-top: 20px;
          }

          .candidate-item {
            display: flex;
            gap: 16px;
            padding: 12px;
            border: 1px solid rgba(148, 163, 184, 0.2);
            border-radius: 8px;
            margin-bottom: 12px;
            background: #f8fafc;
          }

          .candidate-image {
            width: 80px;
            height: 80px;
            object-fit: contain;
            border-radius: 6px;
            background: #ffffff;
            padding: 6px;
          }

          .candidate-info {
            flex: 1;
          }

          .candidate-name {
            font-size: 16px;
            font-weight: 600;
            margin: 0 0 6px 0;
            color: #1e293b;
          }

          .candidate-metrics {
            display: flex;
            gap: 16px;
            margin: 8px 0;
            flex-wrap: wrap;
            font-size: 14px;
          }

          .candidate-metric {
            color: #475569;
          }

          .probability {
            font-weight: 600;
            color: #dc2626;
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
            <h1 class="title">洛克王国孵蛋查询</h1>
            <div class="badge">自动生成</div>
          </div>
          <div class="content">
            <p>${data.sectionTip || '查询结果'}</p>
            
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

  const launchOptions = {
    headless: 'new',
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  };

  console.log('正在启动浏览器...');
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  try {
    console.log(`正在访问: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`填写参数：身高=${height}，体重=${weight}`);

    console.log('查找身高输入框...');
    const heightInput = await page.$('input[placeholder="例如 0.58"]');
    if (heightInput) {
      console.log('找到身高输入框，填写值...');
      await heightInput.type(height.toString());
    } else {
      console.error('未找到身高输入框');
    }

    console.log('查找体重输入框...');
    const weightInput = await page.$('input[placeholder="例如 34.20"]');
    if (weightInput) {
      console.log('找到体重输入框，填写值...');
      await weightInput.type(weight.toString());
    } else {
      console.error('未找到体重输入框');
    }

    console.log('查找并点击开始查询按钮...');
    const queryButton = await page.$('.primary-btn');
    if (queryButton) {
      console.log('找到开始查询按钮，点击...');
      await queryButton.click();
    } else {
      console.error('未找到开始查询按钮');
    }

    console.log('等待结果加载...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const rawHtml = await page.content();
    console.log(`获取到HTML，长度: ${rawHtml.length}`);

    const extractedData = extractLuokeDataFromHtml(rawHtml);

    console.log('提取结果预览：');
    console.log(JSON.stringify(extractedData, null, 2));

    // 渲染图片
    console.log('正在渲染图片...');
    const base64Image = await renderLuokeImage(extractedData);
    console.log('图片渲染完成');

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
    .then(result => {
      console.log('爬取完成');
      console.log(`候选数量: ${result.data?.otherCandidates?.length || 0}`);
      console.log(`图片base64长度: ${result.imageBase64?.length || 0}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('执行失败:', error);
      process.exit(1);
    });
}
