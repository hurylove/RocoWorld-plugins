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
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
        console.warn('读取配置文件失败，使用默认配置:', error.message);
        return {};
    }
}

const config = loadConfig();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', String.fromCharCode(38) + 'amp;')
        .replaceAll('<', String.fromCharCode(38) + 'lt;')
        .replaceAll('>', String.fromCharCode(38) + 'gt;')
        .replaceAll('"', String.fromCharCode(38) + 'quot;')
        .replaceAll("'", String.fromCharCode(38) + '#39;');
}

function loadNatureData() {
    const naturePath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'BinData', 'NATURE_CONF.json');
    const attrPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'BinData', 'ATTRIBUTE_CONF.json');

    const natureRaw = JSON.parse(fs.readFileSync(naturePath, 'utf-8')).RocoDataRows;
    const attrRaw = JSON.parse(fs.readFileSync(attrPath, 'utf-8')).RocoDataRows;

    const attrMap = {};
    for (const key in attrRaw) {
        const attr = attrRaw[key];
        attrMap[attr.attribute] = attr.attribute_name;
    }

    const natures = [];
    for (const key in natureRaw) {
        const n = natureRaw[key];
        if (!n.is_player_pet_nature) continue;
        natures.push({
            id: n.id,
            name: n.name,
            positiveAttrId: n.positive_effect,
            positiveAttr: attrMap[n.positive_effect] || `属性${n.positive_effect}`,
            negativeAttrId: n.negative_effect,
            negativeAttr: attrMap[n.negative_effect] || `属性${n.negative_effect}`,
            proportion: n.positive_effect_proportion,
            grow: n.positive_effect_grow,
            descs: (n.random_desc || []).map(d => d.nature_desc)
        });
    }

    return { natures, attrMap };
}

const attrOrder = ['物攻', '物防', '魔攻', '魔防', '速度', '生命'];
const attrIdMap = { '物攻': 80, '物防': 82, '魔攻': 81, '魔防': 83, '速度': 84, '生命': 79 };

const attrColors = {
    '物攻': { bg: 'rgba(239, 68, 68, 0.10)', text: '#b91c1c', border: 'rgba(239, 68, 68, 0.25)' },
    '物防': { bg: 'rgba(59, 130, 246, 0.10)', text: '#1d4ed8', border: 'rgba(59, 130, 246, 0.25)' },
    '魔攻': { bg: 'rgba(168, 85, 247, 0.10)', text: '#7e22ce', border: 'rgba(168, 85, 247, 0.25)' },
    '魔防': { bg: 'rgba(14, 165, 180, 0.10)', text: '#0e7490', border: 'rgba(14, 165, 180, 0.25)' },
    '速度': { bg: 'rgba(245, 158, 11, 0.10)', text: '#b45309', border: 'rgba(245, 158, 11, 0.25)' },
    '生命': { bg: 'rgba(16, 185, 129, 0.10)', text: '#047857', border: 'rgba(16, 185, 129, 0.25)' }
};

