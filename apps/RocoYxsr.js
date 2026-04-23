import plugin from "../../../lib/plugins/plugin.js";
import getYxsrInfo from './mode/wikiCrawler.js';

export default class yxsrPlugin extends plugin {
  constructor () {
    super({
      name: '远行商人',
      dsc: '获取洛克王国远行商人信息',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#?远行商人$',
          fnc: 'getYxsr',
        },
        {
          reg: '^#?商人$',
          fnc: 'getYxsr',
        }
      ]
    })
  }

  async getYxsr(e) {
    try {
      // 调用 getYxsrInfo 函数获取远行商人信息
      this.reply('正在查询远行商人信息，请稍候...', false);

      const yxsrInfo = await getYxsrInfo();

      // 发送获取到的信息
      this.reply(yxsrInfo, false);

    } catch (error) {
      console.error('获取远行商人信息失败:', error);
      this.reply('获取远行商人信息时出现错误，请稍后重试', false);
    }
  }
}