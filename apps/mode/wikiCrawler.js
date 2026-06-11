// 洛克王国远行商人爬虫脚本
// 功能：从 onebiji.com 爬取远行商人商品数据，保存为txt文件
// 模块化输出，支持其他JS文件调用

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 使用当前文件所在目录作为基准
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 爬取目标页面
const targetUrl = 'https://www.onebiji.com/hykb_tools/comm/lkwgmerchant/preview.php?id=1&immgj=0';

// 保存路径
const saveDir = path.join(__dirname, '..', '..', 'data', 'yxsr');
const txtSavePath = path.join(saveDir, '远行商人日志.txt');

// 确保保存目录存在
function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`创建目录成功: ${dir}`);
  }
}

// 读取配置文件获取 chromiumPath
function loadConfig() {
  try {
    const configPath = path.join(__dirname, '..', '..', 'config', 'config.yaml');
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = {};
    const lines = configData.split('\n');
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
  } catch (error) {
    console.warn('读取配置文件失败，使用默认配置:', error.message);
    return {};
  }
}

// 使用 puppeteer 爬取 onebiji.com 页面数据
async function crawlOnebiji() {
  let puppeteer;
  try {
    puppeteer = await import('puppeteer');
  } catch (e) {
    throw new Error('puppeteer 未安装，请运行 npm install puppeteer');
  }

  const config = loadConfig();
  
  const launchOptions = {
    headless: 'new',
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  };

  if (config.chromiumPath) {
    console.log(`[远行商人爬虫] 使用配置的Chrome路径: ${config.chromiumPath}`);
    launchOptions.executablePath = config.chromiumPath;
  }

  let browser;
  try {
    browser = await puppeteer.default.launch(launchOptions);
    const page = await browser.newPage();
    
    // 设置 User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('[远行商人爬虫] 正在访问页面...');
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // 等待页面加载完成
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 从页面提取数据
    const data = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const bodyHtml = document.body.innerHTML;
      
      // 尝试获取商品名称 - 更精确的选择器
      const items = [];
      
      // 方法1: 查找包含商品图片的元素
      const imgElements = document.querySelectorAll('img[src*="100px"]');
      imgElements.forEach(img => {
        const parent = img.closest('.goods-item, .item, div');
        if (parent) {
          const nameEl = parent.querySelector('.goods-name, .item-name, .name, h3, h4');
          if (nameEl) {
            const text = nameEl.innerText.trim();
            if (text && text.length >= 2 && text.length <= 10) {
              items.push(text);
            }
          }
        }
      });
      
      // 方法2: 查找特定的商品名称元素
      if (items.length === 0) {
        const nameElements = document.querySelectorAll('.goods-name, .item-name');
        nameElements.forEach(el => {
          const text = el.innerText.trim();
          if (text && text.length >= 2 && text.length <= 10) {
            items.push(text);
          }
        });
      }
      
      // 方法3: 从页面文本中解析（更严格的匹配）
      if (items.length === 0) {
        const lines = bodyText.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          // 只匹配单独的商品名称行（2-4个中文字符，不能包含其他字符）
          if (/^[\u4e00-\u9fa5]{2,4}$/.test(trimmed)) {
            items.push(trimmed);
          }
        }
      }
      
      // 提取时间信息
      let startTime = null;
      let endTime = null;
      const timeMatch = bodyText.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{2}:\d{2}(?::\d{2})?)/g);
      if (timeMatch) {
        if (timeMatch.length >= 1) startTime = timeMatch[0];
        if (timeMatch.length >= 2) endTime = timeMatch[1];
      }
      
      return {
        items: [...new Set(items)], // 去重
        startTime,
        endTime,
        bodyText: bodyText.substring(0, 3000), // 保留部分文本用于调试
        bodyHtml: bodyHtml.substring(0, 3000) // 保留部分HTML用于调试
      };
    });
    
    console.log('[远行商人爬虫] 提取到的商品:', data.items);
    console.log('[远行商人爬虫] 开始时间:', data.startTime);
    console.log('[远行商人爬虫] 结束时间:', data.endTime);
    
    return data;
  } finally {
    if (browser) await browser.close();
  }
}

// 计算开始时间和结束时间
function calculateTimeRange() {
  const now = new Date();
  const hour = now.getHours();
  const dateStr = now.toISOString().split('T')[0];

  if (hour >= 8 && hour < 12) {
    return { startTime: `${dateStr} 08:00:00`, endTime: `${dateStr} 12:00:00` };
  } else if (hour >= 12 && hour < 16) {
    return { startTime: `${dateStr} 12:00:00`, endTime: `${dateStr} 16:00:00` };
  } else if (hour >= 16 && hour < 20) {
    return { startTime: `${dateStr} 16:00:00`, endTime: `${dateStr} 20:00:00` };
  } else if (hour >= 20 && hour < 24) {
    return { startTime: `${dateStr} 20:00:00`, endTime: `${dateStr} 24:00:00` };
  }
  return null;
}

