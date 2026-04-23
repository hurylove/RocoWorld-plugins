// 单属性克制渲染脚本
// 功能：根据 data/jllb/属性克制表.json 生成指定属性的克制关系图（base64）
// 示例参数：#光系克制 / 光系克制 / 光 / 机械系

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

function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', String.fromCharCode(38) + 'amp;')
        .replaceAll('<', String.fromCharCode(38) + 'lt;')
        .replaceAll('>', String.fromCharCode(38) + 'gt;')
        .replaceAll('"', String.fromCharCode(38) + 'quot;')
        .replaceAll("'", String.fromCharCode(38) + '#39;');
}

function normalizeInputType(raw) {
    const input = String(raw ?? '')
        .trim()
        .replace(/^#/, '')
        .replace(/\s+/g, '')
        .replace(/属性克制|克制关系|克制表|克制|属性|系/g, '');

    return input;
}

function resolveTypeName(rawInput, chartData) {
    const normalized = normalizeInputType(rawInput);
    if (!normalized) return null;

    const names = chartData.types.map((t) => t.name);

    const aliasMap = {
        机: '机械',
        普: '普通'
    };

    const candidate = aliasMap[normalized] || normalized;
    if (names.includes(candidate)) return candidate;

    // 兜底：支持传“机械系克制”这种残留关键词被清理后的部分匹配
    const fuzzy = names.find((name) => name.includes(candidate) || candidate.includes(name));
    return fuzzy || null;
}

function calcDefenderView(selectedType, matchups, allTypes) {
    const strongAgainstMe = [];
    const weakAgainstMe = [];

    for (const attacker of allTypes) {
        const rule = matchups.get(attacker) || { strongAgainst: [], weakAgainst: [] };
        if (rule.strongAgainst.includes(selectedType)) {
            strongAgainstMe.push(attacker);
        } else if (rule.weakAgainst.includes(selectedType)) {
            weakAgainstMe.push(attacker);
        }
    }

    const normalAgainstMe = allTypes.filter((t) => !strongAgainstMe.includes(t) && !weakAgainstMe.includes(t));

    return { strongAgainstMe, weakAgainstMe, normalAgainstMe };
}

function buildTags(list, emptyText) {
    if (!list || list.length === 0) {
        return `<span class="tag tag-empty">${escapeHTML(emptyText)}</span>`;
    }
    return list.map((item) => `<span class="tag">${escapeHTML(item)}</span>`).join('');
}

// 主函数：根据参数生成单属性克制图
async function generateSingleTypeChart(inputKeyword = '#光系克制') {
    const jsonPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'jllb', '属性克制表.json');
    console.log(`📄 正在读取属性克制数据: ${jsonPath}`);

    let chartData;
    try {
        const rawData = fs.readFileSync(jsonPath, 'utf-8');
        chartData = JSON.parse(rawData);
    } catch (error) {
        console.error('❌ 读取或解析 JSON 失败:', error);
        throw error;
    }

    const selectedType = resolveTypeName(inputKeyword, chartData);
    if (!selectedType) {
        throw new Error(`无法识别属性参数: ${inputKeyword}`);
    }

    const typeColorMap = new Map(chartData.types.map((t) => [t.name, t.color || '#64748b']));
    const selectedColor = typeColorMap.get(selectedType) || '#64748b';

    const matchupMap = new Map(chartData.matchups.map((item) => [item.attacker, item]));
    const allTypes = chartData.types.map((t) => t.name);

    const attackerRule = matchupMap.get(selectedType) || { strongAgainst: [], weakAgainst: [] };
    const strongWhenAttack = attackerRule.strongAgainst || [];
    const weakWhenAttack = attackerRule.weakAgainst || [];
    const normalWhenAttack = allTypes.filter((t) => !strongWhenAttack.includes(t) && !weakWhenAttack.includes(t));

    const defenderView = calcDefenderView(selectedType, matchupMap, allTypes);

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
                    --bg1: #f8fbff;
                    --bg2: #eef5ff;
                    --text: #1f2937;
                    --sub: #64748b;
                    --line: rgba(148, 163, 184, 0.24);
                    --strong: #16a34a;
                    --weak: #dc2626;
                    --normal: #64748b;
                    --type: ${selectedColor};
                }

                * { box-sizing: border-box; }

                body {
                    margin: 0;
                    width: 1200px;
                    min-height: 900px;
                    padding: 38px;
                    color: var(--text);
                    font-family: 'Noto Sans SC', sans-serif;
                    background:
                        radial-gradient(circle at 82% 10%, color-mix(in srgb, var(--type) 22%, transparent), transparent 34%),
                        radial-gradient(circle at 10% 88%, rgba(56, 189, 248, 0.14), transparent 32%),
                        linear-gradient(150deg, var(--bg1), var(--bg2));
                }

                .card {
                    border-radius: 22px;
                    border: 1px solid var(--line);
                    background: rgba(255, 255, 255, 0.94);
                    backdrop-filter: blur(6px);
                    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.10);
                    padding: 26px;
                }

                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: end;
                    margin-bottom: 20px;
                }

                .title h1 {
                    margin: 0;
                    font-family: 'Orbitron', sans-serif;
                    font-size: 38px;
                    letter-spacing: 0.6px;
                    line-height: 1.1;
                    background: linear-gradient(90deg, #0f172a, color-mix(in srgb, var(--type) 75%, #2563eb));
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .title p {
                    margin: 8px 0 0;
                    color: var(--sub);
                    font-size: 15px;
                }

                .pill {
                    border: 1px solid var(--line);
                    background: rgba(255, 255, 255, 0.9);
                    padding: 10px 14px;
                    border-radius: 999px;
                    color: #334155;
                    font-size: 14px;
                    font-weight: 700;
                }

                .grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }

                .panel {
                    border: 1px solid var(--line);
                    border-radius: 14px;
                    background: rgba(255, 255, 255, 0.84);
                    padding: 14px;
                }

                .panel h3 {
                    margin: 0 0 12px;
                    font-size: 18px;
                    color: #0f172a;
                }

                .sub-panel {
                    border: 1px dashed rgba(148, 163, 184, 0.35);
                    border-radius: 12px;
                    padding: 10px;
                    margin-top: 10px;
                    background: rgba(255, 255, 255, 0.7);
                }

                .sub-panel:first-of-type { margin-top: 0; }

                .sub-title {
                    margin: 0 0 8px;
                    font-size: 14px;
                    color: var(--sub);
                    font-weight: 700;
                }

                .tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .tag {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 10px;
                    border-radius: 999px;
                    font-size: 13px;
                    color: #334155;
                    border: 1px solid rgba(148, 163, 184, 0.38);
                    background: rgba(241, 245, 249, 0.95);
                }

                .tag-empty {
                    color: #94a3b8;
                    border-style: dashed;
                }

                .sub-panel.strong .sub-title { color: #166534; }
                .sub-panel.strong .tag { background: rgba(220, 252, 231, 0.95); border-color: rgba(34, 197, 94, 0.42); }

                .sub-panel.weak .sub-title { color: #991b1b; }
                .sub-panel.weak .tag { background: rgba(254, 226, 226, 0.95); border-color: rgba(248, 113, 113, 0.42); }

                .sub-panel.normal .sub-title { color: #475569; }

                .tips {
                    margin-top: 14px;
                    color: var(--sub);
                    font-size: 12px;
                    text-align: right;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="header">
                    <div class="title">
                        <h1>${escapeHTML(selectedType)}系克制图</h1>
                        <p>输入参数：${escapeHTML(inputKeyword)} ｜ 数据版本：${escapeHTML(chartData.version || '1.0.0')}</p>
                    </div>
                    <div class="pill">类型色：${escapeHTML(selectedType)}</div>
                </div>

                <div class="grid">
                    <section class="panel">
                        <h3>⚔️ ${escapeHTML(selectedType)}作攻方（你使用${escapeHTML(selectedType)}技能）</h3>

                        <div class="sub-panel strong">
                            <p class="sub-title">造成优势伤害（克制）</p>
                            <div class="tags">
                                ${buildTags(strongWhenAttack, '无')}
                            </div>
                        </div>

                        <div class="sub-panel weak">
                            <p class="sub-title">伤害受限（被克制 / 抵抗）</p>
                            <div class="tags">
                                ${buildTags(weakWhenAttack, '无')}
                            </div>
                        </div>

                        <div class="sub-panel normal">
                            <p class="sub-title">通常伤害</p>
                            <div class="tags">
                                ${buildTags(normalWhenAttack, '无')}
                            </div>
                        </div>
                    </section>

                    <section class="panel">
                        <h3>🛡️ ${escapeHTML(selectedType)}作防方（对手攻击你）</h3>

                        <div class="sub-panel strong">
                            <p class="sub-title">对你优势（克制你）</p>
                            <div class="tags">
                                ${buildTags(defenderView.strongAgainstMe, '无')}
                            </div>
                        </div>

                        <div class="sub-panel weak">
                            <p class="sub-title">对你劣势（被你克制 / 你抗性强）</p>
                            <div class="tags">
                                ${buildTags(defenderView.weakAgainstMe, '无')}
                            </div>
                        </div>

                        <div class="sub-panel normal">
                            <p class="sub-title">对你通常伤害</p>
                            <div class="tags">
                                ${buildTags(defenderView.normalAgainstMe, '无')}
                            </div>
                        </div>
                    </section>
                </div>

                <div class="tips">提示：支持“#光系克制 / 光系克制 / 光 / 机械系”等参数格式。</div>
            </div>
        </body>
        </html>
        `;

        await page.setViewport({ width: 1200, height: 900 });
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        await wait(900);

        const base64Image = await page.screenshot({
            encoding: 'base64',
            fullPage: true,
            omitBackground: false
        });

        console.log(`✅ 单属性克制图生成成功：${selectedType}`);
        return base64Image;
    } catch (error) {
        console.error('❌ 渲染失败:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

export default generateSingleTypeChart;

// 允许命令行直接调用：node apps/mode/generateSingleTypeChart.js "#光系克制"
if (import.meta.url === `file://${process.argv[1]}`) {
    const keyword = process.argv[2] || '#光系克制';

    generateSingleTypeChart(keyword)
        .then((base64Image) => {
            console.log(`🎉 任务完成，已生成 base64 图片，长度：${base64Image.length}`);
        })
        .catch((error) => {
            console.error('❌ 执行失败:', error);
            process.exit(1);
        });
}
