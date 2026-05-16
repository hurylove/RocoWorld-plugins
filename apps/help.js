import plugin from "../../../lib/plugins/plugin.js";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', String.fromCharCode(38) + 'amp;')
    .replaceAll('<', String.fromCharCode(38) + 'lt;')
    .replaceAll('>', String.fromCharCode(38) + 'gt;')
    .replaceAll('"', String.fromCharCode(38) + 'quot;')
    .replaceAll("'", String.fromCharCode(38) + '#39;');
}

function parseYAML(yamlContent) {
  const config = {};
  const lines = yamlContent.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith("#") || trimmedLine === "") {
      continue;
    }

    const colonIndex = trimmedLine.indexOf(":");
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
    title: "孵蛋反差",
    items: [
      { cmd: "#孵蛋查询", desc: "查询孵蛋可能孵化的宠物，例如：#孵蛋查询 0.28 2.36" },
      { cmd: "#蛋查询", desc: "查询孵蛋可能孵化的宠物，例如：#蛋查询 0.28 2.36" }
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
          <div class="section-header">
            <span class="section-title">${escapeHTML(section.title)}</span>
            <span class="section-count">${section.items.length} 条</span>
          </div>
          <div class="list">
            ${section.items
              .map(
                (item) => `
              <div class="row">
                <div class="cmd">${escapeHTML(item.cmd)}</div>
                <div class="desc">${escapeHTML(item.desc)}</div>
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

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 34px;
          width: 1520px;
          min-height: 800px;
          color: var(--text-main);
          font-family: 'Noto Sans SC', sans-serif;
          background:
            radial-gradient(circle at 9% 10%, rgba(99, 102, 241, 0.14), transparent 32%),
            radial-gradient(circle at 86% 14%, rgba(236, 72, 153, 0.10), transparent 35%),
            radial-gradient(circle at 84% 92%, rgba(56, 189, 248, 0.10), transparent 30%),
            linear-gradient(150deg, var(--bg-1), var(--bg-2));
        }

        .container {
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
          padding-bottom: 18px;
          border-bottom: 1px solid var(--line);
        }

        .title-wrap h1 {
          margin: 0;
          font-size: 40px;
          line-height: 1.1;
          letter-spacing: 0.5px;
          font-family: 'Orbitron', 'Noto Sans SC', sans-serif;
          background: linear-gradient(90deg, #0f172a, #4f46e5, #db2777);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .title-wrap p {
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

        .chip {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: rgba(255, 255, 255, 0.9);
          color: #4338ca;
          font-size: 13px;
          font-weight: 600;
        }

        .content {
          padding-top: 8px;
        }

        .section {
          margin-top: 14px;
          border: 1px solid var(--line);
          border-radius: 16px;
          overflow: hidden;
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

        .section-title {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.4px;
        }

        .section-count {
          font-size: 13px;
          opacity: 0.95;
        }

        .list {
          padding: 14px 16px;
          background: #ffffff;
        }

        .row {
          display: grid;
          grid-template-columns: minmax(400px, 40%) 1fr;
          gap: 20px;
          align-items: center;
          padding: 14px 10px;
          border-bottom: 1px dashed rgba(148, 163, 184, 0.2);
        }

        .row:last-child {
          border-bottom: none;
        }

        .cmd {
          font-size: 26px;
          font-weight: 700;
          color: #4f46e5;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.18);
          border-radius: 10px;
          padding: 12px 16px;
          line-height: 1.45;
          word-break: break-all;
        }

        .desc {
          font-size: 22px;
          color: #475569;
          line-height: 1.6;
          padding-top: 3px;
          font-weight: 500;
        }

        .footer {
          margin-top: 16px;
          padding: 14px 16px;
          border-radius: 12px;
          background: rgba(99, 102, 241, 0.06);
          border: 1px solid var(--line);
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px 16px;
          font-size: 13px;
        }

        .meta-item {
          color: var(--text-sub);
          font-weight: 500;
        }

        .meta-item b {
          color: var(--text-main);
          margin-right: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="title-wrap">
            <h1>洛克王国插件帮助</h1>
            <p>RocoWorld-plugins v1.0.0</p>
          </div>
          <div class="meta">
            <div>共 ${helpSections.length} 个功能模块</div>
          </div>
        </div>

        <div class="content">
          ${sectionsHtml}
        </div>

        <div class="footer">
          <div class="meta-item"><b>插件名称：</b>RocoWorld-plugins</div>
          <div class="meta-item"><b>版本：</b>1.0.0</div>
          <div class="meta-item"><b>描述：</b>洛克王国世界查询插件</div>
        </div>
      </div>
    </body>
    </html>`;

    await page.setViewport({ width: 1520, height: 800 });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    await new Promise((resolve) => setTimeout(resolve, 600));

    const base64Image = await page.screenshot({
      encoding: 'base64',
      fullPage: true,
      omitBackground: false
    });

    console.log('✅ 帮助图片生成成功！');
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
