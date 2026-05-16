# Roco.Aoe.Top 数据目录索引

**数据来源**: [aoe-top/rocom.aoe.top](https://github.com/aoe-top/rocom.aoe.top)

---

## 📁 data/ 目录文件说明

### 核心数据文件

| 文件 | 说明 | 用途 |
|------|------|------|
| `Pets.json` | 精灵列表 | 宠物基础信息（ID、名称、属性、进化链等） |
| `PetSkillIndex.json` | 精灵技能筛选索引 | 技能分类、快速查找 |
| `types.json` | 血脉/属性列表 | 19种属性类型及克制关系 |
| `moves.json` | 技能列表 | 技能名称、威力、属性、能耗等 |
| `personalities.json` | 性格列表 | 30种性格的属性修正值 |
| `magic_items.json` | 血脉魔法 | 进化之力、光合治愈等魔法效果 |
| `breeding.json` | 繁殖配方 | 宠物繁殖组合配方 |
| `bloodline_index.json` | 血脉索引 | 血脉系统分类索引 |
| `game_terms.json` | 游戏术语 | 界面术语翻译对照 |
| `items.json` | 道具列表 | 道具名称、ID、分类 |
| `handbook-rewards.json` | 图鉴奖励 | 完成图鉴收集奖励 |
| `README.md` | 数据索引 | 本目录文件说明 |

### BinData/ 目录

完整游戏数据配置文件目录，包含 **200+ 个配置文件**，涵盖：

| 分类 | 说明 |
|------|------|
| `PET_*.json` | 宠物相关配置（蛋、基础属性、进化、天赋等） |
| `BATTLE_*.json` | 战斗系统配置 |
| `SKILL_*.json` | 技能系统配置 |
| `ACTIVITY_*.json` | 活动配置 |
| `ITEM_*.json` | 物品道具配置 |
| `FASHION_*.json` | 时装配置 |
| `HOME_*.json` | 家园系统配置 |
| `0-16.*.md` | 数据分类说明文档 |

详细分类说明请参考 [data/BinData/README.md](data/BinData/README.md)

---

## 🔗 资源链接

### 本地访问
```javascript
// 核心配置
const pets = require('./data/Pets.json');
const moves = require('./data/moves.json');
const types = require('./data/types.json');

// 完整配置
const petEggConf = require('./data/BinData/PET_EGG_CONF.json');
```

### GitCode CDN（远程资源）
```
# 宠物图片
https://raw.gitcode.com/hurylove/rocom_img/raw/main/friends/JL_{pinyin}.webp

# 道具图标
https://raw.gitcode.com/hurylove/rocom_img/raw/main/items/{id}.webp

# 宠物详情
https://raw.gitcode.com/hurylove/rocom_img/raw/main/pets/{id}.json
```

---

## 📊 数据统计

| 分类 | 数量 |
|------|------|
| 宠物数量 | 300+ |
| 技能数量 | 200+ |
| 属性类型 | 19 |
| 性格数量 | 30 |
| 血脉魔法 | 5 |
| BinData 配置 | 200+ |

---

## 📄 许可证

本项目数据仅供学习和研究使用，版权归腾讯游戏所有。
