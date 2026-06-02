# 🎮 MC AI Bot V2

[MindCraft](https://github.com/mindcraft-bots/mindcraft) 的二次开发项目。在 MindCraft 的 AI Bot 引擎基础上，增加了 Web 管理界面、多 Bot 支持、语音交互、记忆持久化等能力。

## 与 MindCraft 的关系

| 项目 | 定位 | 说明 |
|------|------|------|
| **MindCraft** | AI Bot 引擎 | 核心 AI 逻辑、Mineflayer 集成、模型调用、命令系统 |
| **MC AI Bot V2** | 管理层 + 交互层 | Web 界面、多 Bot 管理、语音、记忆持久化、Docker 部署 |

本项目**不修改 MindCraft 源码**，通过 Socket.IO API 和文件系统与 MindCraft 交互。MindCraft 更新时，本项目可直接拉取新镜像同步升级。

## 功能特性

**MindCraft 提供的能力（底层）：**
- Minecraft Java Edition AI 玩家
- 支持多种 LLM（MiMo、GPT、Gemini、DeepSeek、Claude 等）
- 自动对话、代码执行、视觉分析
- 记忆系统（自动摘要、自动遗忘）

**本项目增加的能力（上层）：**
- **Web 管理界面** — 浏览器管理 Bot，手机随时访问
- **多 Bot 支持** — 创建多个独立 Bot，各自配置名字、性格、模型
- **语音交互** — STT 语音识别 + TTS 语音合成 + 实时通话
- **记忆持久化** — Docker 重启不丢失记忆
- **可视化配置** — Bot 管理、全局设置、高级设置三层配置体系
- **Docker 一键部署** — 开箱即用，支持飞牛 NAS 等设备

## 快速开始（Docker）

### 1. 创建配置目录

```bash
mkdir -p mc-ai-bot-v2/data
cd mc-ai-bot-v2
```

### 2. 创建 docker-compose.yml

```yaml
services:
  mc-ai-bot:
    image: ghcr.io/zlmetal/mc-ai-bot-v2:main
    container_name: mc-ai-bot
    restart: unless-stopped
    ports:
      - "3800:3000"    # Web 界面
      - "8080:8080"    # MindCraft 管理端口
    volumes:
      - ./data:/app/data
    environment:
      - TZ=Asia/Shanghai
      - MC_HOST=你的MC服务器内网IP
      - MC_PORT=25565
      - MC_AUTH=offline
```

### 3. 启动

```bash
docker-compose up -d
```

### 4. 访问

浏览器打开 `http://你的IP:3800`

默认账号：`admin` / `password`，首次登录后请修改。

## 快速开始（非 Docker）

### 环境要求

- **Node.js** v20 LTS（推荐 v20.x）
- **Python 3**（用于 STT 语音识别）
- **Minecraft Java Edition**（服务端或客户端，需开启 LAN）

### 1. 克隆项目

```bash
git clone https://github.com/Zlmetal/mc-ai-bot-v2.git
cd mc-ai-bot-v2
```

### 2. 安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 安装 MindCraft 依赖
cd mindcraft
npm install
cd ..

# 安装 Python 依赖（STT 语音识别）
pip install edge-tts faster-whisper
```

### 3. 配置

编辑 `data/config.json`，配置 MC 服务器地址和 API Key：

```json
{
  "bots": [{
    "id": "bot_1",
    "name": "你的Minecraft名字",
    "enabled": true,
    "personality": "勤劳、好奇",
    "style": "说话简洁",
    "model": {
      "api": "openai",
      "model": "mimo-v2.5",
      "url": "https://api.xiaomimimo.com/v1"
    },
    "apiKey": "你的API Key"
  }],
  "mc": {
    "host": "127.0.0.1",
    "port": 25565,
    "version": "1.21.11",
    "auth": "offline"
  }
}
```

### 4. 启动

```bash
# Linux / macOS
./start.sh

# Windows
node src/main.js
```

浏览器打开 `http://localhost:3000`

## 配置体系

三层配置，从简到繁：

| 层级 | 页面 | 用途 |
|------|------|------|
| **全局设置** | settings.html | MC 服务器、Web 认证、TTS、唤醒词 |
| **Bot 管理** | bots.html | 增删改查 Bot，配置性格、模型、视觉、记忆 |
| **高级设置** | advanced.html | 直接编辑 MindCraft settings.js |

## 目录结构

```
mc-ai-bot-v2/
├── src/                         # 后端代码（本项目）
│   ├── main.js                  # 入口：Web 服务 + API + WebSocket
│   ├── memory.js                # SQLite 记忆系统
│   ├── tts.js                   # 语音合成（Edge-TTS / MiMo TTS）
│   └── stt.js                   # 语音识别（faster-whisper）
├── public/                      # 前端页面（本项目）
│   ├── index.html               # 聊天页面
│   ├── settings.html            # 全局设置
│   ├── bots.html                # Bot 管理
│   ├── advanced.html            # 高级设置
│   └── login.html               # 登录页面
├── mindcraft/                   # MindCraft 原项目（不修改）
│   ├── main.js                  # MindCraft 入口
│   ├── profiles/                # Bot Profile
│   ├── bots/                    # 记忆文件
│   └── settings.js              # MindCraft 配置
├── data/                        # 持久化数据（Docker volume）
│   ├── config.json              # 本项目配置
│   ├── profiles/                # Profile 备份
│   ├── bots/                    # 记忆备份
│   └── mindcraft-settings.js    # settings.js 备份
├── Dockerfile                   # Docker 构建
├── start.sh                     # 启动脚本
└── package.json
```

## 支持的 API

MindCraft 支持多种 AI 模型：

| 提供商 | 模型示例 | API 地址 |
|--------|----------|----------|
| MiMo | mimo-v2.5, mimo-v2.5-pro | https://api.xiaomimimo.com/v1 |
| OpenAI | gpt-4o, gpt-4o-mini | https://api.openai.com/v1 |
| DeepSeek | deepseek-chat | https://api.deepseek.com/v1 |
| Google | gemini-2.5-pro | https://generativelanguage.googleapis.com/v1beta |
| Anthropic | claude-sonnet-4-20250514 | https://api.anthropic.com/v1 |
| Ollama | llama3, qwen2 | http://localhost:11434/v1 |

## 常用操作

### 添加新 Bot

1. Web 界面 → 设置 → Bot 管理 → + 添加 Bot
2. 填写名字、性格、模型、API Key
3. 保存后自动重启

### 开启视觉功能

1. Bot 管理 → 编辑 Bot → 勾选「允许视觉」
2. 确保 vision_model 已配置
3. Docker 环境自动启用 Xvfb 虚拟显示 + Intel GPU 硬件加速（无 GPU 时回退到软件渲染）

### 更新版本

```bash
# Docker
docker-compose down
docker pull ghcr.io/zlmetal/mc-ai-bot-v2:main
docker-compose up -d

# 非 Docker
git pull
npm install
# 重启进程
```

所有配置和记忆保存在 `data/` 目录，更新不会丢失。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MC_HOST` | Minecraft 服务器地址 | host.docker.internal |
| `MC_PORT` | Minecraft 服务器端口 | 25565 |
| `MC_AUTH` | 认证方式（offline/microsoft） | offline |
| `MC_VERSION` | Minecraft 版本 | 1.21.11 |

## 常见问题

**Q: Bot 无法连接 Minecraft 服务器？**
A: 检查 MC_HOST 和 MC_PORT。Docker 环境下如果 MC 在宿主机运行，使用 `host.docker.internal`。

**Q: API Key 报错？**
A: 在 Bot 管理页面重新填写 API Key。遮蔽显示的 `...` 不是真实 Key。

**Q: 记忆丢失？**
A: 确保 `data/` 目录正确挂载（Docker）或存在（非 Docker）。记忆每 10 秒自动备份，容器停止时也会备份。

**Q: 如何使用正版账号？**
A: 设置 MC_AUTH 为 `microsoft`，Bot 名字需与微软账号的 Minecraft 名字一致。

**Q: 视觉功能不工作？**
A: 在 Bot 管理页面开启「允许视觉」并配置视觉模型。Docker 环境自动启用 Xvfb + Intel GPU 硬件加速（无 GPU 时回退到软件渲染）。

## 致谢

- [MindCraft](https://github.com/mindcraft-bots/mindcraft) — AI Bot 引擎
- [Mineflayer](https://prismarinejs.github.io/mineflayer/) — Minecraft 协议库
- [Edge-TTS](https://github.com/rany2/edge-tts) — 微软语音合成
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — Whisper 语音识别

## License

MIT
