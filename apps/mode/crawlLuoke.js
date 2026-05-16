import fs from 'fs';
import path from 'path';
import pinyin from 'pinyin';
import puppeteer from 'puppeteer';

const projectRoot = process.cwd();
const DATA_DIR = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'BinData');

// 图片 CDN 配置
const IMAGE_CDN_BASE = 'https://raw.gitcode.com/hurylove/rocom_img/raw/main/friends';

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

function petNameToPinyin(name) {
    const result = pinyin.pinyin(name, { style: 0 });
    return result.join('').toLowerCase();
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
    
    const seenNames = new Set();
    const uniqueResults = [];
    
    for (const result of results) {
        if (!seenNames.has(result.name)) {
            seenNames.add(result.name);
            uniqueResults.push(result);
            if (uniqueResults.length >= topN) break;
        }
    }
    
    return uniqueResults;
}

function getWebpFileName(petName) {
    const py = petNameToPinyin(petName);
    return `JL_${py}.webp`;
}

function getPetImageUrl(petName) {
    const webpName = getWebpFileName(petName);
    return `${IMAGE_CDN_BASE}/${webpName}`;
}

function printResults(results, inputWeightKg, inputHeightM) {
    console.log(`\n=== 匹配结果 (按相似度排序) ==`);
    console.log(`\n序号 | 宠物名称 | 相似度 | webp文件名`);
    console.log(`-----|----------|--------|-------------------`);
    
    results.forEach((result, index) => {
        const similarity = (result.similarity * 100).toFixed(2) + '%';
        const webpName = getWebpFileName(result.name);
        
        console.log(`${index + 1}`.padStart(4, ' ') + ' | ' +
                    result.name.padEnd(8, ' ') + ' | ' +
                    similarity.padStart(6, ' ') + ' | ' +
                    webpName);
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

async function renderResultImage(results, inputWeightKg, inputHeightM) {
    const launchOptions = {
        headless: 'new',
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    };

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    try {
        const topCandidate = results[0];
        const otherCandidates = results.slice(1);

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
                <img src="${getPetImageUrl(topCandidate.name)}" alt="${escapeHTML(topCandidate.name)}" class="lead-thumb" />
            </div>
            <div class="lead-info">
                <div class="lead-title">${escapeHTML(topCandidate.name)}</div>
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
                        <img src="${getPetImageUrl(candidate.name)}" alt="${escapeHTML(candidate.name)}" class="candidate-thumb" />
                    </div>
                    <div class="candidate-info">
                        <div class="candidate-title">${escapeHTML(candidate.name)}</div>
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
</body>
</html>
        `;

        await page.setViewport({ width: 1520, height: 800 });
        await page.setContent(html, { waitUntil: 'networkidle0' });

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

    const results = findClosestPets(inputWeightG, inputHeightCm, topN);
    
    if (results.length === 0) {
        return null;
    }

    const imageBase64 = await renderResultImage(results, weightKg, heightM);
    return imageBase64;
}

export {
    findClosestPets,
    calculateSimilarity,
    getWebpFileName,
    getPetImageUrl,
    renderResultImage,
    crawlLuoke
};

export default crawlLuoke;