import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
    try {
      const fallbackPath = path.join(projectRoot, 'config', 'defaultConfig', 'config.yaml');
      const fallbackData = fs.readFileSync(fallbackPath, 'utf-8');
      return parseYAML(fallbackData);
    } catch (_) {
      console.warn('读取配置文件失败，使用默认配置:', error.message);
      return {};
    }
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

function getPluginRoot() {
  const cwdPluginRoot = path.join(projectRoot, 'plugins', 'RocoWorld-plugins');
  if (fs.existsSync(cwdPluginRoot)) return cwdPluginRoot;
  return path.resolve(__dirname, '..', '..');
}

function loadPetsMap() {
  const petsPath = path.join(getPluginRoot(), 'data', 'other', 'Pets.json');
  const rawData = fs.readFileSync(petsPath, 'utf-8');
  const pets = JSON.parse(rawData);
  const map = new Map();

  for (const pet of pets) {
    if (pet?.id) map.set(pet.id, pet);
  }

  return map;
}

function getPetImageSrc(pet, petName, petsMap) {
  const friendsDir = path.join(getPluginRoot(), 'data', 'friends');
  const candidates = [];

  if (pet?.name) candidates.push(pet.name);

  for (const otherPet of petsMap.values()) {
    if (otherPet?.id !== pet?.id && otherPet?.localized?.zh?.name === petName && otherPet?.name) {
      candidates.push(otherPet.name);
    }
  }

  for (const name of candidates) {
    const imagePath = path.join(friendsDir, `JL_${name}.webp`);
    if (fs.existsSync(imagePath)) {
      const buffer = fs.readFileSync(imagePath);
      return `data:image/webp;base64,${buffer.toString('base64')}`;
    }
  }

  return '';
}

function normalizeForms(petName, forms) {
  const petsMap = loadPetsMap();

  return forms.map((form, index) => {
    const pet = petsMap.get(form.id);
    const imageSrc = getPetImageSrc(pet, petName, petsMap);
    const formName = form.form === '默认形态' ? '默认形态' : form.form;
    const displayName = form.form === '默认形态' ? `${petName}（默认）` : `${petName}（${form.form}）`;

    return {
      index: index + 1,
      id: form.id,
      formName,
      displayName,
      imageSrc,
      typeText: [pet?.main_type?.localized?.zh, pet?.sub_type?.localized?.zh].filter(Boolean).join(' / ') || '未知属性',
      stats: {
        hp: pet?.base_hp ?? '--',
        atk: pet?.base_phy_atk ?? '--',
        matk: pet?.base_mag_atk ?? '--',
        def: pet?.base_phy_def ?? '--',
        mdef: pet?.base_mag_def ?? '--',
        spd: pet?.base_spd ?? '--'
      }
    };
  });
}

