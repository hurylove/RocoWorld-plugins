import fs from 'fs';
import path from 'path';
import plugin from "../../../lib/plugins/plugin.js";
import generateCard from './mode/generateCard.js';
import { fileURLToPath } from 'url';

// 使用process.cwd()作为项目根目录的基准
const projectRoot = process.cwd();
const spriteListPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'jllb', '精灵列表.json');

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

// 检查精灵名称是否存在
function isSpriteNameValid(spriteName) {
  const spriteList = loadSpriteList();
  return spriteList.some(sprite => sprite.名字 === spriteName);
}

export default class spriteCard extends plugin {
  constructor () {
    super({
      name: '宠物解析卡',
      dsc: '生成宠物解析卡图片',
      event: 'message',
      priority: 20,
      rule: [
        {
          reg: '^#(?:洛克)?\\s*(.+?)\\s*解析卡$',
          fnc: 'generateSpriteCard',
        }
      ]
    })
  }

  async generateSpriteCard(e) {
    try {
      // 提取精灵名称（与 rule 保持一致）
      const msg = (e.msg || '').trim();
      const match = msg.match(/^#(?:洛克)?\s*(.+?)\s*解析卡$/);
      if (!match) {
        return;
      }

      let spriteName = match[1].trim();

      if (!spriteName) {
        this.reply('请提供精灵名称，例如：#迪莫解析卡 或 #洛克迪莫解析卡', false);
        return;
      }

      // 验证精灵名称是否在列表中
      if (!isSpriteNameValid(spriteName)) {
        this.reply('精灵名称不存在，请检查输入是否正确', false);
        return;
      }

      // 调用generateCard函数生成卡牌
      this.reply('正在生成宠物图鉴，请稍候...', false);

      const base64Image = await generateCard(spriteName);

      // 检查图片是否生成成功
      if (!base64Image) {
        this.reply('卡牌生成失败，请检查精灵名称是否正确', false);
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
