import fs from 'fs';
import path from 'path';
import plugin from "../../../lib/plugins/plugin.js";
import generateGlossary from './mode/generateGlossary.js';

// 使用 process.cwd() 作为项目根目录
const projectRoot = process.cwd();
const glossaryPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'other', 'game_terms.json');

// 加载术语数据
function loadGlossaryData() {
  try {
    const rawData = fs.readFileSync(glossaryPath, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('读取术语数据失败:', error);
    return null;
  }
}

export default class RocoGlossary extends plugin {
  constructor() {
    super({
      name: '术语查询',
      dsc: '生成术语列表图片（支持关键词筛选）',
      event: 'message',
      priority: 20,
      rule: [
        {
          reg: '^#术语查询(?:\\s+(.+))?$',
          fnc: 'queryGlossary'
        },
        {
          reg: '^#术语(?:总览|大全)$',
          fnc: 'queryGlossaryAll'
        }
      ]
    });
  }

  async queryGlossaryAll() {
    try {
      const glossaryData = loadGlossaryData();
      if (!glossaryData) {
        this.reply('术语数据读取失败，请稍后重试', false);
        return;
      }

      this.reply('正在生成完整术语总览，请稍候...', false);

      const base64Image = await generateGlossary('');

      if (!base64Image) {
        this.reply('术语总览图片生成失败，请稍后重试', false);
        return;
      }

      this.reply(segment.image(`base64://${base64Image}`), false);
    } catch (error) {
      console.error('生成术语总览图片失败:', error);
      this.reply('生成术语总览时出现错误，请稍后重试', false);
    }
  }

  async queryGlossary(e) {
    try {
      const msg = String(e.msg || '').trim();
      const match = msg.match(/^#术语查询(?:\s+(.+))?$/);
      if (!match) {
        return;
      }

      const keyword = String(match[1] || '').trim();

      const glossaryData = loadGlossaryData();
      if (!glossaryData) {
        this.reply('术语数据读取失败，请稍后重试', false);
        return;
      }

      if (keyword) {
        this.reply(`正在查询术语（关键词：${keyword}），请稍候...`, false);
      } else {
        this.reply('正在生成术语列表，请稍候...', false);
      }

      const base64Image = await generateGlossary(keyword);

      if (!base64Image) {
        this.reply('术语图片生成失败，请稍后重试', false);
        return;
      }

      this.reply(segment.image(`base64://${base64Image}`), false);
    } catch (error) {
      console.error('生成术语查询图片失败:', error);
      this.reply('术语查询时出现错误，请稍后重试', false);
    }
  }
}
