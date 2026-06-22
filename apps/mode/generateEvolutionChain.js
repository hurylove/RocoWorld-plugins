// 宠物进化链渲染脚本
// 功能：根据宠物名称生成进化链图片

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
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getPluginRoot() {
  const cwdPluginRoot = path.join(projectRoot, 'plugins', 'RocoWorld-plugins');
  if (fs.existsSync(cwdPluginRoot)) return cwdPluginRoot;
  return path.resolve(__dirname, '..', '..');
}

// 加载宠物数据
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

// 加载进化链数据
function loadEvolutionData() {
  const evolutionPath = path.join(getPluginRoot(), 'data', 'BinData', 'PET_EVOLUTION_CONF.json');
  const rawData = fs.readFileSync(evolutionPath, 'utf-8');
  const data = JSON.parse(rawData);
  return data.RocoDataRows;
}

// 获取宠物图片
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

// 去除零宽空格等不可见字符
const cleanName = (str) => str.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

// 通过 evolves_from_id 构建完整进化链（支持首领进化等）
function buildChainFromEvolvesFrom(startPet, petsMap) {
  const chain = [];
  const addedIds = new Set();

  // 向上查找：找到最初始的形态
  let rootPet = startPet;
  while (rootPet && rootPet.evolves_from_id) {
    const parent = petsMap.get(rootPet.evolves_from_id);
    if (parent) {
      rootPet = parent;
    } else {
      break;
    }
  }

  // 从初始形态向下递归构建完整进化链
  function addDescendants(pet, stage) {
    if (!pet || addedIds.has(pet.id)) return;

    const formName = pet.localized?.zh?.name || pet.form;

    // 检查是否已有同名宠物，优先选择 base_hp 不为 0 的
    const existingSameName = chain.find(p => p.name === formName);
    if (existingSameName) {
      // 如果已有的 base_hp 为 0，而新的不为 0，则替换
      if (existingSameName.baseHp === 0 && pet.base_hp > 0) {
        const idx = chain.indexOf(existingSameName);
        chain[idx] = {
          id: pet.id,
          name: formName,
          stage: existingSameName.stage,
          level: pet.level,
          imageSrc: getPetImageSrc(pet, formName, petsMap),
          typeText: [pet.main_type?.localized?.zh, pet.sub_type?.localized?.zh].filter(Boolean).join('/') || '未知',
          baseHp: pet.base_hp || 0,
          isLeader: pet.is_leader_form || false
        };
      }
      // 不再递归这个宠物的后代，避免重复
      return;
    }

    addedIds.add(pet.id);

    chain.push({
      id: pet.id,
      name: formName,
      stage,
      level: pet.level,
      imageSrc: getPetImageSrc(pet, formName, petsMap),
      typeText: [pet.main_type?.localized?.zh, pet.sub_type?.localized?.zh].filter(Boolean).join('/') || '未知',
      baseHp: pet.base_hp || 0,
      isLeader: pet.is_leader_form || false
    });

    // 查找所有从这个宠物进化来的后代
    for (const [, p] of petsMap) {
      if (p.evolves_from_id === pet.id) {
        addDescendants(p, stage + 1);
      }
    }
  }

  addDescendants(rootPet, 1);
  return chain;
}

