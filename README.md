# 🎮 MC AI Bot — 让 AI 像真人一样玩 Minecraft

> 一个基于 [MindCraft](https://github.com/mindcraft-bots/mindcraft) 引擎的 Minecraft AI 玩家，支持手机端语音/文字聊天、记忆系统、网页配置，Docker 一键部署。

[![Docker Image](https://img.shields.io/badge/Docker-ghcr.io%2Fzlmetal%2Fmc--ai--bot--v2-blue)](https://github.com/Zlmetal/mc-ai-bot-v2/pkgs/container/mc-ai-bot-v2)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## 这是什么？

把一个 AI 放进你的 Minecraft 服务器，它会像真人玩家一样活动：探索、挖矿、建造、战斗、合成、和其他玩家聊天。你可以通过手机网页随时跟它对话，支持语音交互，它还会记住你说过的话和发生的事。

## ✨ 核心功能

- **🎮 自主游戏** — 基于 MindCraft 引擎，AI 能独立完成探索、挖矿、建造、合成、战斗等复杂任务
- **📱 手机聊天** — 打开网页就能跟 AI 对话，出门在外也能用
- **🎤 语音交互** — 按住说话，AI 语音回复，像打电话一样
- **🧠 记忆系统** — 记住你的偏好、承诺、重要事件、地点、人物关系
- **⚙️ 网页配置** — 浏览器完成所有设置，不需要编辑任何文件
- **🔌 模型可换** — 支持 MiMo、DeepSeek、OpenAI、Ollama 等主流 LLM
- **🐳 一键部署** — 单个 Docker 镜像，拉取即用

## 🚀 30 秒部署

### 飞牛 NAS / Docker Compose

```yaml
services:
  mc-ai-bot:
    image: ghcr.io/zlmetal/mc-ai-bot-v2:main
    container_name: mc-ai-bot
    restart: unless-stopped
    ports:
      - "3800:3000"
      - "8080:8080"
    volumes:
      - ./data:/app/data
    environment:
      - TZ=Asia/Shanghai
      - MC_HOST=host.docker.internal
      - MC_PORT=25565
      - MC_AUTH=offline
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

### Docker 命令行

```bash
docker run -d \
  --name mc-ai-bot \
  --restart unless-stopped \
  -p 3800:3000 \
  -p 8080:8080 \
  -v $(pwd)/data:/app/data \
  -e MC_HOST=host.docker.internal \
  -e MC_PORT=25565 \
  --add-host=host.docker.internal:host-gateway \
  ghcr.io/zlmetal/mc-ai-bot-v2:main
```

### 配置

浏览器打开 `http://你的IP:3800/settings.html`，填写 MC 服务器地址和 API Key 即可。

## 访问地址

| 页面 | 地址 | 说明 |
|------|------|------|
| 💬 聊天 | `http://IP:3800` | 手机端聊天 + 语音 |
| ⚙️ 设置 | `http://IP:3800/settings.html` | 配置页面 |
| 🧠 MindCraft | `http://IP:8080` | MindCraft 原生 UI |

## 架构

```
┌────────────── mc-ai-bot 容器 ──────────────┐
│                                              │
│  ┌──────────────┐    ┌──────────────────┐  │
│  │  MindCraft    │    │  Web 服务         │  │
│  │  端口 8080    │◄──►│  端口 3800        │  │
│  │  ─────────── │    │  ─────────────── │  │
│  │  Bot 核心引擎 │    │  手机聊天界面     │  │
│  │  Mineflayer  │    │  记忆系统         │  │
│  │  任务系统    │    │  语音交互         │  │
│  │  多 Agent    │    │  配置管理         │  │
│  └──────────────┘    └──────────────────┘  │
│           │                                  │
└───────────┼──────────────────────────────────┘
            ▼
      你的 MC 服务器
```

## 支持的 LLM

| 提供者 | API 地址 | 推荐模型 |
|--------|----------|----------|
| **MiMo Token Plan** | `https://token-plan-cn.xiaomimimo.com/v1` | MiMo-V2.5 |
| DeepSeek | `https://api.deepseek.com` | deepseek-chat |
| OpenAI | `https://api.openai.com` | gpt-4o-mini |
| OpenRouter | `https://openrouter.ai/api` | 多模型 |
| Ollama（本地） | `http://localhost:11434` | qwen2.5:7b |

## 费用估算

基于 MiMo V2.5 / DeepSeek V4 Flash：

| 使用场景 | 每小时 | 每月（12h/天） |
|----------|--------|----------------|
| 🟢 休闲（偶尔聊天） | ~0.1 元 | ~30 元 |
| 🟡 活跃（持续互动） | ~0.6 元 | ~200 元 |
| 🔴 全力（高频决策） | ~1.2 元 | ~400 元 |

## 更新

```bash
docker-compose down
docker pull ghcr.io/zlmetal/mc-ai-bot-v2:main
docker-compose up -d
```

配置保存在 `data/` 目录，更新镜像不会丢失。

## 前置要求

- Minecraft Java Edition 服务器（支持 Fabric / Paper / 原版）
- 一个 LLM API Key（推荐 MiMo Token Plan 或 DeepSeek）
- Docker 环境（NAS / Linux 服务器）

## 致谢

- [MindCraft](https://github.com/mindcraft-bots/mindcraft) — 核心 Bot 引擎
- [Mineflayer](https://github.com/PrismarineJS/mineflayer) — Minecraft 协议库

## License

MIT
