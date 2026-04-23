import fs from 'fs';
import path from 'path';
import plugin from "../../../lib/plugins/plugin.js";
import generatePetCard from './mode/generatePetCard.js';
import { fileURLToPath } from 'url';

// 使用fileURLToPath获取正确的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const spriteListPath = path.join(__dirname, '..', 'data', 'jllb', '精灵列表.json');

// 加载精灵列表
function loadSpriteList() {
  try {
    const rawData = fs.readFileSync(spriteListPath, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('读取精灵列表失败:', error);
    return [];
  }
}

// 检查宠物名称是否存在
function isPetNameValid(petName) {
  const petList = loadSpriteList();
  return petList.some(pet => pet.名字 === petName);
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
      if (!isPetNameValid(petName)) {
        this.reply('宠物名称不存在，请检查输入是否正确', false);
        return;
      }

      // 调用generatePetCard函数生成卡牌
      this.reply('正在生成宠物资料卡，请稍候...', false);

      const base64Image = await generatePetCard(petName);

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