async function generatePetFormChart(petName, forms = []) {
  const normalizedForms = normalizeForms(petName, forms);
  const config = loadConfig();
  const width = 1280;
  const cardRows = Math.ceil(normalizedForms.length / 2);
  const dynamicHeight = Math.max(760, 260 + cardRows * 390);

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
    const cards = normalizedForms.map((form) => `
      <article class="form-card">
        <div class="badge">#${form.index}</div>
        <div class="portrait-wrap">
          ${form.imageSrc
            ? `<img class="portrait" src="${form.imageSrc}" alt="${escapeHTML(form.displayName)}" />`
            : '<div class="portrait missing">暂无图片</div>'}
        </div>
        <div class="form-info">
          <div class="form-name">${escapeHTML(form.displayName)}</div>
          <div class="form-sub">形态：${escapeHTML(form.formName)}</div>
          <div class="chips">
            <span>ID ${escapeHTML(form.id)}</span>
            <span>${escapeHTML(form.typeText)}</span>
          </div>
          <div class="stats">
            <div><b>${escapeHTML(form.stats.hp)}</b><span>生命</span></div>
            <div><b>${escapeHTML(form.stats.atk)}</b><span>物攻</span></div>
            <div><b>${escapeHTML(form.stats.matk)}</b><span>魔攻</span></div>
            <div><b>${escapeHTML(form.stats.def)}</b><span>物防</span></div>
            <div><b>${escapeHTML(form.stats.mdef)}</b><span>魔防</span></div>
            <div><b>${escapeHTML(form.stats.spd)}</b><span>速度</span></div>
          </div>
        </div>
      </article>
    `).join('');

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Noto+Sans+SC:wght@400;500;700;800&display=swap');
        * { box-sizing: border-box; }
        body {
          margin: 0;
          width: ${width}px;
          min-height: ${dynamicHeight}px;
          padding: 38px;
          color: #1e293b;
          font-family: 'Noto Sans SC', sans-serif;
          background:
            radial-gradient(circle at 8% 8%, rgba(59, 130, 246, 0.16), transparent 32%),
            radial-gradient(circle at 92% 10%, rgba(14, 165, 233, 0.12), transparent 30%),
            radial-gradient(circle at 88% 92%, rgba(20, 184, 166, 0.12), transparent 32%),
            linear-gradient(145deg, #f8fbff 0%, #eef4ff 52%, #f7fafc 100%);
        }
        .card {
          width: 100%;
          min-height: calc(${dynamicHeight}px - 76px);
          background: linear-gradient(165deg, rgba(255,255,255,0.96), rgba(255,255,255,0.92));
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 28px;
          box-shadow: 0 22px 52px rgba(30, 41, 59, 0.13);
          padding: 32px;
          overflow: hidden;
        }
        .header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 24px;
          margin-bottom: 26px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.30);
        }
        .title h1 {
          margin: 0;
          font-size: 44px;
          line-height: 1.15;
          letter-spacing: 0.5px;
          font-family: 'Orbitron', 'Noto Sans SC', sans-serif;
          background: linear-gradient(90deg, #0f172a, #2563eb, #0ea5a4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .title p {
          margin: 10px 0 0;
          color: #64748b;
          font-size: 17px;
          font-weight: 600;
        }
        .meta {
          min-width: 210px;
          text-align: right;
          color: #64748b;
          font-size: 15px;
          line-height: 1.7;
          font-weight: 600;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 22px;
        }
        .form-card {
          position: relative;
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          gap: 18px;
          min-height: 330px;
          padding: 20px;
          border-radius: 22px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          background: linear-gradient(150deg, rgba(255,255,255,0.98), rgba(248,250,252,0.92));
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
          overflow: hidden;
        }
        .form-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 18% 16%, rgba(37, 99, 235, 0.10), transparent 38%);
          pointer-events: none;
        }
        .badge {
          position: absolute;
          top: 16px;
          right: 18px;
          z-index: 2;
          padding: 6px 12px;
          border-radius: 999px;
          color: #2563eb;
          background: rgba(37, 99, 235, 0.09);
          border: 1px solid rgba(37, 99, 235, 0.18);
          font-family: 'Orbitron', 'Noto Sans SC', sans-serif;
          font-weight: 700;
        }
        .portrait-wrap {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 290px;
          border-radius: 18px;
          background:
            radial-gradient(circle at center, rgba(14, 165, 233, 0.16), transparent 60%),
            linear-gradient(145deg, rgba(239,246,255,0.94), rgba(255,255,255,0.86));
          border: 1px solid rgba(148, 163, 184, 0.24);
        }
        .portrait {
          max-width: 210px;
          max-height: 250px;
          object-fit: contain;
          filter: drop-shadow(0 16px 18px rgba(15, 23, 42, 0.20));
        }
        .portrait.missing {
          width: 160px;
          height: 160px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          font-size: 18px;
          font-weight: 800;
          border-radius: 50%;
          border: 1px dashed rgba(148, 163, 184, 0.55);
        }
        .form-info {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 0;
          padding-right: 26px;
        }
        .form-name {
          font-size: 31px;
          line-height: 1.25;
          font-weight: 800;
          color: #0f172a;
          word-break: break-word;
        }
        .form-sub {
          margin-top: 10px;
          color: #475569;
          font-size: 19px;
          font-weight: 700;
        }
        .chips {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 18px;
        }
        .chips span {
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.08);
          border: 1px solid rgba(37, 99, 235, 0.14);
          color: #1d4ed8;
          font-size: 14px;
          font-weight: 800;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 20px;
        }
        .stats div {
          padding: 10px 8px;
          text-align: center;
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.22);
          background: rgba(255,255,255,0.86);
        }
        .stats b {
          display: block;
          color: #0f172a;
          font-size: 20px;
          line-height: 1.1;
          font-family: 'Orbitron', 'Noto Sans SC', sans-serif;
        }
        .stats span {
          display: block;
          margin-top: 5px;
          color: #64748b;
          font-size: 12px;
          font-weight: 700;
        }
        .footer {
          margin-top: 26px;
          padding: 15px 18px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(14, 165, 180, 0.06));
          border: 1px solid rgba(148, 163, 184, 0.28);
          color: #64748b;
          font-size: 14px;
          text-align: center;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <main class="card">
        <header class="header">
          <div class="title">
            <h1>${escapeHTML(petName)} · 形态图鉴</h1>
            <p>展示宠物样子与对应形态名称</p>
          </div>
          <div class="meta">
            <div>形态数量：${normalizedForms.length}</div>
            <div>数据来源：PETBASE / Pets</div>
          </div>
        </header>
        <section class="grid">${cards}</section>
        <div class="footer">发送 #宠物名称资料卡 可查看对应形态的完整资料卡</div>
      </main>
    </body>
    </html>
    `;

    await page.setViewport({ width, height: dynamicHeight });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const base64Image = await page.screenshot({
      encoding: 'base64',
      fullPage: true,
      omitBackground: false
    });

    console.log(`✅ 宠物形态图生成成功：${petName}`);
    return base64Image;
  } catch (error) {
    console.error('❌ 宠物形态图渲染失败:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default generatePetFormChart;
