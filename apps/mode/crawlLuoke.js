import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const projectRoot = process.cwd();
const PLUGIN_DIR = path.join(projectRoot, 'plugins', 'RocoWorld-plugins');
const DATA_DIR = path.join(PLUGIN_DIR, 'data', 'BinData');
const JLTJ_DIR = path.join(PLUGIN_DIR, 'data', 'jltj');
const EXCLUDE_PATH = path.join(PLUGIN_DIR, 'data', 'jllb', '排除名单.json');
const FRIENDS_DIR = path.join(PLUGIN_DIR, 'data', 'friends');
const PETS_JSON_PATH = path.join(PLUGIN_DIR, 'data', 'other', 'Pets.json');
const configPath = path.join(PLUGIN_DIR, 'config', 'config.yaml');

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
        const configData = fs.readFileSync(configPath, 'utf-8');
        return parseYAML(configData);
    } catch (error) {
        console.warn('读取配置文件失败，使用默认配置:', error.message);
        return {};
    }
}

function loadJSONFile(fileName) {
    const filePath = path.join(DATA_DIR, fileName);
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data).RocoDataRows;
    } catch (error) {
        console.error(`读取文件 ${fileName} 失败:`, error.message);
        return {};
    }
}

function loadExcludeSet() {
    try {
        const data = fs.readFileSync(EXCLUDE_PATH, 'utf-8');
        const list = JSON.parse(data);
        const nameSet = new Set();
        for (const item of list) {
            if (item['名字']) {
                nameSet.add(item['名字']);
            }
        }
        return nameSet;
    } catch (error) {
        console.error('读取排除名单.json 失败:', error.message);
        return new Set();
    }
}

// 缓存 Pets.json 的 id → 英文name 映射
let _petsIdToNameMap = null;
// 缓存 Pets.json 的 base_id 对应的所有 id 列表
let _petsBaseIdMap = null;
// 缓存 Pets.json 中已实装（implemented===true）的宠物英文名集合
let _implementedNameSet = null;

function loadPetsIdToNameMap() {
    if (_petsIdToNameMap) return _petsIdToNameMap;
    try {
        const data = fs.readFileSync(PETS_JSON_PATH, 'utf-8');
        const list = JSON.parse(data);
        _petsIdToNameMap = {};
        _petsBaseIdMap = {};
        _implementedNameSet = new Set();
        for (const pet of list) {
            if (pet.id && pet.name) {
                _petsIdToNameMap[pet.id] = pet.name;
                // 收集每个宠物的 base_id（即它自身 id，用于查找同一学名的其他形态）
                // Pets.json 中 base_id 就是该条目的 id 本身，相同 name 的多个 id 即为同一组
                if (!_petsBaseIdMap[pet.name]) _petsBaseIdMap[pet.name] = [];
                _petsBaseIdMap[pet.name].push(pet.id);
                // 收集已实装的宠物 name
                if (pet.implemented === true) {
                    _implementedNameSet.add(pet.name);
                }
            }
        }
        return _petsIdToNameMap;
    } catch (error) {
        console.warn('读取 Pets.json 失败:', error.message);
        _petsIdToNameMap = {};
        _petsBaseIdMap = {};
        _implementedNameSet = new Set();
        return _petsIdToNameMap;
    }
}

function loadImplementedNameSet() {
    loadPetsIdToNameMap(); // 确保数据已加载
    return _implementedNameSet;
}

// 通过 baseId 获取本地 friends 图片的 base64，找不到返回 null
function getPetLocalImageBase64(baseId) {
    const idToName = loadPetsIdToNameMap();
    const engName = idToName[baseId];
    if (!engName) return null;
    // 尝试精确匹配
    const filePath = path.join(FRIENDS_DIR, `JL_${engName}.webp`);
    if (fs.existsSync(filePath)) {
        try {
            const buf = fs.readFileSync(filePath);
            return `data:image/webp;base64,${buf.toString('base64')}`;
        } catch (error) {
            console.warn(`读取本地图片 JL_${engName}.webp 失败:`, error.message);
            return null;
        }
    }
    // fallback：在 Pets.json 中找同中文名的其他形态 id，取其对应的图片
    const sameName = _petsBaseIdMap ? _petsBaseIdMap[engName.split('_')[0]] : null;
    // 更直接：查找所有 Pets.json 中同中文名、不同 id 的条目
    if (_petsBaseIdMap) {
        // 找出与当前 engName 开头相同部分的所有 name
        const siblings = Object.entries(idToName)
            .filter(([id, name]) => Number(id) !== baseId && name !== engName);
        for (const [sibId, sibName] of siblings) {
            // 只尝试相邻 id（差小于10），避免匹配到完全不相关的宠物
            if (Math.abs(Number(sibId) - baseId) <= 10) {
                const sibPath = path.join(FRIENDS_DIR, `JL_${sibName}.webp`);
                if (fs.existsSync(sibPath)) {
                    console.warn(`未找到 JL_${engName}.webp，使用相邻形态 fallback: JL_${sibName}.webp`);
                    try {
                        const buf = fs.readFileSync(sibPath);
                        return `data:image/webp;base64,${buf.toString('base64')}`;
                    } catch (_) {}
                }
            }
        }
    }
    return null;
}

