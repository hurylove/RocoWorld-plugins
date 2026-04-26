import plugin from "../../../lib/plugins/plugin.js";
import crawlLuoke from './mode/crawlLuoke.js';

export default class RocoEggQuery extends plugin {
  constructor () {
    super({
      name: '洛克孵蛋查询',
      dsc: '根据蛋尺寸和重量查询可能的精灵',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#?(?:孵蛋|蛋)查询(.+)$',
          fnc: 'queryEgg',
        }
      ]
    })
  }

  async queryEgg(e) {
    try {
      const match = e.msg.match(/^#?(?:孵蛋|蛋)查询(.+)$/);
      if (!match) {
        await this.reply('请使用正确的格式：#孵蛋查询 尺寸 重量', false);
        return;
      }

      const params = match[1].trim().split(/\s+/);
      if (params.length < 2) {
        await this.reply('请使用正确的格式：#孵蛋查询 尺寸 重量', false);
        return;
      }

      const size = parseFloat(params[0]);
      const weight = parseFloat(params[1]);

      if (isNaN(size) || isNaN(weight)) {
        await this.reply('尺寸和重量必须是数字', false);
        return;
      }

      await this.reply('正在查询孵蛋信息，请稍候...', false);

      // 调用爬虫获取数据
      const result = await crawlLuoke(size, weight);

      // 转图片并发送
      if (result.imageBase64) {
        await this.reply(segment.image(`base64://${result.imageBase64}`), false);
      } else {
        await this.reply('查询失败，无法生成图片', false);
      }
    } catch (error) {
      console.error('获取孵蛋信息失败:', error);
      await this.reply('获取孵蛋信息时出现错误，请稍后重试', false);
    }
  }
}
