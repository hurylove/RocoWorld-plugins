// 宠物资料卡渲染脚本
// 功能：根据宠物JSON数据生成宠物资料卡（不含技能部分）
// 数据来源：data/pets/{id}.json, data/other/Pets.json, data/friends/JL_{pinyin}.webp

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

// 获取图鉴编号（使用 species.id 直接格式化）
function getPetNumber(speciesId) {
    if (speciesId != null && speciesId > 0 && speciesId < 10000) {
        return `NO.${String(speciesId).padStart(3, '0')}`;
    }
    return '--';
}

// 主函数：生成资料卡
async function generatePetCard(petName, petId) {
    // 构建JSON文件路径 - 从 data/pets/{id}.json 读取
    const jsonPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'pets', `${petId}.json`);
    console.log(`📄 正在读取宠物数据: ${petName} (ID: ${petId})`);
    let petData;
    
    try {
        const rawData = fs.readFileSync(jsonPath, 'utf-8');
        petData = JSON.parse(rawData);
    } catch (error) {
        console.error('❌ 读取或解析 JSON 失败:', error);
        throw error;
    }

    // 提取中文名
    const zhName = petData.localized?.zh?.name || petName;

    // 提取属性
    const attributes = [];
    if (petData.main_type?.localized?.zh) {
        attributes.push(petData.main_type.localized.zh);
    }
    if (petData.sub_type?.localized?.zh) {
        attributes.push(petData.sub_type.localized.zh);
    }
    if (attributes.length === 0) {
        attributes.push('普通');
    }

    // 提取图鉴编号（使用 species.id 直接格式化）
    const speciesId = petData.species?.id;
    const number = getPetNumber(speciesId);

    // 提取基础能力值
    const stats = {
        '生命': petData.base_hp ?? '--',
        '物攻': petData.base_phy_atk ?? '--',
        '魔攻': petData.base_mag_atk ?? '--',
        '物防': petData.base_phy_def ?? '--',
        '魔防': petData.base_mag_def ?? '--',
        '速度': petData.base_spd ?? '--'
    };

    // 提取特性
    const primaryTrait = petData.trait?.localized?.zh || null;

    // 构建头像路径（尝试 data/friends/JL_{pinyin}.webp）
    const portraitPinyin = petData.name || '';
    const friendsDir = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'friends');
    const portraitPath = path.join(friendsDir, `JL_${portraitPinyin}.webp`);
    let portraitSrc = '';
    if (fs.existsSync(portraitPath)) {
        // 转换为 base64 data URI
        const portraitBuffer = fs.readFileSync(portraitPath);
        const portraitBase64 = portraitBuffer.toString('base64');
        portraitSrc = `data:image/webp;base64,${portraitBase64}`;
    } else {
        console.warn(`⚠️ 未找到头像文件: JL_${portraitPinyin}.webp`);
        // fallback：尝试查找同中文名的其他形态的头像
        try {
            const petsDataPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'other', 'Pets.json');
            if (fs.existsSync(petsDataPath)) {
                const petsRaw = fs.readFileSync(petsDataPath, 'utf-8');
                const allPets = JSON.parse(petsRaw);
                // 查找同中文名的其他条目
                for (const otherPet of allPets) {
                    if (otherPet.id !== petData.id && otherPet.localized?.zh?.name === zhName && otherPet.name) {
                        const fallbackPath = path.join(friendsDir, `JL_${otherPet.name}.webp`);
                        if (fs.existsSync(fallbackPath)) {
                            const fbBuffer = fs.readFileSync(fallbackPath);
                            const fbBase64 = fbBuffer.toString('base64');
                            portraitSrc = `data:image/webp;base64,${fbBase64}`;
                            console.log(`✅ 使用同形态 fallback 头像: JL_${otherPet.name}.webp`);
                            break;
                        }
                    }
                }
            }
        } catch (fbError) {
            console.warn('头像 fallback 查找失败:', fbError.message);
        }
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
    const primaryAttribute = attributes.length > 0 ? attributes[0] : '普通';
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
        // 设置固定高度（不需要技能部分，所以高度可以固定）
        const finalHeight = 860;

        // 生成HTML内容（参考图：浅色底 + 深色数值区 + 信息卡片）
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8" />
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Noto+Serif+SC:wght@400;600;700&display=swap');
                * {
                    box-sizing: border-box;
                }
                body {
                    width: 1280px;
                    min-height: ${finalHeight}px;
                    margin: 0;
                    padding: 34px;
                    font-family: 'Noto Serif SC', serif;
                    color: #2f2418;
                    background:
                        radial-gradient(circle at 15% 12%, rgba(255,255,255,0.68) 0%, rgba(255,255,255,0) 34%),
                        radial-gradient(circle at 85% 85%, rgba(255,255,255,0.46) 0%, rgba(255,255,255,0) 38%),
                        linear-gradient(135deg, #f8e7bc 0%, #f0d99e 40%, #e9cd89 100%);
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                }
                .card {
                    width: 1210px;
                    border-radius: 34px;
                    background: linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,252,242,0.86) 100%);
                    border: 2px solid rgba(255, 255, 255, 0.7);
                    box-shadow:
                        0 26px 52px rgba(112, 72, 20, 0.22),
                        inset 0 1px 0 rgba(255, 255, 255, 0.9);
                    padding: 28px 30px 32px;
                    position: relative;
                    overflow: hidden;
                }
                .card::after {
                    content: '';
                    position: absolute;
                    right: -140px;
                    top: -120px;
                    width: 430px;
                    height: 430px;
                    border-radius: 50%;
                    background: radial-gradient(circle, ${colorScheme.border.replace('0.6', '0.26')} 0%, rgba(255,255,255,0) 72%);
                    pointer-events: none;
                }

                .top {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 14px;
                    margin-bottom: 18px;
                }
                .title-group {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 0;
                }
                .name {
                    font-size: 54px;
                    font-weight: 700;
                    line-height: 1.1;
                    color: #2f2418;
                    text-shadow: 0 2px 6px rgba(255,255,255,0.45);
                }
                .badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 14px;
                    border-radius: 999px;
                    background: #fff8e6;
                    border: 1px solid rgba(194, 149, 79, 0.32);
                    box-shadow: 0 4px 12px rgba(127, 93, 36, 0.12);
                }
                .attribute-text {
                    font-size: 24px;
                    font-weight: 700;
                    color: #694b21;
                    letter-spacing: 1px;
                }
                .number {
                    font-family: 'Orbitron', sans-serif;
                    font-size: 28px;
                    color: #6f532b;
                    opacity: 0.9;
                    background: rgba(255,255,255,0.5);
                    border-radius: 14px;
                    padding: 8px 14px;
                    border: 1px solid rgba(255,255,255,0.8);
                }

                .main {
                    position: relative;
                    z-index: 2;
                    display: grid;
                    grid-template-columns: 390px 1fr;
                    gap: 22px;
                    margin-bottom: 18px;
                }

                .portrait-panel {
                    border-radius: 26px;
                    background: linear-gradient(160deg, #f9edd0 0%, #f3dcab 100%);
                    border: 1px solid rgba(255,255,255,0.85);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 10px 22px rgba(119,86,40,0.18);
                    min-height: 355px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                }
                .portrait-panel::before {
                    content: '';
                    position: absolute;
                    width: 310px;
                    height: 310px;
                    border-radius: 50%;
                    background: radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%);
                }
                .portrait {
                    width: 320px;
                    height: 320px;
                    object-fit: contain;
                    position: relative;
                    z-index: 1;
                    filter: drop-shadow(0 10px 20px rgba(70, 46, 17, 0.25));
                    animation: float 3.4s ease-in-out infinite;
                }
                .portrait-placeholder {
                    width: 320px;
                    height: 320px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    z-index: 1;
                    font-size: 80px;
                    color: #b8955a;
                    opacity: 0.5;
                }

                .stats-panel {
                    border-radius: 28px;
                    background: linear-gradient(165deg, #6f5a42 0%, #5a4633 46%, #46382a 100%);
                    color: #fff3db;
                    border: 1px solid rgba(255,255,255,0.16);
                    box-shadow: 0 12px 30px rgba(49, 34, 18, 0.33);
                    padding: 20px 22px;
                    display: grid;
                    gap: 12px;
                    align-content: start;
                }
                .stats-title {
                    font-size: 28px;
                    font-weight: 700;
                    letter-spacing: 2px;
                    color: #ffe2b0;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                }
                .stat-item {
                    background: rgba(255, 255, 255, 0.08);
                    border-radius: 14px;
                    padding: 12px 10px;
                    border: 1px solid rgba(255, 255, 255, 0.14);
                }
                .stat-label {
                    font-size: 20px;
                    color: #f0cf97;
                    margin-bottom: 4px;
                    font-weight: 600;
                }
                .stat-value {
                    font-family: 'Orbitron', sans-serif;
                    font-size: 35px;
                    font-weight: 700;
                    line-height: 1;
                    color: #ffffff;
                    letter-spacing: 1px;
                }

                .bottom {
                    position: relative;
                    z-index: 2;
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 14px;
                }
                .info-card {
                    border-radius: 18px;
                    background: rgba(255, 248, 230, 0.82);
                    border: 1px solid rgba(214, 171, 106, 0.36);
                    box-shadow: 0 6px 14px rgba(114, 76, 33, 0.1);
                    padding: 14px 16px;
                }
                .info-title {
                    font-size: 22px;
                    font-weight: 700;
                    color: #734e1f;
                    margin-bottom: 6px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .info-content {
                    font-size: 21px;
                    line-height: 1.45;
                    color: #45301a;
                    word-break: break-word;
                }

                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-9px); }
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="top">
                    <div class="title-group">
                        <div class="name">${zhName}</div>
                        <div class="badge">
                            <span class="attribute-text">${attributes.join(' ')}</span>
                        </div>
                    </div>
                    <div class="number">${number}</div>
                </div>

                <div class="main">
                    <div class="portrait-panel">
                        ${portraitSrc ? `<img src="${portraitSrc}" alt="Portrait" class="portrait" />` : `<div class="portrait-placeholder">🐾</div>`}
                    </div>

                    <div class="stats-panel">
                        <div class="stats-title">基础能力值</div>
                        <div class="stats-grid">
                            <div class="stat-item"><div class="stat-label">生命</div><div class="stat-value">${stats['生命']}</div></div>
                            <div class="stat-item"><div class="stat-label">速度</div><div class="stat-value">${stats['速度']}</div></div>
                            <div class="stat-item"><div class="stat-label">魔攻</div><div class="stat-value">${stats['魔攻']}</div></div>
                            <div class="stat-item"><div class="stat-label">物攻</div><div class="stat-value">${stats['物攻']}</div></div>
                            <div class="stat-item"><div class="stat-label">物防</div><div class="stat-value">${stats['物防']}</div></div>
                            <div class="stat-item"><div class="stat-label">魔防</div><div class="stat-value">${stats['魔防']}</div></div>
                        </div>
                    </div>
                </div>

                <div class="bottom">
                    <div class="info-card">
                        <div class="info-title">🧬 特性</div>
                        <div class="info-content">${primaryTrait ? `${primaryTrait.name}：${primaryTrait.description}` : '暂无特性信息'}</div>
                    </div>
                </div>
            </div>
        </body>
        </html> `;

        // 设置视口和截图
        await page.setViewport({ width: 1280, height: finalHeight });
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
export default generatePetCard;

// 如果直接运行此文件，则从命令行参数获取精灵名称
if (import.meta.url === `file://${process.argv[1]}`) {
    const spriteName = process.argv[2];
    const spriteId = process.argv[3];
    if (!spriteName) {
        console.error('❌ 请提供精灵名称作为参数，例如：node generatePetCard.js 喵喵 3001');
        process.exit(1);
    }
    
    generatePetCard(spriteName, spriteId)
        .then(imagePath => {
            console.log(`🎉 任务完成！生成的图片路径：${imagePath}`);
        })
        .catch(error => {
            console.error('❌ 执行失败:', error);
            process.exit(1);
        });
}