// 爬取远行商人数据
async function crawlWiki() {
  ensureDirExists(saveDir);
  
  let data;
  try {
    console.log('[远行商人爬虫] 开始爬取...');
    data = await crawlOnebiji();
    console.log('[远行商人爬虫] 爬取完成，商品数量:', data.items?.length);
  } catch (error) {
    console.error('[远行商人爬虫] 爬取失败:', error.message);
    console.error('[远行商人爬虫] 错误详情:', error);
    // 如果爬取失败且本地有缓存，返回缓存内容
    if (fs.existsSync(txtSavePath)) {
      console.log('[远行商人爬虫] 使用本地缓存');
      return fs.readFileSync(txtSavePath, 'utf-8');
    }
    return '远行商人情报获取失败，请稍后重试';
  }
  
  const now = new Date();
  const fetchTime = now.toLocaleString('zh-CN');
  
  let itemNames = data.items || [];
  let startTime = data.startTime;
  let endTime = data.endTime;
  
  // 如果没有获取到时间，使用计算的时间范围
  if (!startTime || !endTime) {
    const timeRange = calculateTimeRange();
    if (timeRange) {
      startTime = timeRange.startTime;
      endTime = timeRange.endTime;
    }
  }
  
  // 生成日志内容
  let output;
  if (itemNames.length > 0) {
    output = itemNames.join(' ') + '\n\n';
    output += `数据获取时间：${fetchTime}\n\n`;
    
    if (startTime && endTime) {
      output += `开始时间：${startTime}\n`;
      output += `结束时间：${endTime}`;
    } else if (startTime) {
      output += `开始时间：${startTime}\n`;
      output += '远行商人还未出现';
    } else {
      output += '远行商人还未出现';
    }
  } else {
    output = '未找到指定内容\n\n';
    output += `数据获取时间：${fetchTime}\n\n`;
    output += '远行商人还未出现';
  }
  
  fs.writeFileSync(txtSavePath, output, 'utf-8');
  console.log('[远行商人爬虫] 数据已保存到:', txtSavePath);
  
  return output;
}

// 读取日志文件并解析时间范围和内容
function readLogFile() {
  try {
    if (fs.existsSync(txtSavePath)) {
      const content = fs.readFileSync(txtSavePath, 'utf-8');
      const lines = content.split('\n');

      let itemContent = '';
      let fetchTime = '';
      let startTime = null;
      let endTime = null;
      let isNotAppeared = false;

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!itemContent && trimmedLine) {
          itemContent = trimmedLine;
        } else if (trimmedLine.includes('数据获取时间')) {
          fetchTime = trimmedLine.replace('数据获取时间：', '').trim();
        } else if (trimmedLine.includes('开始时间')) {
          startTime = trimmedLine.replace('开始时间：', '').trim();
        } else if (trimmedLine.includes('结束时间')) {
          endTime = trimmedLine.replace('结束时间：', '').trim();
        } else if (trimmedLine === '远行商人还未出现') {
          isNotAppeared = true;
        }
      }

      return { startTime, endTime, itemContent, fetchTime, isNotAppeared, content };
    }
    return null;
  } catch (error) {
    console.error('读取日志文件失败:', error);
    return null;
  }
}

// 将爬虫原始日志重写为展示文案
function buildDisplayText(logData) {
  if (!logData) return '暂无远行商人情报';
  if (logData.isNotAppeared) return '远行商人还未出现';

  const rawItemLine = (logData.itemContent || '').trim();
  const itemList = rawItemLine ? rawItemLine.split(/\s+/).filter(Boolean) : [];

  const lines = [
    '远行商人情报更新',
    '限时货架已刷新',
    `本轮上架：${itemList.length ? itemList.join('、') : '待确认'}`
  ];

  if (logData.fetchTime) lines.push(`获取时间：${logData.fetchTime}`);
  if (logData.startTime && logData.endTime) {
    lines.push(`售卖时段：${logData.startTime} ～ ${logData.endTime}`);
  }

  return lines.join('\n');
}

/**
 * 强制刷新远行商人日志文件并返回展示文案
 */
export async function refreshYxsrLog() {
  await crawlWiki();
  const logData = readLogFile();
  if (!logData) return '远行商人情报暂不可用，请稍后重试。';
  return buildDisplayText(logData);
}

// 主函数：获取远行商人信息
async function getYxsrInfo() {
  try {
    await crawlWiki();
    const logData = readLogFile();
    if (logData && logData.itemContent && logData.itemContent !== '未找到指定内容') {
      return buildDisplayText(logData);
    }
    return '远行商人情报暂不可用，请稍后重试。';
  } catch (error) {
    console.error('爬取失败:', error);
    return '远行商人情报获取失败，请稍后重试。';
  }
}

export default getYxsrInfo;

// 如果直接运行此文件
const currentFilePath = new URL(import.meta.url).pathname.replace(/^\//, '');
const argv1 = process.argv[1];
if (argv1 && (currentFilePath === argv1 || currentFilePath.toLowerCase() === argv1.toLowerCase())) {
  console.log('开始获取远行商人信息...');
  refreshYxsrLog()
    .then(info => console.log('获取到的远行商人信息:', info))
    .catch(error => console.error('执行失败:', error));
}
