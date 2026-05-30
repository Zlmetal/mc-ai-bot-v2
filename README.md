# 🎮 MC AI Bot V2 — Minecraft AI 玩家

基于 [MindCraft](https://github.com/mindcraft-bots/mindcraft) 引擎，让 AI 像真人玩家一样在你的 Minecraft 服务器中活动。支持手机端语音/文字聊天、记忆系统、网页配置，Docker 一键部署。

[![Docker Image](https://img.shields.io/badge/Docker-ghcr.io%2Fzlmetal%2Fmc--ai--bot--v2-blue)](https://github.com/Zlmetal/mc-ai-bot-v2/pkgs/container/mc-ai-bot-v2)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## ✨ 功能

| 功能 | 说明 |
|------|------|
| 🎮 自主游戏 | 探索、挖矿、建造、战斗、合成、与其他玩家聊天 |
| 📱 手机聊天 | 网页随时对话，支持文字和语音 |
| 📞 实时通话 | 按一下开启，说话自动识别，像打电话一样 |
| 🧠 记忆系统 | 记住玩家偏好、事件、地点、人物关系 |
| 🔊 语音合成 | 支持 Edge-TTS（免费）和 MiMo TTS（自定义 API） |
| 🔐 登录保护 | 账号密码认证，支持外网安全访问 |
| ⚙️ 网页配置 | 浏览器完成所有设置，无需编辑文件 |
| 🐳 一键部署 | 单个 Docker 镜像 |

## 🚀 快速开始

### 1. MC 服务器白名单

```
/whitelist add andrew
```

### 2. Docker Compose

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
      - MC_HOST=你的MC服务器IP
      - MC_PORT=25565
      - MC_AUTH=offline
```

### 3. 登录

打开 `http://IP:3800`，默认账号 `admin`，默认密码 `password`。

### 4. 配置

登录后点 ⚙️ 进入设置页面，填写 API Key 和 MC 服务器信息。

## 🔐 安全

默认账号密码：`admin` / `password`，建议在设置页面修改。

## 🎤 语音功能

> ⚠️ **语音功能需要 HTTPS 环境**（浏览器安全限制，HTTP 下无法访问麦克风）
>
> 推荐方案：
> - [Tailscale](https://tailscale.com/) — 免费，零配置，手机装 app 即可
> - [Lucky](https://github.com/lucky-app/lucky) 反代 — 配合域名使用
> - Cloudflare Tunnel — 免费，需要域名

| 模式 | 说明 | 环境要求 |
|------|------|----------|
| 🎤 按住说话 | 按住录音，松开识别 | HTTPS |
| 📞 实时通话 | 按一下开启，自动检测说话 | HTTPS |
| 💬 文字聊天 | 键盘输入 | 无限制 |

文字聊天在任何环境下都可用，语音功能仅在 HTTPS 下生效。

## 🔊 语音合成

设置页面支持两种模式：

**Edge-TTS（默认）**
- 免费，内置 8 个中文音色
- 无需 API Key

**MiMo TTS（自定义）**
- 支持 MiMo、OpenAI 等兼容 API
- 自定义 API 地址、Key、模型、音色
- 支持音色设计和音色克隆

## 支持的 LLM

| 提供者 | API 地址 | 推荐模型 |
|--------|----------|----------|
| **MiMo** | `https://api.xiaomimimo.com/v1` | mimo-v2.5 |
| DeepSeek | `https://api.deepseek.com` | deepseek-chat |
| OpenAI | `https://api.openai.com` | gpt-4o-mini |
| Ollama | `http://localhost:11434` | qwen2.5:7b |

## 📁 项目结构

```
mc-ai-bot-v2/
├── src/
│   ├── main.js          # 入口 + Web 服务 + API
│   ├── tts.js           # 语音合成（Edge-TTS + MiMo TTS）
│   ├── stt.js           # 语音识别（Whisper）
│   └── memory.js        # 记忆系统（SQLite）
├── public/
│   ├── index.html       # 聊天界面
│   ├── settings.html    # 设置页面
│   └── login.html       # 登录页面
├── Dockerfile
└── docker-compose.yml
```

## License

MIT