// 根据宠物名称查找所有相关进化链
function findEvolutionChains(petName, evolutionData, petsMap) {
  const chains = [];
  const cleanedPetName = cleanName(petName);

  // 找到目标宠物
  let targetPet = null;
  for (const [, pet] of petsMap) {
    const formName = cleanName(pet.localized?.zh?.name || pet.form);
    if (formName === cleanedPetName) {
      targetPet = pet;
      break;
    }
  }

  if (!targetPet) return chains;

  // 方法1: 从进化链数据中查找
  for (const chainId of Object.keys(evolutionData)) {
    const chain = evolutionData[chainId];
    if (!chain.evolution_chain || chain.evolution_chain.length === 0) continue;

    const containsPet = chain.evolution_chain.some(evo => evo.petbase_id === targetPet.id);

    if (containsPet) {
      const details = [];
      for (const evo of chain.evolution_chain) {
        const pet = petsMap.get(evo.petbase_id);
        if (!pet) continue;

        const formName = pet.localized?.zh?.name || pet.form;
        const imageSrc = getPetImageSrc(pet, formName, petsMap);
        const mainType = pet.main_type?.localized?.zh || '未知';
        const subType = pet.sub_type?.localized?.zh;

        details.push({
          id: evo.petbase_id,
          name: formName,
          stage: evo.stage,
          level: evo.level,
          imageSrc,
          typeText: subType ? `${mainType}/${subType}` : mainType,
          baseHp: pet.base_hp || 0,
          isLeader: pet.is_leader_form || false
        });
      }

      // 继续通过 evolves_from_id 添加首领进化等
      const lastDetail = details[details.length - 1];
      if (lastDetail) {
        for (const [, p] of petsMap) {
          if (p.evolves_from_id === lastDetail.id) {
            const formName = p.localized?.zh?.name || p.form;
            // 检查是否已有同名宠物
            const existingSameName = details.find(d => d.name === formName);
            if (existingSameName) {
              // 如果已有的 base_hp 为 0，而新的不为 0，则替换
              if (existingSameName.baseHp === 0 && p.base_hp > 0) {
                const idx = details.indexOf(existingSameName);
                const imageSrc = getPetImageSrc(p, formName, petsMap);
                const mainType = p.main_type?.localized?.zh || '未知';
                const subType = p.sub_type?.localized?.zh;
                details[idx] = {
                  id: p.id,
                  name: formName,
                  stage: existingSameName.stage,
                  level: p.level,
                  imageSrc,
                  typeText: subType ? `${mainType}/${subType}` : mainType,
                  baseHp: p.base_hp || 0,
                  isLeader: p.is_leader_form || false
                };
              }
            } else {
              const imageSrc = getPetImageSrc(p, formName, petsMap);
              const mainType = p.main_type?.localized?.zh || '未知';
              const subType = p.sub_type?.localized?.zh;
              details.push({
                id: p.id,
                name: formName,
                stage: lastDetail.stage + 1,
                level: p.level,
                imageSrc,
                typeText: subType ? `${mainType}/${subType}` : mainType,
                baseHp: p.base_hp || 0,
                isLeader: p.is_leader_form || false
              });
            }
          }
        }
      }

      // 使用进化链中第一个宠物的名字作为标题，而不是数据中的名字
      const firstName = details[0]?.name || petName;
      chains.push({ name: `${firstName}进化链`, details });
    }
  }

  // 方法2: 如果没找到，通过 evolves_from_id 构建进化链
  if (chains.length === 0) {
    const details = buildChainFromEvolvesFrom(targetPet, petsMap);
    if (details.length > 0) {
      chains.push({ name: `${petName}进化链`, details });
    }
  }

  return chains;
}

// 生成进化链HTML
function generateEvolutionChainHTML(petName, chains) {
  if (chains.length === 0) {
    return `
      <div class="empty">
        <div class="empty-icon">?</div>
        <div class="empty-text">未找到 ${escapeHTML(petName)} 的进化链数据</div>
      </div>
    `;
  }

  let chainsHTML = '';

  for (const chain of chains) {
    const chainName = chain.name.replace('进化链', '').replace('（', '（').replace('）', '）');
    const pets = chain.details;

    let petsHTML = '';
    for (let i = 0; i < pets.length; i++) {
      const pet = pets[i];
      const isLast = i === pets.length - 1;

      petsHTML += `
        <div class="pet-card">
          <div class="pet-stage">阶段 ${pet.stage}</div>
          <div class="pet-image-wrap">
            ${pet.imageSrc
              ? `<img class="pet-image" src="${pet.imageSrc}" alt="${escapeHTML(pet.name)}" />`
              : '<div class="pet-image missing">暂无图片</div>'}
          </div>
          <div class="pet-name">${escapeHTML(pet.name)}</div>
          <div class="pet-type">${escapeHTML(pet.typeText)}</div>
          ${pet.isLeader ? '<div class="pet-leader">首领进化</div>' : ''}
          ${pet.level ? `<div class="pet-level">Lv.${pet.level} 进化</div>` : '<div class="pet-level">初始形态</div>'}
        </div>
        ${!isLast ? '<div class="evolution-arrow">→</div>' : ''}
      `;
    }

    chainsHTML += `
      <div class="chain-section">
        <div class="chain-title">${escapeHTML(chainName)}</div>
        <div class="chain-pets">${petsHTML}</div>
      </div>
    `;
  }

  return chainsHTML;
}

