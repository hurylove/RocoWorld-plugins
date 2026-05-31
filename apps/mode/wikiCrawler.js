// 洛克王国远行商人爬虫脚本
// 功能：从 roco.dayun.cool API 获取远行商人商品数据，保存为txt文件
// 模块化输出，支持其他JS文件调用

import https from 'https';
import fs from 'fs';
import path from 'path';

// 使用当前文件所在目录作为基准
const __dirname = path.dirname(new URL(import.meta.url).pathname).replace(/^\//, '');

// 爬虫目标 API
const apiUrl = 'https://rocokingdomworld.org/data/merchant.json';

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

// 从 API 获取远行商人数据
function crawlWiki() {
  return new Promise((resolve, reject) => {
    const url = new URL(apiUrl);

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };

    const req = https.get(options, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP错误: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      let rawData = '';

      response.on('data', (chunk) => {
        rawData += chunk;
      });

      response.on('end', () => {
        try {
          const json = JSON.parse(rawData);
          ensureDirExists(saveDir);

          const extractedContent = extractContent(json);

          fs.writeFileSync(txtSavePath, extractedContent, 'utf-8');
          resolve(extractedContent);
        } catch (parseError) {
          reject(new Error(`JSON解析失败: ${parseError.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTP请求超时'));
    });

    req.setTimeout(10000);
  });
}

// 计算开始时间和结束时间
function calculateTimeRange() {
  const now = new Date();
  const hour = now.getHours();
  const dateStr = now.toISOString().split('T')[0];

  if (hour >= 8 && hour < 12) {
    return {
      startTime: `${dateStr} 08:00:00`,
      endTime: `${dateStr} 12:00:00`
    };
  } else if (hour >= 12 && hour < 16) {
    return {
      startTime: `${dateStr} 12:00:00`,
      endTime: `${dateStr} 16:00:00`
    };
  } else if (hour >= 16 && hour < 20) {
    return {
      startTime: `${dateStr} 16:00:00`,
      endTime: `${dateStr} 20:00:00`
    };
  } else if (hour >= 20 && hour < 24) {
    return {
      startTime: `${dateStr} 20:00:00`,
      endTime: `${dateStr} 24:00:00`
    };
  } else {
    return null;
  }
}

// 从 API 返回的 JSON 中提取商品信息和时间
function extractContent(json) {
  const items = json.items || [];

  if (json.status !== 'open' || items.length === 0) {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 0 && hour < 8) {
      return '远行商人还未出现';
    }
    return '未找到指定内容';
  }

  const now = new Date();
  const fetchTime = now.toLocaleString('zh-CN');

  let startTime = json.startedAtBeijing || null;
  let endTime = json.nextRefreshBeijing || null;

  if (!startTime || !endTime) {
    const timeRange = calculateTimeRange();
    if (timeRange) {
      startTime = timeRange.startTime;
      endTime = timeRange.endTime;
    }
  }

  const itemNames = items.map(item => item.name);
  let output = itemNames.join(' ') + '\n\n';
  output += `数据获取时间：${fetchTime}\n\n`;

  if (startTime && endTime) {
    output += `开始时间：${startTime}\n`;
    output += `结束时间：${endTime}`;
  } else {
    output += '远行商人还未出现';
  }

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

      // 解析文件内容
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!itemContent) {
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

      return {
        startTime,
        endTime,
        itemContent,
        fetchTime,
        isNotAppeared,
        content
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('读取日志文件失败:', error);
    return null;
  }
}

// 检查当前时间是否在时间范围内
function isWithinTimeRange(startTime, endTime) {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);

  return now >= start && now <= end;
}

// 将爬虫原始日志重写为展示文案（避免直白暴露原始格式）
function buildDisplayText(logData) {
  if (!logData) return '暂无远行商人情报';

  if (logData.isNotAppeared) {
    return '远行商人还未出现';
  }

  const rawItemLine = (logData.itemContent || '').trim();
  const itemList = rawItemLine ? rawItemLine.split(/\s+/).filter(Boolean) : [];

  const lines = [
    '远行商人情报更新',
    '限时货架已刷新',
    `本轮上架：${itemList.length ? itemList.join('、') : '待确认'}`
  ];

  if (logData.fetchTime) {
    lines.push(`获取时间：${logData.fetchTime}`);
  }

  if (logData.startTime && logData.endTime) {
    lines.push(`售卖时段：${logData.startTime} ～ ${logData.endTime}`);
  }

  return lines.join('\n');
}

/**
 * 强制刷新远行商人日志文件并返回展示文案
 * 用于定时任务：每次执行都会主动抓取并覆盖 data/yxsr/远行商人日志.txt
 */
export async function refreshYxsrLog() {
  await crawlWiki();
  const logData = readLogFile();
  if (!logData) {
    return '远行商人情报暂不可用，请稍后重试。';
  }
  return buildDisplayText(logData);
}

// 主函数：获取远行商人信息
async function getYxsrInfo() {
  try {
    // 强制爬取新数据
    await crawlWiki();

    // 读取日志文件
    const logData = readLogFile();

    // 检查是否有数据
    if (logData && logData.itemContent && logData.itemContent !== '未找到指定内容') {
      return buildDisplayText(logData);
    } else {
      return '远行商人情报暂不可用，请稍后重试。';
    }
  } catch (error) {
    console.error('爬取失败:', error);
    return '远行商人情报获取失败，请稍后重试。';
  }
}

// 导出函数，供其他模块调用
export default getYxsrInfo;

// 如果直接运行此文件
const currentFilePath = new URL(import.meta.url).pathname.replace(/^\//, '');
const argv1 = process.argv[1];
if (argv1 && (currentFilePath === argv1 || currentFilePath.toLowerCase() === argv1.toLowerCase())) {
  // 直接运行时强制刷新数据
  console.log('开始获取远行商人信息...');
  refreshYxsrLog()
    .then(info => {
      console.log('获取到的远行商人信息:', info);
    })
    .catch(error => {
      console.error('执行失败:', error);
    });
}