function calculateSimilarity(inputWeight, inputHeight, eggData) {
    const weightLow = eggData.weight_low;
    const weightHigh = eggData.weight_high;
    const heightLow = eggData.height_low;
    const heightHigh = eggData.height_high;

    const avgWeight = (weightLow + weightHigh) / 2;
    const avgHeight = (heightLow + heightHigh) / 2;
    
    const weightRange = weightHigh - weightLow || 1;
    const heightRange = heightHigh - heightLow || 1;

    const weightDiff = Math.abs(inputWeight - avgWeight) / weightRange;
    const heightDiff = Math.abs(inputHeight - avgHeight) / heightRange;
    
    const similarity = 1 - (weightDiff + heightDiff) / 2;
    
    return Math.max(0, similarity);
}

function findClosestPets(inputWeight, inputHeight, topN = 10) {
    const eggConf = loadJSONFile('PET_EGG_CONF.json');
    const petConf = loadJSONFile('PET_CONF.json');
    
    if (Object.keys(eggConf).length === 0) {
        console.error('PET_EGG_CONF.json 数据为空');
        return [];
    }

    const results = [];
    
    for (const eggId in eggConf) {
        const eggData = eggConf[eggId];
        const similarity = calculateSimilarity(inputWeight, inputHeight, eggData);
        
        let petName = eggData.name;
        let baseId = null;
        
        if (petConf[eggData.pet_id]) {
            petName = petConf[eggData.pet_id].name || eggData.name;
            baseId = petConf[eggData.pet_id].base_id;
        }

        results.push({
            eggId: eggData.id,
            petId: eggData.pet_id,
            baseId: baseId,
            name: petName,
            form: eggData.form || '',
            modelId: eggData.model_id,
            weightLow: eggData.weight_low,
            weightHigh: eggData.weight_high,
            heightLow: eggData.height_low,
            heightHigh: eggData.height_high,
            avgWeight: (eggData.weight_low + eggData.weight_high) / 2,
            avgHeight: (eggData.height_low + eggData.height_high) / 2,
            similarity: similarity
        });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    
    const seenKeys = new Set();
    // 记录已有 form 的宠物名称集合，用于过滤同名无 form 的冗余条目
    const namesWithForm = new Set();
    // 第一遍：收集所有有 form 的宠物名称
    for (const result of results) {
        if (result.form) namesWithForm.add(result.name);
    }
    const uniqueResults = [];
    
    for (const result of results) {
        // 如果该宠物名称存在带 form 的版本，则跳过无 form 的条目
        if (!result.form && namesWithForm.has(result.name)) continue;
        const key = result.name + '|' + (result.form || '');
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueResults.push(result);
            if (uniqueResults.length >= topN) break;
        }
    }
    
    return uniqueResults;
}

function preloadImagesFromLocal(results) {
    const imageCache = {};
    for (const result of results) {
        if (result.baseId) {
            const base64 = getPetLocalImageBase64(result.baseId);
            if (base64) {
                imageCache[getDisplayName(result)] = base64;
            }
        }
    }
    return imageCache;
}

function filterByExcludeList(results, excludeSet) {
    const filtered = [];
    for (const result of results) {
        if (!excludeSet.has(result.name)) {
            filtered.push(result);
        }
    }
    return filtered;
}

function filterByImplemented(results) {
    const implementedSet = loadImplementedNameSet();
    if (implementedSet.size === 0) {
        console.warn('未加载到已实装宠物数据，跳过 implemented 过滤');
        return results;
    }
    const filtered = [];
    for (const result of results) {
        if (implementedSet.has(result.name)) {
            filtered.push(result);
        }
    }
    return filtered;
}

