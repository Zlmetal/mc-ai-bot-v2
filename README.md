# 🎮 MC AI Bot V2 — 基于 MindCraft 的 Minecraft AI 玩家

基于 [MindCraft](https://github.com/mindcraft-bots/mindcraft) + Web 界面 + 记忆系统 + 语音交互的完整方案。

## ✨ 功能

- 🎮 **AI 玩家**：基于 MindCraft 的成熟 Bot 引擎，自主探索、挖矿、建造、战斗
- 📱 **手机聊天**：手机网页随时与 AI 对话
- 🎤 **语音交互**：按住说话，AI 语音回复
- 🧠 **记忆系统**：记住玩家偏好、事件、地点
- ⚙️ **网页配置**：浏览器完成所有配置
- 🔌 **模型可换**：MiMo、DeepSeek、OpenAI 等

## 🚀 部署

### 飞牛 NAS

1. SSH 登录飞牛，执行：

```bash
# 安装 git
apt update && apt install -y git

# 克隆项目
cd /vol1/1000/Docker
git clone https://github.com/Zlmetal/mc-ai-bot-v2.git
cd mc-ai-bot-v2

# 克隆 MindCraft
git clone https://github.com/mindcraft-bots/mindcraft.git mindcraft

# 启动
docker-compose up -d
```

2. 浏览器打开 `http://飞牛IP:3800/settings.html` 填配置

### 通用 Linux

```bash
git clone https://github.com/Zlmetal/mc-ai-bot-v2.git
cd mc-ai-bot-v2
git clone https://github.com/mindcraft-bots/mindcraft.git mindcraft
docker-compose up -d
```

## 配置

访问 `http://IP:3800/settings.html`：

1. **MindCraft 连接**：地址填 `mindcraft`（Docker 内部网络）
2. **MC 服务器**：填你的服务器地址和端口
3. **AI 大脑**：选 MiMo，填 API Key
4. **语音**：启用 TTS
5. **人设**：设置 AI 名字和性格

## 架构

```
┌──────────────┐    ┌──────────────────┐
│ MindCraft    │    │ Web 服务          │
│ (端口 8080)  │◄──►│ (端口 3800)       │
│ - Bot 引擎   │    │ - 聊天界面       │
│ - 游戏连接   │    │ - 记忆系统       │
│ - 任务系统   │    │ - 语音交互       │
└──────────────┘    └──────────────────┘
        │
        ▼
  MC 服务器
```

## 📄 License

MIT
