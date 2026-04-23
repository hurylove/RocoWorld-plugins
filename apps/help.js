import plugin from "../../../lib/plugins/plugin.js";
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// 等待函数
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 简单的YAML解析函数
function parseYAML(yamlContent) {
    const config = {};
    const lines = yamlContent.split('\n');
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        // 跳过注释和空行
        if (trimmedLine.startsWith('#') || trimmedLine === '') {
            continue;
        }
        
        // 解析键值对
        const colonIndex = trimmedLine.indexOf(':');
        if (colonIndex > 0) {
            const key = trimmedLine.substring(0, colonIndex).trim();
            let value = trimmedLine.substring(colonIndex + 1).trim();
            
            // 处理引号
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length - 1);
            }
            
            config[key] = value;
        }
    }
    
    return config;
}

// 读取配置文件
function loadConfig() {
    try {
        const projectRoot = process.cwd();
        const configPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'config', 'config.yaml');
        const configData = fs.readFileSync(configPath, 'utf-8');
        return parseYAML(configData);
    } catch (error) {
        console.warn('读取配置文件失败，使用默认配置:', error.message);
        return {};
    }
}

const config = loadConfig();

// 生成帮助图片
async function generateHelpImage() {
  // 构建puppeteer启动选项
  const launchOptions = {
    headless: 'new',
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  };
  
  // 如果配置了Chromium路径，则使用配置的路径
  if (config.chromiumPath) {
    console.log(`使用配置的Chrome路径: ${config.chromiumPath}`);
    launchOptions.executablePath = config.chromiumPath;
  } else {
    console.log('使用默认Chrome路径');
  }
  
  const browser = await puppeteer.launch(launchOptions);
  
  const page = await browser.newPage();
  
  try {
    // 生成HTML内容
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="zh">
    <head>
        <meta charset="UTF-8" />
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Noto+Serif+SC:wght@400;700&display=swap');
            body {
                width: 1280px;
                height: 1200px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                font-family: 'Noto Serif SC', serif;
                color: #ffffff;
                padding: 40px;
                margin: 0;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .card-container {
                width: 1200px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 25px;
                padding: 40px;
                backdrop-filter: blur(15px);
                border: 2px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                display: flex;
                flex-direction: column;
                gap: 30px;
            }
            .header {
                text-align: center;
                padding-bottom: 20px;
                border-bottom: 2px solid rgba(255,255,255,0.2);
            }
            .title {
                font-family: 'Orbitron', sans-serif;
                font-size: 48px;
                font-weight: 700;
                color: #ffffff;
                text-shadow: 0 0 20px rgba(255,255,255,0.5);
                margin-bottom: 10px;
            }
            .subtitle {
                font-size: 20px;
                opacity: 0.9;
            }
            .section {
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            .section-title {
                font-size: 32px;
                color: #ffffff;
                border-bottom: 2px solid rgba(255,255,255,0.3);
                padding-bottom: 10px;
                font-family: 'Orbitron', sans-serif;
            }
            .command-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
            }
            .command-item {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 15px;
                padding: 20px;
                border: 1px solid rgba(255,255,255,0.2);
                transition: all 0.3s ease;
            }
            .command-item:hover {
                background: rgba(255, 255, 255, 0.15);
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
            .command {
                font-size: 22px;
                font-weight: bold;
                color: #ffffff;
                margin-bottom: 8px;
            }
            .description {
                font-size: 18px;
                opacity: 0.9;
                color: #f0f0f0;
            }
            .info-section {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 15px;
                padding: 20px;
                margin-top: 20px;
                border: 1px solid rgba(255,255,255,0.1);
            }
            .info-item {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                font-size: 18px;
            }
            .info-label {
                font-weight: bold;
                color: #ffffff;
            }
            .info-value {
                opacity: 0.9;
                color: #f0f0f0;
            }
        </style>
    </head>
    <body>
        <div class="card-container">
            <div class="header">
                <div class="title">洛克王国插件帮助</div>
                <div class="subtitle">RocoWorld-plugins v1.0.0</div>
            </div>
            
            <div class="section">
                <div class="section-title">功能命令</div>
                <div class="command-grid">
                    <div class="command-item">
                        <div class="command">#宠物名称</div>
                        <div class="description">查看宠物图鉴，例如：#迪莫</div>
                    </div>
                    <div class="command-item">
                        <div class="command">#宠物名称解析卡</div>
                        <div class="description">查看宠物解析卡，例如：#迪莫解析卡</div>
                    </div>
                    <div class="command-item">
                        <div class="command">#宠物名称资料卡</div>
                        <div class="description">查看宠物资料卡，例如：#迪莫资料卡</div>
                    </div>
                    <div class="command-item">
                        <div class="command">#属性克制表</div>
                        <div class="description">查看完整的属性克制表</div>
                    </div>
                    <div class="command-item">
                        <div class="command">#属性名称克制</div>
                        <div class="description">查看单属性克制关系，例如：#光系克制</div>
                    </div>
                    <div class="command-item">
                        <div class="command">#洛克王国更新</div>
                        <div class="description">更新洛克王国插件</div>
                    </div>
                    <div class="command-item">
                        <div class="command">#洛克帮助</div>
                        <div class="description">查看帮助菜单</div>
                    </div>
                    <div class="command-item">
                        <div class="command">#洛克菜单</div>
                        <div class="description">查看帮助菜单</div>
                    </div>
                    <div class="command-item">
                        <div class="command">#洛克功能</div>
                        <div class="description">查看帮助菜单</div>
                    </div>
                    <div class="command-item">
                        <div class="command">#洛克王国帮助</div>
                        <div class="description">查看帮助菜单</div>
                    </div>
                    <div class="command-item">
                        <div class="command">#洛克王国菜单</div>
                        <div class="description">查看帮助菜单</div>
                    </div>
                    <div class="command-item">
                        <div class="command">#洛克王国功能</div>
                        <div class="description">查看帮助菜单</div>
                    </div>
                    <div class="command-item">
                        <div class="command">#远行商人</div>
                        <div class="description">查看洛克王国远行商人信息</div>
                    </div>
                    <div class="command-item">
                        <div class="command">#商人</div>
                        <div class="description">查看洛克王国远行商人信息</div>
                    </div>
                </div>
            </div>
            
            <div class="info-section">
                <div class="info-item">
                    <span class="info-label">插件名称：</span>
                    <span class="info-value">RocoWorld-plugins</span>
                </div>
                <div class="info-item">
                    <span class="info-label">版本：</span>
                    <span class="info-value">1.0.0</span>
                </div>
                <div class="info-item">
                    <span class="info-label">描述：</span>
                    <span class="info-value">洛克王国世界查询插件</span>
                </div>
            </div>
        </div>
    </body>
    </html>`;

    // 设置视口和截图
    await page.setViewport({ width: 1280, height: 1200 });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    await wait(1000);
    
    // 生成base64格式的图片
    const base64Image = await page.screenshot({ encoding: 'base64', fullPage: true, omitBackground: false });
    console.log(`✅ 帮助图片生成成功！`);
    
    // 返回base64格式的图片
    return base64Image;

  } catch (error) {
    console.error('❌ 生成帮助图片失败:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default class Help extends plugin {
  constructor() {
    super({
      name: "洛克王国-帮助",
      dsc: "查看插件帮助",
      event: "message",
      priority: 500,
      rule: [
        {
          reg: "^#(洛克|洛克王国)(帮助|菜单|功能)$",
          fnc: "allHelp"
        }
      ]
    })
  }

  async allHelp(e) {
    try {
      // 生成帮助图片
      this.reply('正在生成帮助菜单，请稍候...', false);
      
      const base64Image = await generateHelpImage();
      
      // 发送帮助图片
      this.reply(segment.image(`base64://${base64Image}`), false);

    } catch (error) {
      console.error('生成帮助失败:', error);
      this.reply('生成帮助时出现错误，请稍后重试', false);
    }
  }
}