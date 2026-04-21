// 精灵卡牌渲染脚本
// 功能：根据精灵JSON数据生成精美的卡牌图片

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

// 主函数：生成精灵卡牌
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
        const baseHeight = 1200;
        const totalSkills = spriteData.skills.elfSkills.length + spriteData.skills.bloodlineSkills.length + spriteData.skills.skillStones.length;
        const dynamicHeight = baseHeight + (totalSkills * 20);
        const finalHeight = Math.max(dynamicHeight, 1500);

        // 生成HTML内容
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8" />
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&family=Noto+Serif+SC:wght@400;700&display=swap');
                body {
                    width: 1280px;
                    min-height: ${finalHeight}px;
                    background: ${colorScheme.background};
                    font-family: 'Noto Serif SC', serif;
                    color: ${colorScheme.text};
                    padding: 40px;
                    margin: 0;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                }
                .card-container {
                    width: 1200px;
                    background: rgba(255, 255, 255, 0.08);
                    border-radius: 25px;
                    padding: 40px;
                    backdrop-filter: blur(15px);
                    border: 2px solid rgba(255, 255, 255, 0.2);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid rgba(255,255,255,0.1);
                    padding-bottom: 20px;
                }
                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }
                .name {
                    font-family: 'Orbitron', sans-serif;
                    font-size: 48px;
                    font-weight: 700;
                    color: ${colorScheme.text};
                    text-shadow: 0 0 10px ${colorScheme.accent};
                }
                .attribute {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(255,255,255,0.1);
                    padding: 8px 16px;
                    border-radius: 20px;
                    backdrop-filter: blur(10px);
                }
                .attribute-icon {
                    width: 36px;
                    height: 36px;
                    object-fit: contain;
                }
                .attribute-text {
                    font-family: 'Noto Serif SC', serif;
                    font-size: 24px;
                    font-weight: bold;
                    color: ${colorScheme.text};
                }
                .number {
                    font-size: 24px;
                    opacity: 0.8;
                    font-family: 'Orbitron', sans-serif;
                }
                .middle-section {
                    display: flex;
                    align-items: center;
                    gap: 40px;
                    padding: 20px 0;
                    border-bottom: 1px dashed rgba(255,255,255,0.1);
                }
                .portrait-container {
                    flex-shrink: 0;
                    position: relative;
                }
                .portrait {
                    width: 280px;
                    height: 280px;
                    object-fit: contain;
                    filter: drop-shadow(0 0 20px rgba(0, 210, 255, 0.6));
                    animation: float 3s ease-in-out infinite;
                }
                .info-panel {
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 25px;
                }
                .stats-grid {
                    width: 100%;
                    border-collapse: collapse;
                    font-family: 'Noto Serif SC', serif;
                }
                .stats-grid td {
                    padding: 6px 8px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    text-align: left;
                    font-size: 22px;
                }
                .stats-grid .stat-label {
                    color: ${colorScheme.accent};
                    font-weight: bold;
                    width: 25%;
                    font-size: 24px;
                }
                .stats-grid td.stat-value {
                    font-family: 'Orbitron', sans-serif;
                    color: ${colorScheme.text};
                    font-size: 28px;
                    font-weight: bold;
                }
                .trait-box {
                    background: linear-gradient(90deg, ${colorScheme.border.replace('0.6', '0.1')}, transparent);
                    border-left: 5px solid ${colorScheme.accent};
                    padding: 25px;
                    border-radius: 0 15px 15px 0;
                }
                .trait-title {
                    font-size: 26px;
                    color: ${colorScheme.accent};
                    font-weight: bold;
                    margin-bottom: 12px;
                }
                .trait-desc {
                    font-size: 22px;
                    line-height: 1.6;
                    opacity: 0.9;
                }
                .section {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                .section-title {
                    font-size: 32px;
                    color: ${colorScheme.accent};
                    border-bottom: 2px solid ${colorScheme.accent};
                    padding-bottom: 10px;
                    font-family: 'Orbitron', sans-serif;
                    text-transform: uppercase;
                }
                .category-title {
                    background: ${colorScheme.border.replace('0.6', '0.2')};
                    padding: 8px 15px;
                    border-radius: 8px;
                    font-size: 20px;
                    font-weight: bold;
                    color: ${colorScheme.text};
                    margin-top: 20px;
                }
                .skills-container {
                    display: flex;
                    gap: 30px;
                    width: 100%;
                    margin-top: 10px;
                }
                .skill-column {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    background: rgba(255, 255, 255, 0.05);
                    border: 2px solid ${colorScheme.border};
                    border-radius: 15px;
                    padding: 15px;
                    box-shadow: 0 4px 15px ${colorScheme.border.replace('0.3', '0.2')};
                    transition: all 0.3s ease;
                }
                .skill-column:hover {
                    box-shadow: 0 6px 20px ${colorScheme.border.replace('0.3', '0.4')};
                    border-color: ${colorScheme.border};
                }
                .skills-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 10px;
                    table-layout: fixed;
                }
                .skills-table th {
                    text-align: left;
                    padding: 12px;
                    background: rgba(0,0,0,0.4);
                    color: ${colorScheme.accent};
                    font-size: 18px;
                    border-bottom: 2px solid ${colorScheme.accent};
                }
                .skills-table td {
                    padding: 12px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    font-size: 16px;
                    vertical-align: middle;
                    overflow-wrap: break-word;
                    white-space: normal;
                }
                .skills-table th:nth-child(1),
                .skills-table td:nth-child(1) {
                    width: 18%;
                }
                .skills-table th:nth-child(2),
                .skills-table td:nth-child(2) {
                    width: 17%;
                    text-align: center;
                    white-space: nowrap;
                }
                .skills-table th:nth-child(3),
                .skills-table td:nth-child(3) {
                    width: 15%;
                    text-align: center;
                    white-space: nowrap;
                }
                .skills-table th:nth-child(4),
                .skills-table td:nth-child(4) {
                    width: 15%;
                    text-align: center;
                    white-space: nowrap;
                }
                .skills-table th:nth-child(5),
                .skills-table td:nth-child(5) {
                    width: 35%;
                }
                .skills-table tr:hover td {
                    background: rgba(255,255,255,0.05);
                }
                .skill-type {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: bold;
                    color: white;
                }
                .type-物攻 {
                    background: #ff5722;
                }
                .type-魔攻 {
                    background: #2196f3;
                }
                .type-防御 {
                    background: #4caf50;
                }
                .type-状态 {
                    background: #9c27b0;
                }
                .type-技能石 {
                    background: #795548;
                }
                @keyframes float {
                    0%,
                    100% {
                        transform: translateY(0);
                    }
                    50% {
                        transform: translateY(-15px);
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
                                        <th>类型</th>
                                        <th>威力</th>
                                        <th>能量</th>
                                        <th>描述</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${spriteData.skills.elfSkills.map(skill => {
                                        return `
                                        <tr>
                                            <td>${skill.name}</td>
                                            <td>${skill.type || '-'}</td>
                                            <td>${skill.power || '-'}</td>
                                            <td>${skill.energy || '-'}</td>
                                            <td>${skill.accuracy || '-'}</td>
                                        </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div class="skill-column">
                            <div class="category-title">血脉技能</div>
                            <table class="skills-table">
                                <thead>
                                    <tr>
                                        <th>名称</th>
                                        <th>类型</th>
                                        <th>威力</th>
                                        <th>能量</th>
                                        <th>描述</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${spriteData.skills.bloodlineSkills.map(skill => {
                                        return `
                                        <tr>
                                            <td>${skill.name}</td>
                                            <td>${skill.type || '-'}</td>
                                            <td>${skill.power || '-'}</td>
                                            <td>${skill.energy || '-'}</td>
                                            <td>${skill.accuracy || '-'}</td>
                                        </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                        <div class="skill-column">
                            <div class="category-title">技能石</div>
                            <table class="skills-table">
                                <thead>
                                    <tr>
                                        <th>名称</th>
                                        <th>类型</th>
                                        <th>威力</th>
                                        <th>能量</th>
                                        <th>描述</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${spriteData.skills.skillStones.map(skill => {
                                        return `
                                        <tr>
                                            <td>${skill.name}</td>
                                            <td>${skill.type}</td>
                                            <td>${skill.power || '-'}</td>
                                            <td>${skill.energy || '-'}</td>
                                            <td>${skill.accuracy || '-'}</td>
                                        </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html> `;

        // 设置视口和截图
        await page.setViewport({ width: 1280, height: 0 });
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