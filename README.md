# 🎮 MC AI Bot V2 — Minecraft AI 玩家

> 基于 [MindCraft](https://github.com/mindcraft-bots/mindcraft) 引擎，让 AI 像真人玩家一样在你的 Minecraft 服务器中活动。支持手机端语音/文字聊天、记忆系统、网页配置，Docker 一键部署。

[![Docker Image](https://img.shields.io/badge/Docker-ghcr.io%2Fzlmetal%2Fmc--ai--bot--v2-blue)](https://github.com/Zlmetal/mc-ai-bot-v2/pkgs/container/mc-ai-bot-v2)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

## ✨ 功能

| 功能 | 说明 |
|------|------|
| 🎮 自主游戏 | 探索、挖矿、建造、战斗、合成、与其他玩家聊天 |
| 📱 手机聊天 | 网页随时对话，支持文字和语音 |
| 📞 实时通话 | 按一下开启，说话自动识别，像打电话一样 |
| 🧠 记忆系统 | 记住玩家偏好、事件、地点、人物关系 |
| 🔊 语音回复 | Edge-TTS 合成，8 个中文音色可选 |
| 🔐 登录保护 | 账号密码认证，支持 Lucky 反代 HTTPS |
| ⚙️ 网页配置 | 浏览器完成所有设置 |
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

支持通过 [Lucky](https://github.com/lucky-app/lucky) 反代为 HTTPS，外网访问更安全。

## 🎤 语音功能

| 模式 | 说明 | 环境要求 |
|------|------|----------|
| 🎤 按住说话 | 按住录音，松开识别 | HTTPS |
| 📞 实时通话 | 按一下开启，自动检测说话 | HTTPS |
| 💬 文字聊天 | 键盘输入 | 无限制 |

> 语音功能需要 HTTPS 环境（浏览器安全限制）。推荐用 Tailscale 或 Lucky 反代。

## 支持的 LLM

| 提供者 | API 地址 | 推荐模型 |
|--------|----------|----------|
| **MiMo** | `https://api.xiaomimimo.com/v1` | mimo-v2.5 |
| DeepSeek | `https://api.deepseek.com` | deepseek-chat |
| OpenAI | `https://api.openai.com` | gpt-4o-mini |
| Ollama | `http://localhost:11434` | qwen2.5:7b |

## License

MIT
