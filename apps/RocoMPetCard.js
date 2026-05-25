import fs from 'fs';
import path from 'path';
import plugin from "../../../lib/plugins/plugin.js";
import generatePetCard from './mode/generatePetCard.js';
import { fileURLToPath } from 'url';

// 使用fileURLToPath获取正确的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const petsDataPath = path.join(__dirname, '..', 'data', 'other', 'Pets.json');
const petBaseConfPath = path.join(__dirname, '..', 'data', 'BinData', 'PETBASE_CONF.json');

// 加载宠物数据并构建 中文名→宠物对象 的映射
let petNameMap = null;

function buildPetNameMap() {
  if (petNameMap) return petNameMap;
  try {
    const rawData = fs.readFileSync(petsDataPath, 'utf-8');
    const pets = JSON.parse(rawData);
    petNameMap = new Map();

    // 构建 id -> pet 的索引（用于后续从 PETBASE 精确查找形态）
    const petById = new Map();
    for (const pet of pets) {
      petById.set(pet.id, pet);
    }

    // 第一步：建立 中文名 → [pet条目] 的映射（一个中文名可能对应多个形态）
    const zhNameToPets = new Map();
    for (const pet of pets) {
      const zhName = pet.localized?.zh?.name;
      if (zhName) {
        if (!zhNameToPets.has(zhName)) {
          zhNameToPets.set(zhName, []);
        }
        zhNameToPets.get(zhName).push(pet);
      }
    }

    // 第二步：对只有一个条目的中文名，直接映射
    // 对有多个条目的中文名，取第一个作为默认
    for (const [zhName, petList] of zhNameToPets) {
      petNameMap.set(zhName, petList[0]);
    }

    // 第三步：从PETBASE_CONF加载形态信息，构建"名称（形态）"的精确映射
    // PETBASE_CONF是对象格式（以id为key），form字段记录了形态名称（如"单只海葵的样子"）
    try {
      const petBaseRaw = fs.readFileSync(petBaseConfPath, 'utf-8');
      const petBaseData = JSON.parse(petBaseRaw);
      for (const [key, entry] of Object.entries(petBaseData)) {
        // 跳过非数字key的字段（如果有的话）
        if (!entry || typeof entry !== 'object' || !entry.id) continue;
        const name = entry.name;
        const form = entry.form;
        if (name && form) {
          const fullName = `${name}（${form}）`;
          // 通过id精确匹配到Pets.json中正确的宠物条目
          const pet = petById.get(entry.id);
          if (pet) {
            petNameMap.set(fullName, pet);
          }
        }
      }
    } catch (e) {
      console.error('加载PETBASE_CONF失败（非致命）:', e.message);
    }

    console.log(`✅ 已加载 ${petNameMap.size} 个宠物名称索引（含形态名称）`);
    return petNameMap;
  } catch (error) {
    console.error('读取宠物数据失败:', error);
    return new Map();
  }
}

// 检查宠物名称是否存在
function isPetNameValid(petName) {
  const map = buildPetNameMap();
  return map.has(petName);
}

export default class petCard extends plugin {
  constructor () {
    super({
      name: '宠物资料卡',
      dsc: '生成宠物资料卡图片',
      event: 'message',
      priority: 20,
      rule: [
        {
          reg: '^#(?:洛克)?\\s*(.+?)\\s*资料卡$',
          fnc: 'generatePetCard',
        }
      ]
    })
  }

  async generatePetCard(e) {
    try {
      // 提取宠物名称（与 rule 保持一致）
      const msg = (e.msg || '').trim();
      const match = msg.match(/^#(?:洛克)?\s*(.+?)\s*资料卡$/);
      if (!match) {
        return;
      }

      let petName = match[1].trim();

      if (!petName) {
        this.reply('请提供宠物名称，例如：#迪莫 或 迪莫资料卡', false);
        return;
      }

      // 验证宠物名称是否在列表中
      const map = buildPetNameMap();
      const petEntry = map.get(petName);
      if (!petEntry) {
        this.reply('宠物名称不存在，请检查输入是否正确', false);
        return;
      }

      // 调用generatePetCard函数生成卡牌，传入宠物名称和ID
      this.reply('正在生成宠物资料卡，请稍候...', false);

      const base64Image = await generatePetCard(petName, petEntry.id);

      // 检查图片是否生成成功
      if (!base64Image) {
        this.reply('卡牌生成失败，请检查宠物名称是否正确', false);
        return;
      }

      // 发送生成的图片
      this.reply(segment.image(`base64://${base64Image}`), false);

    } catch (error) {
      console.error('生成卡牌失败:', error);
      this.reply('生成卡牌时出现错误，请稍后重试', false);
    }
  }
}
