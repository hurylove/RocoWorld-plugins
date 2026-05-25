import fs from 'fs';
import path from 'path';
import plugin from "../../../lib/plugins/plugin.js";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const petBaseConfPath = path.join(__dirname, '..', 'data', 'BinData', 'PETBASE_CONF.json');

// 缓存：名称 → 形态列表
let formMapCache = null;

function buildFormMap() {
  if (formMapCache) return formMapCache;
  try {
    const rawData = fs.readFileSync(petBaseConfPath, 'utf-8');
    const petBaseData = JSON.parse(rawData);
    formMapCache = new Map();

    for (const [, entry] of Object.entries(petBaseData)) {
      if (!entry || typeof entry !== 'object' || !entry.id || !entry.name) continue;
      const name = entry.name;
      const form = entry.form || '默认形态';

      if (!formMapCache.has(name)) {
        formMapCache.set(name, []);
      }
      formMapCache.get(name).push({ id: entry.id, form });
    }

    console.log(`✅ 已加载形态查询索引，共 ${formMapCache.size} 个宠物名称`);
    return formMapCache;
  } catch (error) {
    console.error('加载PETBASE_CONF失败:', error);
    return new Map();
  }
}

export default class petFormQuery extends plugin {
  constructor() {
    super({
      name: '宠物形态查询',
      dsc: '查询宠物的所有形态',
      event: 'message',
      priority: 20,
      rule: [
        {
          reg: '^#(.+?)(?:查询|全部形态)$',
          fnc: 'queryPetForms',
        }
      ]
    })
  }

  async queryPetForms(e) {
    try {
      const msg = (e.msg || '').trim();
      const match = msg.match(/^#(.+?)(?:查询|全部形态)$/);
      if (!match) return;

      const petName = match[1].trim();
      if (!petName) return;

      const map = buildFormMap();
      const forms = map.get(petName);

      // 名称不在宠物形态表中，静默返回（避免误匹配其他插件的指令）
      if (!forms || forms.length === 0) {
        return;
      }

      if (forms.length === 1 && forms[0].form === '默认形态') {
        this.reply(`「${petName}」只有默认形态，暂无其他形态`, false);
        return;
      }

      // 构建回复消息
      const lines = [`「${petName}」共有 ${forms.length} 种形态：`];
      for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        const label = form.form === '默认形态'
          ? `${petName}（默认）`
          : `${petName}（${form.form}）`;
        lines.push(`${i + 1}. ${label}`);
      }

      this.reply(lines.join('\n'), false);

    } catch (error) {
      console.error('形态查询失败:', error);
      this.reply('形态查询时出现错误，请稍后重试', false);
    }
  }
}
