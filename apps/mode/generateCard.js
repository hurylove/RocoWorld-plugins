// 精灵卡牌渲染脚本
// 功能：根据宠物JSON数据生成宠物解析卡

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 使用process.cwd()作为项目根目录的基准
const projectRoot = process.cwd();

// 简单的YAML解析函数
function parseYAML(yamlContent) {
    const config = {};
    const lines = yamlContent.split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();
        // 跳过注释和空行
        if (trimmedLine.startsWith('#') || trimmedLine === '') {
            continue;
        }

        // 解析键值对
        const colonIndex = trimmedLine.indexOf(':');
        if (colonIndex > 0) {
            const key = trimmedLine.substring(0, colonIndex).trim();
            let value = trimmedLine.substring(colonIndex + 1).trim();

            // 处理引号
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
        const configPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'config', 'config.yaml');
        const configData = fs.readFileSync(configPath, 'utf-8');
        return parseYAML(configData);
    } catch (error) {
        console.warn('读取配置文件失败，使用默认配置:', error.message);
        return {};
    }
}

const config = loadConfig();

// 等待函数
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 主函数：生成解析卡
async function generateCard(spriteName) {
    // 构建JSON文件路径
    const jsonPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'jltj', `${spriteName}.json`);
    console.log(`📄 正在读取精灵数据: ${spriteName}`);
    let spriteData;

    try {
        const rawData = fs.readFileSync(jsonPath, 'utf-8');
        spriteData = JSON.parse(rawData);
    } catch (error) {
        console.error('❌ 读取或解析 JSON 失败:', error);
        throw error;
    }

    // 属性颜色映射表
    const attributeColors = {
        '普通': {
            background: 'linear-gradient(135deg, #9e9e9e, #616161)',
            border: 'rgba(158, 158, 158, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '草': {
            background: 'linear-gradient(135deg, #4caf50, #2e7d32)',
            border: 'rgba(76, 175, 80, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '火': {
            background: 'linear-gradient(135deg, #ff5722, #c62828)',
            border: 'rgba(255, 87, 34, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '水': {
            background: 'linear-gradient(135deg, #2196f3, #1565c0)',
            border: 'rgba(33, 150, 243, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '光': {
            background: 'linear-gradient(135deg, #1e88e5, #0d47a1)',
            border: 'rgba(30, 136, 229, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '地': {
            background: 'linear-gradient(135deg, #795548, #4e342e)',
            border: 'rgba(121, 85, 72, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '冰': {
            background: 'linear-gradient(135deg, #00bcd4, #00838f)',
            border: 'rgba(0, 188, 212, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '龙': {
            background: 'linear-gradient(135deg, #9c27b0, #4a148c)',
            border: 'rgba(156, 39, 176, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '电': {
            background: 'linear-gradient(135deg, #ffc107, #ef6c00)',
            border: 'rgba(255, 193, 7, 0.6)',
            text: '#000000',
            accent: '#000000'
        },
        '毒': {
            background: 'linear-gradient(135deg, #9c27b0, #4a148c)',
            border: 'rgba(156, 39, 176, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '虫': {
            background: 'linear-gradient(135deg, #8bc34a, #33691e)',
            border: 'rgba(139, 195, 74, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '武': {
            background: 'linear-gradient(135deg, #ff9800, #e65100)',
            border: 'rgba(255, 152, 0, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '翼': {
            background: 'linear-gradient(135deg, #2196f3, #0d47a1)',
            border: 'rgba(33, 150, 243, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '萌': {
            background: 'linear-gradient(135deg, #e91e63, #880e4f)',
            border: 'rgba(233, 30, 99, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '幽': {
            background: 'linear-gradient(135deg, #673ab7, #311b92)',
            border: 'rgba(103, 58, 183, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '恶': {
            background: 'linear-gradient(135deg, #424242, #212121)',
            border: 'rgba(66, 66, 66, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '机械': {
            background: 'linear-gradient(135deg, #607d8b, #37474f)',
            border: 'rgba(96, 125, 139, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        },
        '幻': {
            background: 'linear-gradient(135deg, #00bcd4, #006064)',
            border: 'rgba(0, 188, 212, 0.6)',
            text: '#ffffff',
            accent: '#ffffff'
        }
    };

    // 获取精灵属性对应的颜色方案
    const getAttributeColor = (attribute) => {
        return attributeColors[attribute] || attributeColors['普通'];
    };

    // 确定精灵的主属性
    const primaryAttribute = spriteData.attribute && spriteData.attribute.length > 0 ? spriteData.attribute[0] : '普通';
    const colorScheme = getAttributeColor(primaryAttribute);

    const fallbackAttrText = spriteData.attribute && spriteData.attribute.length > 0 ? spriteData.attribute.join('/') : '普通';
    const fallbackAttrIcon = spriteData.attributeIcon || '';

    // 技能行渲染
    const renderSkillAttr = (skill) => {
        const attrText = skill?.attr || fallbackAttrText || '-';
        const attrIcon = skill?.attrIcon || fallbackAttrIcon || '';
        return `
            <div class="skill-attr-badge">
                ${attrIcon ? `<img src="${attrIcon}" alt="${attrText}" class="skill-attr-icon" />` : ''}
                <span>${attrText}</span>
            </div>
        `;
    };

    const renderSkillName = (skill) => {
        return `
            <div class="skill-name-wrap">
                ${skill?.icon ? `<img src="${skill.icon}" alt="${skill.name || 'skill'}" class="skill-icon" />` : ''}
                <span class="skill-name-text">${skill?.name || '-'}</span>
            </div>
        `;
    };

    const renderSkillRow = (skill) => {
        return `
            <tr>
                <td>${renderSkillName(skill)}</td>
                <td>${renderSkillAttr(skill)}</td>
                <td><span class="skill-type type-${skill?.type || '状态'}">${skill?.type || '-'}</span></td>
                <td>${skill?.power || '-'}</td>
                <td>${skill?.energy || '-'}</td>
                <td>${skill?.accuracy || '-'}</td>
            </tr>
        `;
    };

    // 构建puppeteer启动选项
    const launchOptions = {
        headless: 'new',
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    };

    // 如果配置了Chromium路径，则使用配置的路径
    if (config.chromiumPath) {
        console.log(`使用配置的Chrome路径: ${config.chromiumPath}`);
        launchOptions.executablePath = config.chromiumPath;
    } else {
        console.log('使用默认Chrome路径');
    }

    const browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();

    try {
        // 计算动态高度
        const baseHeight = 1600;
        const totalSkills = spriteData.skills.elfSkills.length + spriteData.skills.bloodlineSkills.length + spriteData.skills.skillStones.length;
        const dynamicHeight = baseHeight + (totalSkills * 28);
        const finalHeight = Math.max(dynamicHeight, 2100);

        // 生成HTML内容
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8" />
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Noto+Serif+SC:wght@400;700&display=swap');
                * {
                    box-sizing: border-box;
                }
                body {
                    width: 1480px;
                    min-height: ${finalHeight}px;
                    background:
                        radial-gradient(circle at 12% 18%, ${colorScheme.border.replace('0.6', '0.16')}, transparent 30%),
                        radial-gradient(circle at 88% 80%, ${colorScheme.border.replace('0.6', '0.14')}, transparent 34%),
                        linear-gradient(145deg, #f8fbff 0%, #eef4ff 52%, #f7fafc 100%);
                    font-family: 'Noto Serif SC', serif;
                    color: #334155;
                    padding: 34px;
                    margin: 0;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                }
                .card-container {
                    width: 1420px;
                    background: linear-gradient(165deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.9));
                    border-radius: 26px;
                    padding: 34px;
                    border: 1px solid rgba(148, 163, 184, 0.35);
                    box-shadow: 0 20px 45px rgba(30, 41, 59, 0.12);
                    display: flex;
                    flex-direction: column;
                    gap: 26px;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.35);
                    padding-bottom: 18px;
                }
                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 18px;
                }
                .name {
                    font-family: 'Orbitron', sans-serif;
                    font-size: 48px;
                    font-weight: 700;
                    letter-spacing: 1px;
                    color: #0f172a;
                    text-shadow: 0 3px 16px ${colorScheme.border.replace('0.6', '0.35')};
                }
                .attribute {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(255,255,255,0.9);
                    padding: 8px 16px;
                    border-radius: 999px;
                    border: 1px solid ${colorScheme.border.replace('0.6', '0.45')};
                    color: #1e293b;
                }
                .attribute-icon {
                    width: 32px;
                    height: 32px;
                    object-fit: contain;
                }
                .attribute-text {
                    font-size: 21px;
                    font-weight: bold;
                    color: #1e293b;
                }
                .number {
                    font-size: 24px;
                    font-family: 'Orbitron', sans-serif;
                    color: #334155;
                    background: #f8fafc;
                    border: 1px solid rgba(148, 163, 184, 0.45);
                    padding: 8px 16px;
                    border-radius: 999px;
                }
                .middle-section {
                    display: flex;
                    align-items: center;
                    gap: 34px;
                    padding: 4px 0 18px 0;
                    border-bottom: 1px dashed rgba(148, 163, 184, 0.45);
                }
                .portrait-container {
                    flex-shrink: 0;
                    position: relative;
                    width: 300px;
                    height: 300px;
                    border-radius: 18px;
                    background: linear-gradient(160deg, #ffffff, #f1f5f9);
                    border: 1px solid rgba(148, 163, 184, 0.38);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }
                .portrait {
                    width: 282px;
                    height: 282px;
                    object-fit: contain;
                    filter: drop-shadow(0 0 18px ${colorScheme.border.replace('0.6', '0.5')});
                    animation: float 3.1s ease-in-out infinite;
                }
                .info-panel {
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }
                .stats-grid {
                    width: 100%;
                    border-collapse: collapse;
                    background: rgba(255, 255, 255, 0.92);
                    border: 1px solid rgba(148, 163, 184, 0.3);
                    border-radius: 14px;
                    overflow: hidden;
                }
                .stats-grid td {
                    padding: 11px 10px;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
                    text-align: left;
                    font-size: 22px;
                }
                .stats-grid tr:last-child td {
                    border-bottom: none;
                }
                .stats-grid .stat-label {
                    color: #475569;
                    font-weight: bold;
                    width: 25%;
                    font-size: 21px;
                }
                .stats-grid td.stat-value {
                    font-family: 'Orbitron', sans-serif;
                    color: #0f172a;
                    font-size: 28px;
                    font-weight: bold;
                }
                .trait-box {
                    background: linear-gradient(100deg, ${colorScheme.border.replace('0.6', '0.18')}, rgba(255,255,255,0.8));
                    border: 1px solid ${colorScheme.border.replace('0.6', '0.45')};
                    border-left: 5px solid ${colorScheme.border.replace('0.6', '0.85')};
                    padding: 18px 20px;
                    border-radius: 14px;
                    color: #1e293b;
                }
                .trait-title {
                    font-size: 24px;
                    color: #0f172a;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                .trait-desc {
                    font-size: 20px;
                    line-height: 1.62;
                    opacity: 0.96;
                }
                .section {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .section-title {
                    font-size: 31px;
                    color: #0f172a;
                    border-bottom: 2px solid ${colorScheme.border.replace('0.6', '0.75')};
                    padding-bottom: 8px;
                    font-family: 'Orbitron', sans-serif;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .skills-container {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    width: 100%;
                    margin-top: 6px;
                }
                .skill-column {
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    background: linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.95));
                    border: 1px solid ${colorScheme.border.replace('0.6', '0.45')};
                    border-radius: 14px;
                    padding: 12px;
                    box-shadow: 0 8px 20px rgba(30, 41, 59, 0.08);
                }
                .category-title {
                    background: linear-gradient(90deg, ${colorScheme.border.replace('0.6', '0.28')}, rgba(255, 255, 255, 0.85));
                    padding: 8px 12px;
                    border-radius: 10px;
                    font-size: 18px;
                    font-weight: bold;
                    color: #1e293b;
                    margin-bottom: 10px;
                    border: 1px solid rgba(148, 163, 184, 0.35);
                }
                .skills-table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                    border-radius: 10px;
                    overflow: hidden;
                }
                .skills-table th {
                    text-align: left;
                    padding: 10px 9px;
                    background: #eef2ff;
                    color: #334155;
                    font-size: 15px;
                    border-bottom: 1px solid rgba(148, 163, 184, 0.35);
                    font-weight: 700;
                }
                .skills-table td {
                    padding: 10px 9px;
                    border-bottom: 1px solid rgba(203, 213, 225, 0.75);
                    font-size: 15px;
                    color: #334155;
                    vertical-align: middle;
                    overflow-wrap: break-word;
                    white-space: normal;
                }
                .skills-table tbody tr:last-child td {
                    border-bottom: none;
                }
                .skills-table th:nth-child(1), .skills-table td:nth-child(1) {
                    width: 16%;
                }
                .skills-table th:nth-child(2), .skills-table td:nth-child(2) {
                    width: 12%;
                    text-align: center;
                }
                .skills-table th:nth-child(3), .skills-table td:nth-child(3) {
                    width: 10%;
                    text-align: center;
                }
                .skills-table th:nth-child(4), .skills-table td:nth-child(4) {
                    width: 8%;
                    text-align: center;
                    white-space: nowrap;
                }
                .skills-table th:nth-child(5), .skills-table td:nth-child(5) {
                    width: 8%;
                    text-align: center;
                    white-space: nowrap;
                }
                .skills-table th:nth-child(6), .skills-table td:nth-child(6) {
                    width: 46%;
                }
                .skills-table tr:hover td {
                    background: rgba(219, 234, 254, 0.35);
                }
                .skill-name-wrap {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .skill-icon {
                    width: 23px;
                    height: 23px;
                    border-radius: 6px;
                    object-fit: cover;
                    border: 1px solid rgba(148, 163, 184, 0.4);
                    flex-shrink: 0;
                }
                .skill-name-text {
                    font-weight: 600;
                    color: #1e293b;
                }
                .skill-attr-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    background: rgba(248, 250, 252, 1);
                    border: 1px solid rgba(148, 163, 184, 0.55);
                    border-radius: 999px;
                    padding: 4px 8px;
                    min-width: 72px;
                    color: #334155;
                    font-weight: 600;
                }
                .skill-attr-icon {
                    width: 16px;
                    height: 16px;
                    object-fit: contain;
                    flex-shrink: 0;
                }
                .skill-type {
                    display: inline-block;
                    padding: 4px 8px;
                    border-radius: 999px;
                    font-size: 12px;
                    font-weight: bold;
                    color: white;
                    min-width: 46px;
                    text-align: center;
                }
                .type-物攻 {
                    background: linear-gradient(135deg, #ff7043, #e53935);
                }
                .type-魔攻 {
                    background: linear-gradient(135deg, #42a5f5, #1e88e5);
                }
                .type-防御 {
                    background: linear-gradient(135deg, #66bb6a, #43a047);
                }
                .type-状态 {
                    background: linear-gradient(135deg, #ab47bc, #8e24aa);
                }
                .type-技能石 {
                    background: linear-gradient(135deg, #8d6e63, #6d4c41);
                }
                @keyframes float {
                    0%, 100% {
                        transform: translateY(0);
                    }
                    50% {
                        transform: translateY(-12px);
                    }
                }
            </style>
        </head>
        <body>
            <div class="card-container">
                <div class="header">
                    <div class="header-left">
                        <div class="name">${spriteData.name}</div>
                        <div class="attribute">
                            ${spriteData.attributeIcon ? `<img src="${spriteData.attributeIcon}" alt="attribute" class="attribute-icon" />` : ''}
                            <span class="attribute-text">${spriteData.attribute && spriteData.attribute.length > 0 ? spriteData.attribute.join(' ') : '普通'}</span>
                        </div>
                    </div>
                    <div class="number">NO.${spriteData.number}</div>
                </div>
                <div class="middle-section">
                    <div class="portrait-container">
                        <img src="${spriteData.portrait}" alt="Portrait" class="portrait" />
                    </div>
                    <div class="info-panel">
                        <table class="stats-grid">
                            <tr>
                                <td class="stat-label">物攻</td>
                                <td class="stat-value">${spriteData.stats.物攻}</td>
                                <td class="stat-label">魔攻</td>
                                <td class="stat-value">${spriteData.stats.魔攻}</td>
                                <td class="stat-label">生命</td>
                                <td class="stat-value">${spriteData.stats.生命}</td>
                            </tr>
                            <tr>
                                <td class="stat-label">物防</td>
                                <td class="stat-value">${spriteData.stats.物防}</td>
                                <td class="stat-label">魔防</td>
                                <td class="stat-value">${spriteData.stats.魔防}</td>
                                <td class="stat-label">速度</td>
                                <td class="stat-value">${spriteData.stats.速度}</td>
                            </tr>
                        </table>

                        ${spriteData.traits && spriteData.traits.length > 0 ? `
                        <div class="trait-box">
                            <div class="trait-title">✨ ${spriteData.traits[0].name}</div>
                            <div class="trait-desc">${spriteData.traits[0].description}</div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">⚔️ 技能列表</div>
                    <div class="skills-container">
                        <div class="skill-column">
                            <div class="category-title">精灵技能</div>
                            <table class="skills-table">
                                <thead>
                                    <tr>
                                        <th>名称</th>
                                        <th>属性</th>
                                        <th>类型</th>
                                        <th>威力</th>
                                        <th>能量</th>
                                        <th>描述</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${spriteData.skills.elfSkills.map(skill => renderSkillRow(skill)).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div class="skill-column">
                            <div class="category-title">血脉技能</div>
                            <table class="skills-table">
                                <thead>
                                    <tr>
                                        <th>名称</th>
                                        <th>属性</th>
                                        <th>类型</th>
                                        <th>威力</th>
                                        <th>能量</th>
                                        <th>描述</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${spriteData.skills.bloodlineSkills.map(skill => renderSkillRow(skill)).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div class="skill-column">
                            <div class="category-title">技能石</div>
                            <table class="skills-table">
                                <thead>
                                    <tr>
                                        <th>名称</th>
                                        <th>属性</th>
                                        <th>类型</th>
                                        <th>威力</th>
                                        <th>能量</th>
                                        <th>描述</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${spriteData.skills.skillStones.map(skill => renderSkillRow(skill)).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html> `;

        // 设置视口和截图
        await page.setViewport({ width: 1480, height: 0 });
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        await wait(1000);

        // 生成base64格式的图片
        const base64Image = await page.screenshot({ encoding: 'base64', fullPage: true, omitBackground: false });
        console.log(`✅ 图片生成成功！`);

        // 返回base64格式的图片
        return base64Image;

    } catch (error) {
        console.error('❌ 渲染失败:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// 导出函数，供其他模块调用
export default generateCard;

// 如果直接运行此文件，则从命令行参数获取精灵名称
if (import.meta.url === `file://${process.argv[1]}`) {
    const spriteName = process.argv[2];
    if (!spriteName) {
        console.error('❌ 请提供精灵名称作为参数，例如：node generateCard.js 迪莫');
        process.exit(1);
    }

    generateCard(spriteName)
        .then(imagePath => {
            console.log(`🎉 任务完成！生成的图片路径：${imagePath}`);
        })
        .catch(error => {
            console.error('❌ 执行失败:', error);
            process.exit(1);
        });
}