async function generateNatureChart() {
    const { natures } = loadNatureData();

    // 构建矩阵
    const matrix = {};
    for (const pos of attrOrder) {
        matrix[pos] = {};
        for (const neg of attrOrder) {
            matrix[pos][neg] = null;
        }
    }
    for (const n of natures) {
        if (matrix[n.positiveAttr] && matrix[n.positiveAttr][n.negativeAttr] !== undefined) {
            matrix[n.positiveAttr][n.negativeAttr] = n;
        }
    }

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
        const headerCells = attrOrder.map(attr => {
            const c = attrColors[attr];
            return `<th style="background:${c.bg};color:${c.text};border:1px solid ${c.border};font-size:18px;font-weight:700;padding:14px 10px;text-align:center;">减${attr}</th>`;
        }).join('');

        const rows = attrOrder.map(posAttr => {
            const posC = attrColors[posAttr];
            const cells = attrOrder.map(negAttr => {
                const n = matrix[posAttr][negAttr];
                if (!n) {
                    return `<td style="background:#f1f5f9;color:#94a3b8;text-align:center;font-size:20px;font-weight:700;padding:16px 10px;border:1px solid rgba(148,163,184,0.18);">—</td>`;
                }
                const negC = attrColors[negAttr];
                return `
                    <td style="background:linear-gradient(135deg, ${posC.bg}, ${negC.bg});text-align:center;padding:16px 10px;border:1px solid rgba(148,163,184,0.18);">
                        <div style="font-size:22px;font-weight:800;color:#1e293b;">${escapeHTML(n.name)}</div>
                    </td>
                `;
            }).join('');
            return `
                <tr>
                    <th style="background:${posC.bg};color:${posC.text};border:1px solid ${posC.border};font-size:18px;font-weight:700;padding:14px 10px;text-align:center;white-space:nowrap;">加${posAttr}</th>
                    ${cells}
                </tr>
            `;
        }).join('');

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8" />
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');
                * { box-sizing: border-box; }
                body {
                    margin: 0;
                    padding: 40px;
                    width: 1480px;
                    min-height: 800px;
                    color: #1e293b;
                    font-family: 'Noto Sans SC', sans-serif;
                    background: linear-gradient(145deg, #f8fbff 0%, #eef4ff 52%, #f7fafc 100%);
                }
                .card {
                    width: 100%;
                    background: linear-gradient(165deg, rgba(255,255,255,0.96), rgba(255,255,255,0.92));
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
                    margin-bottom: 24px;
                    padding-bottom: 22px;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.30);
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
                    color: #64748b;
                    font-size: 16px;
                    font-weight: 500;
                }
                .meta {
                    text-align: right;
                    color: #64748b;
                    font-size: 14px;
                    line-height: 1.6;
                }
                .legend {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                }
                .legend-item {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 14px;
                    border-radius: 999px;
                    border: 1px solid rgba(148, 163, 184, 0.25);
                    background: rgba(255, 255, 255, 0.9);
                    font-size: 14px;
                    font-weight: 600;
                    color: #334155;
                }
                .dot { width: 14px; height: 14px; border-radius: 50%; }
                table {
                    width: 100%;
                    border-collapse: separate;
                    border-spacing: 0;
                    border-radius: 16px;
                    overflow: hidden;
                    border: 1px solid rgba(148, 163, 184, 0.22);
                }
                th, td { border: 1px solid rgba(148, 163, 184, 0.15); }
                .footer {
                    margin-top: 24px;
                    padding: 16px 20px;
                    border-radius: 14px;
                    background: linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(14, 165, 180, 0.06));
                    border: 1px solid rgba(148, 163, 184, 0.30);
                    font-size: 14px;
                    color: #64748b;
                    text-align: center;
                    font-weight: 500;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <div class="title-wrap">
                        <h1>洛克王国 · 宠物性格表</h1>
                        <p>共 30 种性格，每种性格对应一项属性加成与一项属性减益</p>
                    </div>
                    <div class="meta">
                        <div>数据来源: NATURE_CONF.json</div>
                    </div>
                </div>

                <div class="legend">
                    ${attrOrder.map(attr => {
                        const c = attrColors[attr];
                        return `<div class="legend-item"><span class="dot" style="background:${c.text};"></span>${attr}</div>`;
                    }).join('')}
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="background:#f8fafc;border:1px solid rgba(148,163,184,0.22);font-size:16px;font-weight:700;padding:14px 10px;text-align:center;color:#475569;">加成 \\ 减益</th>
                            ${headerCells}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>

                <div class="footer">影响比例：±10%（proportion: 1000）&nbsp;|&nbsp; 成长值：+200（grow: 200）</div>
            </div>
        </body>
        </html>`;

        await page.setViewport({ width: 1480, height: 900 });
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        await wait(600);

        const base64Image = await page.screenshot({
            encoding: 'base64',
            fullPage: true,
            omitBackground: false
        });

        console.log('✅ 性格表生成成功！');
        return base64Image;
    } catch (error) {
        console.error('❌ 生成性格表失败:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

async function generateSingleNatureChart(natureName) {
    const { natures } = loadNatureData();
    const nature = natures.find(n => n.name === natureName);

    if (!nature) {
        return null;
    }

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
        const posC = attrColors[nature.positiveAttr] || attrColors['物攻'];
        const negC = attrColors[nature.negativeAttr] || attrColors['物防'];
        const descItems = nature.descs.map(d => `<div class="desc-item">${escapeHTML(d)}</div>`).join('');

        const htmlContent = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8" />
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');
                * { box-sizing: border-box; }
                body {
                    margin: 0;
                    padding: 40px;
                    width: 900px;
                    min-height: 600px;
                    color: #1e293b;
                    font-family: 'Noto Sans SC', sans-serif;
                    background: linear-gradient(145deg, #f8fbff 0%, #eef4ff 52%, #f7fafc 100%);
                }
                .card {
                    width: 100%;
                    background: linear-gradient(165deg, rgba(255,255,255,0.96), rgba(255,255,255,0.92));
                    border: 1px solid rgba(148, 163, 184, 0.35);
                    border-radius: 26px;
                    box-shadow: 0 20px 45px rgba(30, 41, 59, 0.12);
                    padding: 32px;
                }
                .header {
                    margin-bottom: 24px;
                    padding-bottom: 22px;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.30);
                }
                .header h1 {
                    margin: 0;
                    font-size: 42px;
                    line-height: 1.15;
                    letter-spacing: 0.6px;
                    font-family: 'Orbitron', 'Noto Sans SC', sans-serif;
                    background: linear-gradient(90deg, #0f172a, #2563eb, #0ea5a4);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .header p {
                    margin: 10px 0 0;
                    color: #64748b;
                    font-size: 16px;
                    font-weight: 500;
                }
                .nature-name {
                    font-size: 56px;
                    font-weight: 900;
                    color: #0f172a;
                    margin: 24px 0;
                    text-align: center;
                    letter-spacing: 2px;
                }
                .effect-row {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 16px;
                }
                .effect-card {
                    flex: 1;
                    border-radius: 18px;
                    padding: 22px;
                    text-align: center;
                    border: 1px solid;
                }
                .effect-card.positive {
                    background: ${posC.bg};
                    border-color: ${posC.border};
                }
                .effect-card.negative {
                    background: ${negC.bg};
                    border-color: ${negC.border};
                }
                .effect-label {
                    font-size: 16px;
                    font-weight: 700;
                    margin-bottom: 8px;
                }
                .effect-card.positive .effect-label { color: ${posC.text}; }
                .effect-card.negative .effect-label { color: ${negC.text}; }
                .effect-value {
                    font-size: 32px;
                    font-weight: 800;
                    color: #1e293b;
                }
                .effect-detail {
                    font-size: 14px;
                    color: #64748b;
                    margin-top: 6px;
                    font-weight: 500;
                }
                .section-title {
                    font-size: 20px;
                    font-weight: 700;
                    color: #334155;
                    margin: 24px 0 14px;
                    padding-left: 12px;
                    border-left: 4px solid #2563eb;
                }
                .desc-list {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .desc-item {
                    background: rgba(241, 245, 249, 0.8);
                    border: 1px solid rgba(148, 163, 184, 0.20);
                    border-radius: 12px;
                    padding: 14px 18px;
                    font-size: 18px;
                    color: #475569;
                    font-weight: 500;
                }
                .footer {
                    margin-top: 24px;
                    padding: 16px 20px;
                    border-radius: 14px;
                    background: linear-gradient(135deg, rgba(37, 99, 235, 0.06), rgba(14, 165, 180, 0.06));
                    border: 1px solid rgba(148, 163, 184, 0.30);
                    font-size: 14px;
                    color: #64748b;
                    text-align: center;
                    font-weight: 500;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <h1>宠物性格详情</h1>
                    <p>编号: NO.${String(nature.id).padStart(3, '0')}</p>
                </div>

                <div class="nature-name">${escapeHTML(nature.name)}</div>

                <div class="effect-row">
                    <div class="effect-card positive">
                        <div class="effect-label">属性加成</div>
                        <div class="effect-value">+${escapeHTML(nature.positiveAttr)}</div>
                        <div class="effect-detail">比例 +${(nature.proportion / 100).toFixed(1)}%</div>
                    </div>
                    <div class="effect-card negative">
                        <div class="effect-label">属性减益</div>
                        <div class="effect-value">-${escapeHTML(nature.negativeAttr)}</div>
                        <div class="effect-detail">比例 -${(nature.proportion / 100).toFixed(1)}%</div>
                    </div>
                </div>

                <div class="section-title">性格描述</div>
                <div class="desc-list">
                    ${descItems}
                </div>

                <div class="footer">成长值加成: +${nature.grow} &nbsp;|&nbsp; 数据来源: NATURE_CONF.json</div>
            </div>
        </body>
        </html>`;

        await page.setViewport({ width: 900, height: 700 });
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        await wait(600);

        const base64Image = await page.screenshot({
            encoding: 'base64',
            fullPage: true,
            omitBackground: false
        });

        console.log(`✅ 性格详情 [${natureName}] 生成成功！`);
        return base64Image;
    } catch (error) {
        console.error(`❌ 生成性格详情 [${natureName}] 失败:`, error);
        throw error;
    } finally {
        await browser.close();
    }
}

export { generateNatureChart, generateSingleNatureChart };