function attachPortraits(results) {
    // 保留此函数以兼容，现在图片直接从本地读取，不再需要 portrait URL
    return results;
}

function printResults(results, inputWeightKg, inputHeightM) {
    console.log(`\n=== 匹配结果 (按相似度排序) ==`);
    console.log(`\n序号 | 宠物名称 | 相似度`);
    console.log(`-----|----------|--------`);
    
    results.forEach((result, index) => {
        const similarity = (result.similarity * 100).toFixed(2) + '%';
        console.log(`${index + 1}`.padStart(4, ' ') + ' | ' +
                    result.name.padEnd(8, ' ') + ' | ' +
                    similarity.padStart(6, ' '));
    });
}

function main(weightKg, heightM, topN = 10) {
    const inputWeightG = weightKg * 1000;
    const inputHeightCm = heightM * 100;

    const results = findClosestPets(inputWeightG, inputHeightCm, topN);
    
    if (results.length === 0) {
        console.log('未找到匹配的宠物');
        return;
    }

    printResults(results, weightKg, heightM);
}

if (process.argv[1] && process.argv[1].endsWith('pet_egg_matcher.js')) {
    const weightKg = process.argv[2] ? parseFloat(process.argv[2]) : 2.36;
    const heightM = process.argv[3] ? parseFloat(process.argv[3]) : 0.28;
    const topN = process.argv[4] ? parseInt(process.argv[4]) : 10;
    
    main(weightKg, heightM, topN);
}

function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function getDisplayName(item) {
    return item.form ? `${item.name}（${item.form}）` : item.name;
}

