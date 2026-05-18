import fs from 'fs';
import path from 'path';
import plugin from "../../../lib/plugins/plugin.js";
import { generateNatureChart, generateSingleNatureChart } from './mode/generateNatureChart.js';

const projectRoot = process.cwd();
const naturePath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'BinData', 'NATURE_CONF.json');

function loadNatureNames() {
  try {
    const rawData = fs.readFileSync(naturePath, 'utf-8');
    const json = JSON.parse(rawData);
    const names = [];
    for (const key in json.RocoDataRows) {
      const n = json.RocoDataRows[key];
      if (n.is_player_pet_nature && n.name) {
        names.push(n.name);
      }
    }
    return names;
  } catch (error) {
    console.error('读取性格数据失败:', error);
    return [];
  }
}

function isNatureNameValid(name) {
  const names = loadNatureNames();
  return names.includes(name);
}

export default class RocoNature extends plugin {
  constructor () {
    super({
      name: '宠物性格查询',
      dsc: '生成宠物性格表和单性格详情图',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#?性格表$',
          fnc: 'generateFullNatureChart',
        },
        {
          reg: '^#?性格查询\\s*(.+)$',
          fnc: 'querySingleNature',
        }
      ]
    })
  }

  async generateFullNatureChart(e) {
    try {
      this.reply('正在生成性格表，请稍候...', false);

      const base64Image = await generateNatureChart();

      if (!base64Image) {
        this.reply('性格表生成失败，请稍后重试', false);
        return;
      }

      this.reply(segment.image(`base64://${base64Image}`), false);

    } catch (error) {
      console.error('生成性格表失败:', error);
      this.reply('生成性格表时出现错误，请稍后重试', false);
    }
  }

  async querySingleNature(e) {
    try {
      const match = e.msg.match(/^#?性格查询\s*(.+)$/);
      if (!match) {
        return;
      }

      let natureName = match[1].trim();

      if (!natureName) {
        this.reply('请提供性格名称，例如：#性格查询 大胆', false);
        return;
      }

      if (!isNatureNameValid(natureName)) {
        this.reply('性格名称不存在，请检查输入是否正确', false);
        return;
      }

      this.reply(`正在查询性格 [${natureName}]，请稍候...`, false);

      const base64Image = await generateSingleNatureChart(natureName);

      if (!base64Image) {
        this.reply('性格详情生成失败，请检查性格名称是否正确', false);
        return;
      }

      this.reply(segment.image(`base64://${base64Image}`), false);

    } catch (error) {
      console.error('生成性格详情失败:', error);
      this.reply('生成性格详情时出现错误，请检查性格名称是否正确', false);
    }
  }
}
