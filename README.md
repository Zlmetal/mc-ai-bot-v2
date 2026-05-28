# 🎮 MC AI Bot V2 — Minecraft AI 玩家

基于 [MindCraft](https://github.com/mindcraft-bots/mindcraft)（成熟的 LLM Minecraft Bot 引擎）+ 手机端 Web 界面 + 记忆系统 + 语音交互。

[![Docker Image](https://img.shields.io/badge/Docker-ghcr.io%2Fzlmetal%2Fmc--ai--bot--v2-blue)](https://github.com/Zlmetal/mc-ai-bot-v2/pkgs/container/mc-ai-bot-v2)

## ✨ 功能

| 功能 | 说明 |
|------|------|
| 🎮 AI 玩家 | 基于 MindCraft 引擎，自主探索、挖矿、建造、战斗、合成、与其他玩家聊天 |
| 📱 手机聊天 | 手机网页随时与 AI 对话，支持多 Agent |
| 🎤 语音交互 | 按住说话（Web Speech API），AI 语音回复（MiMo TTS） |
| 🧠 记忆系统 | SQLite 三层记忆：长期记忆、情景记忆、工作记忆 |
| ⚙️ 网页配置 | 浏览器完成所有配置，无需编辑文件 |
| 🔌 模型可换 | MiMo、DeepSeek、OpenAI、Ollama 等 |
| 🐳 一键部署 | 单个 Docker 镜像，直接拉取运行 |

## 🚀 快速开始

### 飞牛 NAS 部署（Docker Compose）

打开飞牛管理后台 → Docker → Compose，创建新项目，粘贴：

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

点启动，等待拉取完成。

### 配置

浏览器打开 `http://飞牛IP:3800/settings.html`：

- **MindCraft 连接**：地址 `localhost`，端口 `8080`
- **MC 服务器**：填你的服务器地址和端口
- **AI 大脑**：选 MiMo，填 API Key
- **语音**：启用 TTS
- **人设**：设置 AI 名字和性格

### 使用

- 聊天页面：`http://飞牛IP:3800`
- 配置页面：`http://飞牛IP:3800/settings.html`
- MindCraft UI：`http://飞牛IP:8080`

## 架构

单个容器内运行：
- MindCraft Bot 引擎（端口 8080）
- Web 服务（端口 3800）：聊天界面 + 记忆 + 语音

```
┌─────────────────────────────────┐
│ mc-ai-bot 容器                   │
│                                  │
│  ┌────────────┐  ┌───────────┐ │
│  │ MindCraft  │  │ Web 服务   │ │
│  │ (8080)     │◄►│ (3800)    │ │
│  │ - Bot 引擎 │  │ - 聊天界面│ │
│  │ - Mineflayer│  │ - 记忆    │ │
│  └────────────┘  │ - 语音    │ │
│        │         └───────────┘ │
└────────┼────────────────────────┘
         ▼
   你的 MC 服务器
```

## 支持的 LLM

| 提供者 | API 地址 | 模型 |
|--------|----------|------|
| MiMo Token Plan | `https://token-plan-cn.xiaomimimo.com/v1` | MiMo-V2.5 |
| DeepSeek | `https://api.deepseek.com` | deepseek-chat |
| OpenAI | `https://api.openai.com` | gpt-4o-mini |
| Ollama (本地) | `http://localhost:11434` | qwen2.5:7b |

## 成本

基于 MiMo V2.5 / DeepSeek V4 Flash：

| 模式 | 每小时 | 每月（12h/天） |
|------|--------|---------------|
| 休闲 | ~0.1 元 | ~30 元 |
| 活跃 | ~0.6 元 | ~200 元 |
| 全力 | ~1.2 元 | ~400 元 |

## 更新

```bash
docker-compose down
docker pull ghcr.io/zlmetal/mc-ai-bot-v2:main
docker-compose up -d
```

## 致谢

- [MindCraft](https://github.com/mindcraft-bots/mindcraft) — 核心 Bot 引擎
- [Mineflayer](https://github.com/PrismarineJS/mineflayer) — Minecraft 协议库

## License

MIT
