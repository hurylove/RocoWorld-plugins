<div align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D16.0.0-orange.svg" alt="Node.js">
</div>

# RocoWorld-plugins

<div align="center">
  <img src="./data/image/readme.webp" alt="RocoWorld-plugins" width="600">
</div>

## 📚 项目介绍

RocoWorld-plugins 是一个针对洛克王国的云崽机器人插件，旨在为玩家提供精灵资料查询等功能。

- 🎯 **快速查询**：通过 QQ 机器人快速查询精灵详细数据
- 📊 **全面信息**：包含属性、种族值、技能、特性等详细信息
- 🎨 **精美展示**：以精美卡牌图片形式回复，视觉效果出色
- 🔧 **本地数据**：使用本地数据文件，查询速度快，无需网络请求

## ⚙️ 前置要求

- **Yunzai-Bot**（云崽机器人）框架
- **Node.js** ≥ 16.0.0
- **pnpm** 包管理器

## 🚀 安装教程

### 自动安装

在云崽根目录执行以下命令：

```bash
# 从GitHub下载
git clone https://github.com/hurylove/RocoWorld-plugins.git ./plugins/RocoWorld-plugins/

# 安装依赖
pnpm i

# 或从GitCode下载（国内访问更快）
git clone https://gitcode.net/hurylove/RocoWorld-plugins.git ./plugins/RocoWorld-plugins/

# 安装依赖
pnpm i
```

### 手动安装

1. 在云崽默认根目录中找到 "plugins" 文件夹
2. 将下载的 RocoWorld-plugins 文件夹复制到 "plugins" 文件夹中
3. 安装插件所需依赖：`pnpm i`
4. 启动云崽机器人

## 📖 使用说明

### 精灵资料卡查询

发送以下格式的消息触发精灵资料卡查询：

| 指令格式 | 示例 |
|----------|------|
| `#精灵名` | `#迪莫` |
| `精灵名资料卡` | `迪莫资料卡` |
| `#精灵名资料卡` | `#迪莫资料卡` |

### 帮助菜单

发送以下指令查看插件帮助：

| 指令 | 功能 |
|------|------|
| `#洛克帮助` | 查看帮助菜单 |
| `#洛克菜单` | 查看帮助菜单 |
| `#洛克功能` | 查看帮助菜单 |
| `#洛克王国帮助` | 查看帮助菜单 |
| `#洛克王国菜单` | 查看帮助菜单 |
| `#洛克王国功能` | 查看帮助菜单 |

## 📁 数据说明

- **精灵详情数据**：存储在 `data/jltj/` 目录下，每只精灵对应一个 JSON 文件
- **精灵名称列表**：存储在 `data/jllb/精灵列表.json`
- **生成的卡牌图片**：存储在 `data/output/` 目录下

## 🎨 功能特性

- ✅ 精灵资料卡查询
- ✅ 精美卡牌图片生成
- ✅ 详细的精灵属性展示
- ✅ 技能列表与特性展示
- ✅ 帮助菜单
- ✅ 本地数据存储

## 🤝 参与贡献

1. 欢迎提交 Issue 与 PR 一起完善插件功能与文档内容
2. 如有功能建议或使用问题，可通过仓库反馈渠道提交

## 📄 许可证

本项目使用 [MIT](LICENSE) 许可证。

## 📞 联系方式

- 反馈问题请在此处提交 Issue
- 本插件仅供学习交流使用，请勿用于商业用途

---

<div align="center">
  <p>✨ 感谢使用 RocoWorld-plugins 插件！ ✨</p>
</div>