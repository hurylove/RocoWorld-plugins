// 属性克制表渲染脚本
// 功能：根据 data/jllb/属性克制表.json 生成美化版属性克制图（base64）

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 使用 process.cwd() 作为项目根目录
const projectRoot = process.cwd();

// 简单 YAML 解析（与现有脚本风格保持一致）
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
        console.warn('读取配置文件失败，使用默认配置:', error.message);
        return {};
    }
}

const config = loadConfig();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildMatrix(chartData) {
    const typeNames = chartData.types.map((t) => t.name);
    const matchupMap = new Map(chartData.matchups.map((item) => [item.attacker, item]));

    const matrix = typeNames.map((attacker) => {
        const rule = matchupMap.get(attacker) || { strongAgainst: [], weakAgainst: [] };

        return typeNames.map((defender) => {
            if (rule.strongAgainst.includes(defender)) return 'strong';
            if (rule.weakAgainst.includes(defender)) return 'weak';
            return 'normal';
        });
    });

    return { typeNames, matrix };
}

function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', String.fromCharCode(38) + 'amp;')
        .replaceAll('<', String.fromCharCode(38) + 'lt;')
        .replaceAll('>', String.fromCharCode(38) + 'gt;')
        .replaceAll('"', String.fromCharCode(38) + 'quot;')
        .replaceAll("'", String.fromCharCode(38) + '#39;');
}

