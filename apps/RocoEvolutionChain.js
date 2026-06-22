import plugin from "../../../lib/plugins/plugin.js";
import generateEvolutionChain from './mode/generateEvolutionChain.js';

export default class evolutionChainQuery extends plugin {
  constructor() {
    super({
      name: '宠物进化链查询',
      dsc: '查询宠物的进化链',
      event: 'message',
      priority: 20,
      rule: [
        {
          reg: '^#(.+?)(?:进化|进化链)$',
          fnc: 'queryEvolutionChain',
        }
      ]
    })
  }

  async queryEvolutionChain(e) {
    try {
      const msg = (e.msg || '').trim();
      const match = msg.match(/^#(.+?)(?:进化|进化链)$/);
      if (!match) return;

      let petName = match[1].trim();
      // 去除零宽空格等不可见字符
      petName = petName.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      if (!petName) return;

      await this.reply(`正在查询「${petName}」的进化链，请稍候...`, false);

      const base64Image = await generateEvolutionChain(petName);
      if (!base64Image) {
        this.reply('进化链图片生成失败，请稍后重试', false);
        return;
      }

      this.reply(segment.image(`base64://${base64Image}`), false);

    } catch (error) {
      console.error('查询进化链失败:', error);
      this.reply('查询进化链时发生错误，请稍后重试', false);
    }
  }
}
