import plugin from "../../../lib/plugins/plugin.js";

export default class Help extends plugin {
  constructor() {
    super({
      name: "洛克王国-帮助",
      dsc: "查看插件帮助",
      event: "message",
      priority: 500,
      rule: [
        {
          reg: "^#(洛克|洛克王国)(帮助|菜单|功能)$",
          fnc: "allHelp"
        }
      ]
    })
  }

  async allHelp(e) {
    try {
      // 帮助内容
      const helpContent = [
        "【RocoWorld-plugins 插件帮助】",
        "",
        "===== 功能列表 =====",
        "#精灵名称 - 查看精灵资料卡，例如：#迪莫",
        "#精灵名称资料卡 - 查看精灵资料卡，例如：#迪莫资料卡",
        "#洛克帮助 - 查看帮助菜单",
        "#洛克菜单 - 查看帮助菜单",
        "#洛克功能 - 查看帮助菜单",
        "#洛克王国帮助 - 查看帮助菜单",
        "#洛克王国菜单 - 查看帮助菜单",
        "#洛克王国功能 - 查看帮助菜单",
        "",
        "===== 插件信息 =====",
        "插件名称：RocoWorld-plugins",
        "版本：1.0.0",
        "描述：洛克王国世界查询插件"
      ];

      // 发送帮助信息
      this.reply(helpContent.join('\n'), false);

    } catch (error) {
      console.error('生成帮助失败:', error);
      this.reply('生成帮助时出现错误，请稍后重试', false);
    }
  }
}
