import fs from 'fs';
import path from 'path';
import plugin from "../../../lib/plugins/plugin.js";
import generateTypeChart from './mode/generateTypeChart.js';
import generateSingleTypeChart from './mode/generateSingleTypeChart.js';
import { fileURLToPath } from 'url';

// 使用process.cwd()作为项目根目录的基准
const projectRoot = process.cwd();
const typeChartPath = path.join(projectRoot, 'plugins', 'RocoWorld-plugins', 'data', 'jllb', '属性克制表.json');

// 加载属性克制表数据
function loadTypeChartData() {
  try {
    const rawData = fs.readFileSync(typeChartPath, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('读取属性克制表失败:', error);
    return null;
  }
}

// 检查属性名称是否存在
function isTypeNameValid(typeName) {
  const chartData = loadTypeChartData();
  if (!chartData || !chartData.types) return false;
  return chartData.types.some(type => type.name === typeName);
}

export default class typeChart extends plugin {
  constructor () {
    super({
      name: '属性克制表',
      dsc: '生成属性克制表和单属性克制图',
      event: 'message',
      priority: 500,
      rule: [
        {
          reg: '^#?属性克制表$',
          fnc: 'generateFullTypeChart',
        },
        {
          reg: '^#?(.*?)(克制|克制关系|克制表)$',
          fnc: 'generateSingleTypeChart',
        }
      ]
    })
  }

  async generateFullTypeChart(e) {
    try {
      // 调用generateTypeChart函数生成完整的属性克制表
      this.reply('正在生成属性克制表，请稍候...', false);

      const base64Image = await generateTypeChart();

      // 检查图片是否生成成功
      if (!base64Image) {
        this.reply('属性克制表生成失败，请稍后重试', false);
        return;
      }

      // 发送生成的图片
      this.reply(segment.image(`base64://${base64Image}`), false);

    } catch (error) {
      console.error('生成属性克制表失败:', error);
      this.reply('生成属性克制表时出现错误，请稍后重试', false);
    }
  }

  async generateSingleTypeChart(e) {
    try {
      // 提取属性名称
      const match = e.msg.match(/^#?(.*?)(克制|克制关系|克制表)$/);
      if (!match) {
        return;
      }

      let typeInput = match[1].trim();

      if (!typeInput) {
        this.reply('请提供属性名称，例如：#光系克制 或 光系克制', false);
        return;
      }

      // 调用generateSingleTypeChart函数生成单属性克制图
      this.reply('正在生成属性克制图，请稍候...', false);

      const base64Image = await generateSingleTypeChart(typeInput);

      // 检查图片是否生成成功
      if (!base64Image) {
        this.reply('属性克制图生成失败，请检查属性名称是否正确', false);
        return;
      }

      // 发送生成的图片
      this.reply(segment.image(`base64://${base64Image}`), false);

    } catch (error) {
      console.error('生成属性克制图失败:', error);
      this.reply('生成属性克制图时出现错误，请检查属性名称是否正确', false);
    }
  }
}