// 主函数：生成属性克制图
async function generateTypeChart(chartName = '属性克制表') {
    const jsonPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'jllb', `${chartName}.json`);
    console.log(`📄 正在读取属性克制数据: ${chartName}`);

    let chartData;
    try {
        const rawData = fs.readFileSync(jsonPath, 'utf-8');
        chartData = JSON.parse(rawData);
    } catch (error) {
        console.error('❌ 读取或解析 JSON 失败:', error);
        throw error;
    }

    const { typeNames, matrix } = buildMatrix(chartData);
    const typeColorMap = new Map(chartData.types.map((t) => [t.name, t.color || '#BDBDBD']));
    const totalTypes = typeNames.length;
    const tableMinWidth = Math.max(1080, 180 + totalTypes * 56);
    const dynamicWidth = tableMinWidth + 120;
    const dynamicHeight = Math.max(900, 260 + totalTypes * 54);

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
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');

                :root {
                    --bg-1: #0f172a;
                    --bg-2: #1e293b;
                    --panel: rgba(15, 23, 42, 0.78);
                    --line: rgba(148, 163, 184, 0.22);
                    --text-main: #e2e8f0;
                    --text-sub: #94a3b8;
                    --strong: #22c55e;
                    --weak: #ef4444;
                    --normal: #64748b;
                }

                * {
                    box-sizing: border-box;
                }

                body {
                    margin: 0;
                    width: ${dynamicWidth}px;
                    min-height: ${dynamicHeight}px;
                    padding: 40px;
                    color: var(--text-main);
                    font-family: 'Noto Sans SC', sans-serif;
                    background:
                        radial-gradient(circle at 10% 20%, rgba(59, 130, 246, 0.25), transparent 35%),
                        radial-gradient(circle at 90% 10%, rgba(16, 185, 129, 0.18), transparent 32%),
                        radial-gradient(circle at 85% 88%, rgba(236, 72, 153, 0.18), transparent 34%),
                        linear-gradient(145deg, var(--bg-1), var(--bg-2));
                }

                .container {
                    width: 100%;
                    background: var(--panel);
                    border: 1px solid rgba(148, 163, 184, 0.25);
                    border-radius: 28px;
                    box-shadow: 0 18px 45px rgba(2, 6, 23, 0.45);
                    padding: 30px 30px 24px;
                    backdrop-filter: blur(12px);
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    gap: 16px;
                    margin-bottom: 20px;
                }

                .title-wrap h1 {
                    margin: 0;
                    font-family: 'Orbitron', sans-serif;
                    font-size: 42px;
                    letter-spacing: 1px;
                    line-height: 1.15;
                    background: linear-gradient(90deg, #e2e8f0, #93c5fd, #86efac);
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
                    line-height: 1.5;
                }

                .legend {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 18px;
                    flex-wrap: wrap;
                }

                .legend-item {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 10px;
                    border-radius: 999px;
                    border: 1px solid var(--line);
                    background: rgba(15, 23, 42, 0.5);
                    font-size: 13px;
                    color: var(--text-main);
                }

                .dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                }

                .dot.strong { background: var(--strong); }
                .dot.weak { background: var(--weak); }
                .dot.normal { background: var(--normal); }

                .table-wrap {
                    overflow: hidden;
                    border-radius: 18px;
                    border: 1px solid var(--line);
                    background: rgba(2, 6, 23, 0.35);
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                }

                th, td {
                    border: 1px solid rgba(148, 163, 184, 0.12);
                    text-align: center;
                    vertical-align: middle;
                    height: 52px;
                    font-size: 14px;
                    position: relative;
                }

                th.corner {
                    width: 168px;
                    background: linear-gradient(140deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
                    color: #cbd5e1;
                    font-size: 12px;
                    letter-spacing: 0.5px;
                    line-height: 1.7;
                }

                th.type-col, th.type-row {
                    font-size: 13px;
                    font-weight: 700;
                    color: #f8fafc;
                    text-shadow: 0 1px 2px rgba(15, 23, 42, 0.6);
                }

                th.type-row {
                    width: 168px;
                    text-align: left;
                    padding: 0 12px;
                }

                .type-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    border-radius: 999px;
                    border: 1px solid rgba(255, 255, 255, 0.32);
                    padding: 4px 10px;
                    font-size: 12px;
                    background: rgba(15, 23, 42, 0.35);
                    max-width: 100%;
                }

                .type-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    flex-shrink: 0;
                    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
                }

                td.cell-strong {
                    background: rgba(34, 197, 94, 0.2);
                }

                td.cell-weak {
                    background: rgba(239, 68, 68, 0.18);
                }

                td.cell-normal {
                    background: rgba(100, 116, 139, 0.12);
                }

                .badge {
                    display: inline-flex;
                    width: 30px;
                    height: 30px;
                    border-radius: 10px;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    font-weight: 700;
                    line-height: 1;
                    user-select: none;
                }

                .badge.strong {
                    color: #14532d;
                    background: linear-gradient(160deg, #86efac, #22c55e);
                    box-shadow: 0 6px 12px rgba(34, 197, 94, 0.4);
                }

                .badge.weak {
                    color: #7f1d1d;
                    background: linear-gradient(160deg, #fca5a5, #ef4444);
                    box-shadow: 0 6px 12px rgba(239, 68, 68, 0.36);
                }

                .badge.normal {
                    color: #cbd5e1;
                    background: rgba(100, 116, 139, 0.25);
                }

                .footer {
                    margin-top: 14px;
                    text-align: right;
                    color: var(--text-sub);
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="title-wrap">
                        <h1>${escapeHTML(chartData.title || '属性克制表')}</h1>
                        <p>${escapeHTML(chartData.subtitle || '作攻方 × 作防方')}</p>
                    </div>
                    <div class="meta">
                        <div>类型数量：${totalTypes}</div>
                        <div>版本：${escapeHTML(chartData.version || '1.0.0')}</div>
                    </div>
                </div>

                <div class="legend">
                    <div class="legend-item"><span class="dot strong"></span>${escapeHTML(chartData.legend?.up || '↑ 克制')}</div>
                    <div class="legend-item"><span class="dot weak"></span>${escapeHTML(chartData.legend?.down || '↓ 被克制/无效')}</div>
                    <div class="legend-item"><span class="dot normal"></span>${escapeHTML(chartData.legend?.empty || '· 正常')}</div>
                </div>

                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th class="corner">作攻方<br/>作防方 →</th>
                                ${typeNames
                                    .map((name) => {
                                        const color = typeColorMap.get(name) || '#BDBDBD';
                                        return `
                                            <th class="type-col" style="background: linear-gradient(160deg, ${color}, #0f172a);">
                                                <span class="type-chip">
                                                    <span class="type-dot" style="background:${color};"></span>
                                                    ${escapeHTML(name)}
                                                </span>
                                            </th>
                                        `;
                                    })
                                    .join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${typeNames
                                .map((attacker, rowIndex) => {
                                    const rowColor = typeColorMap.get(attacker) || '#BDBDBD';
                                    const cells = matrix[rowIndex]
                                        .map((state) => {
                                            if (state === 'strong') {
                                                return '<td class="cell-strong"><span class="badge strong">↑</span></td>';
                                            }
                                            if (state === 'weak') {
                                                return '<td class="cell-weak"><span class="badge weak">↓</span></td>';
                                            }
                                            return '<td class="cell-normal"><span class="badge normal">·</span></td>';
                                        })
                                        .join('');

                                    return `
                                        <tr>
                                            <th class="type-row" style="background: linear-gradient(160deg, ${rowColor}, #0f172a);">
                                                <span class="type-chip">
                                                    <span class="type-dot" style="background:${rowColor};"></span>
                                                    ${escapeHTML(attacker)}
                                                </span>
                                            </th>
                                            ${cells}
                                        </tr>
                                    `;
                                })
                                .join('')}
                        </tbody>
                    </table>
                </div>

                <div class="footer">${escapeHTML(chartData.description || '')}</div>
            </div>
        </body>
        </html>
        `;

        await page.setViewport({ width: dynamicWidth, height: dynamicHeight });
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        await wait(900);

        const base64Image = await page.screenshot({
            encoding: 'base64',
            fullPage: true,
            omitBackground: false
        });

        console.log('✅ 属性克制图生成成功！');
        return base64Image;
    } catch (error) {
        console.error('❌ 属性克制图渲染失败:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

export default generateTypeChart;

// 允许命令行直接调用：node apps/mode/generateTypeChart.js 属性克制表
if (import.meta.url === `file://${process.argv[1]}`) {
    const chartName = process.argv[2] || '属性克制表';

    generateTypeChart(chartName)
        .then((base64Image) => {
            console.log(`🎉 任务完成，已生成 base64 图片，长度：${base64Image.length}`);
        })
        .catch((error) => {
            console.error('❌ 执行失败:', error);
            process.exit(1);
        });
}