// 主函数：生成进化链图片
async function generateEvolutionChain(petName) {
  const petsMap = loadPetsMap();
  const evolutionData = loadEvolutionData();

  // 查找所有相关进化链
  const chains = findEvolutionChains(petName, evolutionData, petsMap);

  const config = loadConfig();
  const width = 1280;
  const chainCount = chains.length;
  const maxPetsInChain = Math.max(...chains.map(c => c.details.length), 1);
  const dynamicHeight = Math.max(600, 200 + chainCount * 300 + maxPetsInChain * 50);

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
    const chainsHTML = generateEvolutionChainHTML(petName, chains);

    const html = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: ${width}px;
            min-height: ${dynamicHeight}px;
            font-family: 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px;
            color: #fff;
          }
          .container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 24px;
            padding: 30px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #eee;
          }
          .title {
            font-size: 36px;
            font-weight: 800;
            color: #333;
            margin-bottom: 10px;
          }
          .subtitle {
            font-size: 16px;
            color: #666;
          }
          .chain-section {
            margin-bottom: 30px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 16px;
            border: 1px solid #e9ecef;
          }
          .chain-title {
            font-size: 20px;
            font-weight: 700;
            color: #495057;
            margin-bottom: 20px;
            padding-left: 10px;
            border-left: 4px solid #667eea;
          }
          .chain-pets {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            flex-wrap: wrap;
          }
          .pet-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            background: #fff;
            border-radius: 16px;
            padding: 15px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            min-width: 150px;
            transition: transform 0.2s;
          }
          .pet-card:hover {
            transform: translateY(-5px);
          }
          .pet-stage {
            font-size: 12px;
            color: #667eea;
            font-weight: 600;
            margin-bottom: 8px;
            background: rgba(102, 126, 234, 0.1);
            padding: 2px 10px;
            border-radius: 10px;
          }
          .pet-image-wrap {
            width: 120px;
            height: 120px;
            margin: 10px 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .pet-image {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .pet-image.missing {
            background: #f0f0f0;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #999;
            font-size: 14px;
          }
          .pet-name {
            font-size: 18px;
            font-weight: 700;
            color: #333;
            margin: 8px 0 4px;
          }
          .pet-type {
            font-size: 13px;
            color: #666;
            margin-bottom: 6px;
          }
          .pet-level {
            font-size: 12px;
            color: #28a745;
            font-weight: 600;
            background: rgba(40, 167, 69, 0.1);
            padding: 2px 8px;
            border-radius: 8px;
          }
          .pet-leader {
            font-size: 12px;
            color: #e91e63;
            font-weight: 600;
            background: rgba(233, 30, 99, 0.1);
            padding: 2px 8px;
            border-radius: 8px;
            margin-bottom: 4px;
          }
          .evolution-arrow {
            font-size: 40px;
            color: #667eea;
            font-weight: 900;
            margin: 0 10px;
          }
          .empty {
            text-align: center;
            padding: 60px 20px;
          }
          .empty-icon {
            font-size: 60px;
            margin-bottom: 20px;
          }
          .empty-text {
            font-size: 18px;
            color: #666;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #eee;
            font-size: 14px;
            color: #999;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="title">${escapeHTML(petName)} · 进化链</div>
            <div class="subtitle">展示宠物的进化路径和形态变化</div>
          </div>
          ${chainsHTML}
          <div class="footer">RocoWorld 插件渲染 | 数据来源: PET_Evolution_Conf</div>
        </div>
      </body>
      </html>
    `;

    await page.setViewport({ width, height: dynamicHeight });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    await new Promise(resolve => setTimeout(resolve, 500));

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

export default generateEvolutionChain;

// 如果直接运行此文件
if (process.argv[1]?.endsWith('generateEvolutionChain.js')) {
  const testPetName = process.argv[2] || '喵喵';
  console.log(`正在生成 ${testPetName} 的进化链图片...`);
  generateEvolutionChain(testPetName)
    .then(base64 => {
      const outputPath = path.join(__dirname, `${testPetName}_evolution.png`);
      fs.writeFileSync(outputPath, Buffer.from(base64, 'base64'));
      console.log(`图片已保存到: ${outputPath}`);
    })
    .catch(error => {
      console.error('生成失败:', error);
    });
}
