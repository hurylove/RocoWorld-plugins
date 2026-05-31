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
    title: "形态查询",
    items: [
      { cmd: "#宠物名称查询", desc: "查询宠物所有形态，例如：#加油蟹查询" },
      { cmd: "#宠物名称全部形态", desc: "查询宠物所有形态（别名），例如：#加油蟹全部形态" }
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
    title: "词条查询",
    items: [
      { cmd: "#术语查询 关键词", desc: "查询词条，例如：#术语查询 洛克贝" },
      { cmd: "#术语总览", desc: "查看完整词条总览" },
      { cmd: "#术语大全", desc: "查看完整词条总览（别名）" }
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
    title: "孵蛋反查",
    items: [
      { cmd: "#孵蛋查询 尺寸 重量", desc: "查询孵蛋可能孵化的宠物，例如：#孵蛋查询 0.28 2.36" },
      { cmd: "#蛋查询 尺寸 重量", desc: "查询孵蛋可能孵化的宠物（别名）" }
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
        @font-face { font-family: 'Orbitron'; font-style: normal; font-weight: 500; src: local('Orbitron'), local('Arial'); }
        @font-face { font-family: 'Orbitron'; font-style: normal; font-weight: 700; src: local('Orbitron'), local('Arial'); }
        @font-face { font-family: 'Noto Sans SC'; font-style: normal; font-weight: 400; src: local('Noto Sans SC'), local('Microsoft YaHei'), local('PingFang SC'), local('sans-serif'); }
        @font-face { font-family: 'Noto Sans SC'; font-style: normal; font-weight: 500; src: local('Noto Sans SC'), local('Microsoft YaHei'), local('PingFang SC'), local('sans-serif'); }
        @font-face { font-family: 'Noto Sans SC'; font-style: normal; font-weight: 700; src: local('Noto Sans SC'), local('Microsoft YaHei Bold'), local('PingFang SC'), local('sans-serif'); }

        :root {
          --text-main: #1e293b;
          --text-sub: #64748b;
          --line: rgba(148, 163, 184, 0.30);
        }

        * { box-sizing: border-box; }

        body {
          margin: 0;
          padding: 40px;
          width: 1480px;
          min-height: 800px;
          color: var(--text-main);
          font-family: 'Noto Sans SC', sans-serif;
          background: linear-gradient(145deg, #f8fbff 0%, #eef4ff 52%, #f7fafc 100%);
        }

        .card {
          width: 100%;
          background: linear-gradient(165deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.92));
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 26px;
          box-shadow: 0 20px 45px rgba(30, 41, 59, 0.12);
          padding: 32px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 22px;
          padding-bottom: 22px;
          border-bottom: 1px solid var(--line);
        }

        .title-wrap h1 {
          margin: 0;
          font-size: 42px;
          line-height: 1.15;
          letter-spacing: 0.6px;
          font-family: 'Orbitron', 'Noto Sans SC', sans-serif;
          background: linear-gradient(90deg, #0f172a, #2563eb, #0ea5a4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .title-wrap p {
          margin: 10px 0 0;
          color: var(--text-sub);
          font-size: 16px;
          font-weight: 500;
        }

        .meta {
          text-align: right;
          color: var(--text-sub);
          font-size: 14px;
          line-height: 1.6;
        }

        .content {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .section {
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 18px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.88);
          box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          background: linear-gradient(90deg, rgba(37, 99, 235, 0.90), rgba(14, 165, 180, 0.88));
          color: #fff;
        }

        .section-title {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .section-count {
          font-size: 14px;
          opacity: 0.95;
          font-weight: 500;
        }

        .list {
          padding: 16px 20px;
          background: #ffffff;
        }

        .row {
          display: grid;
          grid-template-columns: minmax(420px, 40%) 1fr;
          gap: 24px;
          align-items: center;
          padding: 16px 12px;
          border-bottom: 1px dashed rgba(148, 163, 184, 0.22);
        }

        .row:last-child {
          border-bottom: none;
        }

        .cmd {
          font-size: 24px;
          font-weight: 700;
          color: #1d4ed8;
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(14, 165, 180, 0.06));
          border: 1px solid rgba(37, 99, 235, 0.20);
          border-radius: 12px;
          padding: 14px 18px;
          line-height: 1.5;
          word-break: break-all;
        }

        .desc {
          font-size: 20px;
          color: #475569;
          line-height: 1.6;
          font-weight: 500;
        }

        .footer {
          margin-top: 24px;
          padding: 16px 20px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(14, 165, 180, 0.06));
          border: 1px solid var(--line);
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px 16px;
          font-size: 14px;
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
      <div class="card">
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
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
    await new Promise((resolve) => setTimeout(resolve, 200));

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
