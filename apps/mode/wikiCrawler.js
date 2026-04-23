// 洛克王国Wiki爬虫脚本
// 功能：获取洛克王国Wiki页面的HTML内容，提取特定部分并保存为txt文件
// 模块化输出，支持其他JS文件调用

import https from 'https';
import fs from 'fs';
import path from 'path';

// 使用当前文件所在目录作为基准
const __dirname = path.dirname(new URL(import.meta.url).pathname).replace(/^\//, '');

// 爬虫目标URL
const wikiUrl = 'https://wiki.lcx.cab/lk/index.php';

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

// 爬取Wiki页面并提取特定内容
function crawlWiki() {
  return new Promise((resolve, reject) => {
    // 解析URL
    const url = new URL(wikiUrl);

    // 发送HTTP请求获取页面内容
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };

    const req = https.get(options, (response) => {
      // 检查响应状态
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP错误: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      let htmlContent = '';

      // 收集响应数据
      response.on('data', (chunk) => {
        htmlContent += chunk;
      });

      // 响应结束
      response.on('end', () => {
        // 确保保存目录存在
        ensureDirExists(saveDir);

        // 提取特定部分内容
        const extractedContent = extractContent(htmlContent);

        // 保存提取的内容到txt文件
        try {
          fs.writeFileSync(txtSavePath, extractedContent, 'utf-8');
          resolve(extractedContent);
        } catch (writeError) {
          reject(writeError);
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

    // 设置超时
    req.setTimeout(10000);
  });
}

// 提取特定内容
function extractContent(html) {
  // 查找包含"远行商人"的部分，支持种类1、2、3等
  const regex = /远行商人现在出售种类\d[\s\S]*?结束时间\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;
  const match = html.match(regex);

  if (match) {
    // 提取匹配的内容并去除HTML标签
    let content = match[0];
    // 替换<br />标签为换行符
    content = content.replace(/<br \/>/g, '\n');
    return content;
  } else {
    return '未找到指定内容';
  }
}

// 读取日志文件并解析时间范围和内容
function readLogFile() {
  try {
    if (fs.existsSync(txtSavePath)) {
      const content = fs.readFileSync(txtSavePath, 'utf-8');
      const lines = content.split('\n');

      // 解析开始时间和结束时间
      let startTime = null;
      let endTime = null;
      let itemContent = null;

      for (const line of lines) {
        if (line.includes('开始时间')) {
          startTime = line.replace('开始时间', '').trim();
        } else if (line.includes('结束时间')) {
          endTime = line.replace('结束时间', '').trim();
        } else if (line.includes('为')) {
          itemContent = line.trim();
        }
      }

      return {
        startTime,
        endTime,
        itemContent,
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

  const rawItemLine = (logData.itemContent || '').trim();
  const itemText = rawItemLine.replace(/^为/, '').trim();
  const itemList = itemText ? itemText.split(/\s+/).filter(Boolean) : [];

  const startTime = (logData.startTime || '').trim();
  const endTime = (logData.endTime || '').trim();

  const lines = [
    '远行商人情报更新',
    '限时货架已刷新',
    `本轮上架：${itemList.length ? itemList.join('、') : '待确认'}`,
    `售卖时段：${startTime || '待确认'} ～ ${endTime || '待确认'}`
  ];

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
    // 读取日志文件
    let logData = readLogFile();

    // 检查是否在时间范围内
    if (logData && logData.startTime && logData.endTime) {
      if (isWithinTimeRange(logData.startTime, logData.endTime)) {
        return buildDisplayText(logData);
      }
    }

    // 爬取新数据
    await crawlWiki();

    // 再次读取日志文件
    logData = readLogFile();

    // 再次检查时间范围
    if (logData && logData.startTime && logData.endTime) {
      if (isWithinTimeRange(logData.startTime, logData.endTime)) {
        return buildDisplayText(logData);
      } else {
        return '远行商人暂未营业，请稍后再查询。';
      }
    } else {
      return '远行商人情报暂不可用，请稍后重试。';
    }
  } catch (error) {
    return '远行商人情报获取失败，请稍后重试。';
  }
}

// 导出函数，供其他模块调用
export default getYxsrInfo;

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  getYxsrInfo()
    .then(info => {
      console.log('获取到的远行商人信息:', info);
    })
    .catch(error => {
      console.error('执行失败:', error);
    });
}