async function renderResultImage(results, inputWeightKg, inputHeightM) {
    const config = loadConfig();
    
    console.log('正在加载本地宠物图片...');
    const imageCache = preloadImagesFromLocal(results);
    console.log(`本地图片加载完成，成功加载 ${Object.keys(imageCache).length}/${results.length} 张图片`);
    
    const launchOptions = {
        headless: 'new',
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    };

    if (config.chromiumPath) {
        console.log(`使用配置的Chrome路径: ${config.chromiumPath}`);
        launchOptions.executablePath = config.chromiumPath;
    } else {
        console.log('使用默认Chrome路径');
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    try {
        const topCandidate = results[0];
        const otherCandidates = results.slice(1);
        
        const getImageSrc = (petName) => {
            return imageCache[petName] || '';
        };

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
            width: 1520px;
            min-height: 800px;
            padding: 18px;
            font-family: 'Noto Sans SC', 'PingFang SC', sans-serif;
            color: #3d3024;
            background: #c7c2b7;
        }
        .board {
            border-radius: 28px;
            overflow: hidden;
        }
        .top {
            background: #ebe8e1;
            border-radius: 26px;
            padding: 22px 26px;
            border: 1px solid rgba(120, 102, 83, 0.15);
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
        }
        .title-wrap {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .title {
            margin: 0;
            font-size: 58px;
            line-height: 1;
            font-weight: 900;
            letter-spacing: 1px;
            color: #2f241a;
        }
        .date {
            font-size: 26px;
            color: #5f5245;
            font-weight: 600;
        }
        .stats {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
            justify-content: flex-end;
            max-width: 640px;
        }
        .chip {
            background: #f4f1ea;
            border: 1px solid rgba(120, 102, 83, 0.16);
            border-radius: 999px;
            padding: 10px 20px;
            font-size: 22px;
            font-weight: 800;
            color: #57493b;
            white-space: nowrap;
        }
        .chip strong {
            color: #8b5d23;
            margin-left: 6px;
        }
        .list {
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        .item-row {
            background: #eeebe5;
            border-radius: 24px;
            border: 1px solid rgba(120, 102, 83, 0.12);
            padding: 18px 22px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .item-left {
            display: flex;
            align-items: center;
            gap: 20px;
            min-width: 0;
        }
        .thumb-wrap {
            width: 118px;
            height: 118px;
            border-radius: 18px;
            background: #f3f0e9;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(120, 102, 83, 0.12);
            flex-shrink: 0;
        }
        .thumb {
            width: 106px;
            height: 106px;
            object-fit: contain;
        }
        .thumb-fallback {
            font-size: 38px;
            font-weight: 900;
            color: #9b8b77;
        }
        .item-main {
            min-width: 0;
        }
        .item-title {
            font-size: 58px;
            line-height: 1.02;
            font-weight: 900;
            color: #2f241a;
            margin-bottom: 8px;
            word-break: break-word;
        }
        .item-sub {
            font-size: 24px;
            color: #6a5b4e;
            margin-bottom: 8px;
            font-weight: 700;
        }
        .item-time {
            display: inline-block;
            background: #f2e2c3;
            color: #8a5b22;
            border-radius: 999px;
            padding: 6px 14px;
            font-size: 20px;
            font-weight: 800;
        }
        .tag {
            flex-shrink: 0;
            background: #f5f1ea;
            border: 1px solid rgba(120, 102, 83, 0.14);
            border-radius: 20px;
            color: #6f532f;
            padding: 10px 18px;
            font-size: 34px;
            font-weight: 900;
        }
        .empty {
            border-radius: 16px;
            background: #eeebe5;
            border: 1px solid rgba(120, 102, 83, 0.12);
            padding: 28px;
            font-size: 24px;
            color: #6d5d50;
            text-align: center;
            font-weight: 700;
        }
        .section-tip {
            margin: 0 0 16px 0;
            display: inline-block;
            font-size: 24px;
            font-weight: 700;
            color: #5f5245;
            background: #f4f1ea;
            border: 1px solid rgba(120, 102, 83, 0.16);
            border-radius: 999px;
            padding: 10px 20px;
        }
        .input-info {
            background: #f4f1ea;
            border-radius: 18px;
            border: 1px solid rgba(120, 102, 83, 0.12);
            padding: 16px 22px;
            margin-bottom: 16px;
            font-size: 24px;
            color: #5f5245;
            font-weight: 700;
        }
        .lead-candidate {
            background: #eeebe5;
            border-radius: 24px;
            border: 1px solid rgba(120, 102, 83, 0.12);
            padding: 18px 22px;
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 16px;
        }
        .lead-thumb-wrap {
            width: 118px;
            height: 118px;
            border-radius: 18px;
            background: #f3f0e9;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(120, 102, 83, 0.12);
            flex-shrink: 0;
        }
        .lead-thumb {
            width: 106px;
            height: 106px;
            object-fit: contain;
        }
        .lead-info {
            flex: 1;
            min-width: 0;
        }
        .lead-title {
            font-size: 58px;
            line-height: 1.02;
            font-weight: 900;
            color: #2f241a;
            margin-bottom: 8px;
        }
        .lead-sub {
            font-size: 24px;
            color: #6a5b4e;
            margin-bottom: 12px;
            font-weight: 700;
        }
        .lead-metrics {
            display: flex;
            gap: 14px;
            flex-wrap: wrap;
        }
        .lead-metric {
            display: inline-block;
            background: #f2e2c3;
            color: #8a5b22;
            border-radius: 999px;
            padding: 8px 16px;
            font-size: 22px;
            font-weight: 800;
        }
        .candidates-list {
            margin-top: 16px;
        }
        .candidates-list h3 {
            margin: 0 0 14px;
            font-size: 32px;
            font-weight: 900;
            color: #2f241a;
        }
        .candidate-row {
            background: #eeebe5;
            border-radius: 24px;
            border: 1px solid rgba(120, 102, 83, 0.12);
            padding: 18px 22px;
            display: flex;
            align-items: center;
            gap: 20px;
            margin-bottom: 14px;
        }
        .candidate-thumb-wrap {
            width: 118px;
            height: 118px;
            border-radius: 18px;
            background: #f3f0e9;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(120, 102, 83, 0.12);
            flex-shrink: 0;
        }
        .candidate-thumb {
            width: 106px;
            height: 106px;
            object-fit: contain;
        }
        .candidate-info {
            flex: 1;
            min-width: 0;
        }
        .candidate-title {
            font-size: 42px;
            line-height: 1.02;
            font-weight: 900;
            color: #2f241a;
            margin-bottom: 8px;
        }
        .candidate-metrics {
            display: flex;
            gap: 14px;
            flex-wrap: wrap;
            font-size: 22px;
            color: #5f5245;
        }
        .candidate-metric {
            font-weight: 700;
        }
        .candidate-tag {
            flex-shrink: 0;
            background: #f5f1ea;
            border: 1px solid rgba(120, 102, 83, 0.14);
            border-radius: 20px;
            color: #6f532f;
            padding: 10px 18px;
            font-size: 28px;
            font-weight: 900;
        }
        .footer {
            margin-top: 16px;
            text-align: right;
            font-size: 20px;
            color: #6a5b4e;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="board">
            <div class="top">
                <div class="title-wrap">
                    <h1 class="title">洛克王国孵蛋查询</h1>
                    <div class="date">蛋尺寸匹配工具</div>
                </div>
                <div class="stats">
                    <div class="chip">候选数量 <strong>${results.length}</strong></div>
                </div>
            </div>
            
            <div class="section-tip">输入参数：重量 ${inputWeightKg}kg，高度 ${inputHeightM}m</div>
            
            <div class="input-info">
                蛋尺寸：重量 ${inputWeightKg} kg (${(inputWeightKg * 1000).toFixed(0)}g)，高度 ${inputHeightM} m (${(inputHeightM * 100).toFixed(1)}cm)
            </div>

            ${topCandidate ? `
            <div class="lead-candidate">
                <div class="lead-thumb-wrap">
                    ${getImageSrc(getDisplayName(topCandidate)) ? `<img src="${getImageSrc(getDisplayName(topCandidate))}" alt="${escapeHTML(getDisplayName(topCandidate))}" class="lead-thumb" />` : `<div class="thumb-fallback">${escapeHTML(getDisplayName(topCandidate))[0] || '?'}</div>`}
                </div>
                <div class="lead-info">
                    <div class="lead-title">${escapeHTML(getDisplayName(topCandidate))}</div>
                    <div class="lead-sub">最匹配的宠物蛋</div>
                    <div class="lead-metrics">
                        <span class="lead-metric">尺寸: ${topCandidate.heightLow}-${topCandidate.heightHigh}cm</span>
                        <span class="lead-metric">重量: ${topCandidate.weightLow}-${topCandidate.weightHigh}g</span>
                        <span class="lead-metric">相似度: ${(topCandidate.similarity * 100).toFixed(2)}%</span>
                    </div>
                </div>
                <div class="tag">最佳匹配</div>
            </div>
            ` : ''}

            ${otherCandidates && otherCandidates.length > 0 ? `
            <div class="candidates-list">
                <h3>其他候选宠物</h3>
                <div class="list">
                    ${otherCandidates.map((candidate, index) => `
                    <div class="candidate-row">
                        <div class="candidate-thumb-wrap">
                            ${getImageSrc(getDisplayName(candidate)) ? `<img src="${getImageSrc(getDisplayName(candidate))}" alt="${escapeHTML(getDisplayName(candidate))}" class="candidate-thumb" />` : `<div class="thumb-fallback">${escapeHTML(getDisplayName(candidate))[0] || '?'}</div>`}
                        </div>
                    <div class="candidate-info">
                        <div class="candidate-title">${escapeHTML(getDisplayName(candidate))}</div>
                        <div class="candidate-metrics">
                            <span class="candidate-metric">尺寸: ${candidate.heightLow}-${candidate.heightHigh}cm</span>
                            <span class="candidate-metric">重量: ${candidate.weightLow}-${candidate.weightHigh}g</span>
                            <span class="candidate-metric">相似度: ${(candidate.similarity * 100).toFixed(2)}%</span>
                        </div>
                    </div>
                    <div class="candidate-tag">No.${index + 2}</div>
                </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
        
            <div class="footer">RocoWorld 插件渲染 | 数据来源: PET_EGG_CONF</div>
        </div>
    </div>
</body>
</html>
        `;

        await page.setViewport({ width: 1520, height: 800 });
        await page.setContent(html, { waitUntil: 'networkidle0' });

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

async function crawlLuoke(weightKg, heightM, topN = 10) {
    const inputWeightG = weightKg * 1000;
    const inputHeightCm = heightM * 100;

    const rawResults = findClosestPets(inputWeightG, inputHeightCm, 20);
    
    if (rawResults.length === 0) {
        return null;
    }

    const excludeSet = loadExcludeSet();
    console.log(`排除名单共 ${excludeSet.size} 个精灵，匹配到 ${rawResults.length} 个候选`);
    
    let filtered = filterByExcludeList(rawResults, excludeSet);
    console.log(`排除名单过滤后剩余 ${filtered.length} 个精灵`);
    
    filtered = filterByImplemented(filtered);
    console.log(`已实装过滤后剩余 ${filtered.length} 个精灵`);
    
    if (filtered.length === 0) {
        return null;
    }
    
    filtered = filtered.slice(0, topN);
    
    const imageBase64 = await renderResultImage(filtered, weightKg, heightM);
    return imageBase64;
}

export {
    findClosestPets,
    calculateSimilarity,
    filterByExcludeList,
    filterByImplemented,
    attachPortraits,
    renderResultImage,
    crawlLuoke
};

export default crawlLuoke;