import plugin from "../../../lib/plugins/plugin.js";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

// 简单的 YAML 解析函数
function parseYAML(yamlContent) {
  const config = {};
  const lines = yamlContent.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();
    // 跳过注释和空行
    if (trimmedLine.startsWith("#") || trimmedLine === "") {
      continue;
    }

    // 解析键值对
    const colonIndex = trimmedLine.indexOf(":");
    if (colonIndex > 0) {
      const key = trimmedLine.substring(0, colonIndex).trim();
      let value = trimmedLine.substring(colonIndex + 1).trim();

      // 处理引号
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

// 读取配置文件
function loadConfig() {
  try {
    const projectRoot = process.cwd();
    const configPath = path.join(projectRoot, "plugins", "RocoWorld-plugins", "config", "config.yaml");
    const configData = fs.readFileSync(configPath, "utf-8");
    return parseYAML(configData);
  } catch (error) {
    console.warn("读取配置文件失败，使用默认配置:", error.message);
    return {};
  }
}

const config = loadConfig();

const helpSections = [
  {
    title: "图鉴查询",
    items: [
      { cmd: "#宠物名称", desc: "查看宠物图鉴，例如：#迪莫" },
      { cmd: "#宠物名称解析卡", desc: "查看宠物解析卡，例如：#迪莫解析卡" },
      { cmd: "#宠物名称资料卡", desc: "查看宠物资料卡，例如：#迪莫资料卡" }
    ]
  },
  {
    title: "属性克制",
    items: [
      { cmd: "#属性克制表", desc: "查看完整的属性克制表" },
      { cmd: "#属性名称克制", desc: "查看单属性克制关系，例如：#光系克制" }
    ]
  },
  {
    title: "商人信息",
    items: [
      { cmd: "#远行商人", desc: "查看洛克王国远行商人信息" },
      { cmd: "#商人", desc: "查看洛克王国远行商人信息（别名）" }
    ]
  },
  {
    title: "帮助与更新",
    items: [
      { cmd: "#洛克王国更新", desc: "更新洛克王国插件" },
      { cmd: "#洛克帮助 / #洛克菜单 / #洛克功能", desc: "查看帮助菜单（简写）" },
      { cmd: "#洛克王国帮助 / #洛克王国菜单 / #洛克王国功能", desc: "查看帮助菜单（完整）" }
    ]
  }
];

// 生成帮助图片
async function generateHelpImage() {
  const launchOptions = {
    headless: "new",
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
  };

  // 如果配置了 Chromium 路径，则使用配置的路径
  if (config.chromiumPath) {
    console.log(`使用配置的 Chrome 路径: ${config.chromiumPath}`);
    launchOptions.executablePath = config.chromiumPath;
  } else {
    console.log("使用默认 Chrome 路径");
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  try {
    const sectionsHtml = helpSections
      .map(
        (section) => `
        <div class="section">
          <div class="section-title">${section.title}</div>
          <div class="list">
            ${section.items
              .map(
                (item) => `
              <div class="row">
                <div class="cmd">${item.cmd}</div>
                <div class="desc">${item.desc}</div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      `
      )
      .join("");

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <style>
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 32px;
          background: #f5f7fb;
          color: #1f2937;
          font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans SC", Arial, sans-serif;
        }

        .container {
          width: 1120px;
          margin: 0 auto;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }

        .header {
          padding: 24px 28px;
          background: linear-gradient(90deg, #1d4ed8 0%, #2563eb 55%, #3b82f6 100%);
          color: #ffffff;
        }

        .title {
          font-size: 30px;
          font-weight: 700;
          line-height: 1.2;
          margin-bottom: 8px;
        }

        .sub {
          font-size: 15px;
          opacity: 0.95;
        }

        .content {
          padding: 22px 24px 18px;
        }

        .section {
          margin-bottom: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
        }

        .section-title {
          padding: 12px 16px;
          font-size: 18px;
          font-weight: 700;
          color: #1e40af;
          background: #eff6ff;
          border-bottom: 1px solid #dbeafe;
        }

        .list {
          padding: 6px 10px;
          background: #ffffff;
        }

        .row {
          display: grid;
          grid-template-columns: minmax(320px, 44%) 1fr;
          gap: 14px;
          align-items: start;
          padding: 10px 8px;
          border-bottom: 1px dashed #e5e7eb;
        }

        .row:last-child {
          border-bottom: none;
        }

        .cmd {
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 10px;
          line-height: 1.45;
          word-break: break-all;
        }

        .desc {
          font-size: 15px;
          color: #475569;
          line-height: 1.6;
          padding-top: 3px;
        }

        .footer {
          margin: 8px 24px 24px;
          padding: 12px 14px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px 12px;
          font-size: 14px;
        }

        .meta {
          color: #334155;
        }

        .meta b {
          color: #0f172a;
          margin-right: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="title">洛克王国插件帮助</div>
          <div class="sub">RocoWorld-plugins v1.0.0</div>
        </div>

        <div class="content">
          ${sectionsHtml}
        </div>

        <div class="footer">
          <div class="meta"><b>插件名称：</b>RocoWorld-plugins</div>
          <div class="meta"><b>版本：</b>1.0.0</div>
          <div class="meta"><b>描述：</b>洛克王国世界查询插件</div>
        </div>
      </div>
    </body>
    </html>`;

    await page.setViewport({ width: 1200, height: 1400 });
    await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });

    const base64Image = await page.screenshot({
      encoding: "base64",
      fullPage: true,
      omitBackground: false
    });

    console.log("✅ 帮助图片生成成功！");
    return base64Image;
  } catch (error) {
    console.error("❌ 生成帮助图片失败:", error);
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
    });
  }

  async allHelp(e) {
    try {
      this.reply("正在生成帮助菜单，请稍候...", false);

      const base64Image = await generateHelpImage();

      this.reply(segment.image(`base64://${base64Image}`), false);
    } catch (error) {
      console.error("生成帮助失败:", error);
      this.reply("生成帮助时出现错误，请稍后重试", false);
    }
  }
}
