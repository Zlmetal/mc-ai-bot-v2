# 🎮 MC AI Bot V2

基于 [MindCraft](https://github.com/mindcraft-bots/mindcraft) 的 Minecraft AI 玩家方案，支持多 Bot 管理、Web 聊天、语音交互、记忆持久化。

## 功能特性

- **多 Bot 管理** — 支持创建多个 AI Bot，每个 Bot 独立配置名字、性格、模型
- **Web 聊天界面** — 手机/电脑浏览器直接与游戏内 AI 对话
- **语音交互** — 支持语音输入（STT）、语音合成（TTS）、实时通话、唤醒词
- **记忆系统** — Bot 记忆持久化，重启不丢失
- **高级设置** — 直接编辑 MindCraft settings.js，可视化配置所有参数
- **视觉模型** — 支持配置 vision_model，AI 可分析游戏截图

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

复制并编辑配置文件：

```bash
mkdir -p data
cp data/config.example.json data/config.json 2>/dev/null || true
```

编辑 `data/config.json`，配置你的 MC 服务器地址和 API Key：

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

### 4. 启动 Minecraft

打开 Minecraft，进入单人世界，按 Esc → 对局域网开放，端口设为 `25565`。

### 5. 启动 Bot

```bash
# Linux / macOS
./start.sh

# Windows
node src/main.js
```

首次启动会自动：
- 生成 MindCraft 配置文件（`mindcraft/settings.js`）
- 生成 Bot Profile（`mindcraft/profiles/你的名字.json`）
- 同步 API Key

### 6. 访问 Web 界面

浏览器打开 `http://localhost:3000`

### 目录结构

```
mc-ai-bot-v2/
├── src/                    # 后端代码
│   ├── main.js             # 入口（Web 服务 + API + WebSocket）
│   ├── memory.js           # 记忆系统
│   ├── tts.js              # 语音合成
│   └── stt.js              # 语音识别
├── public/                 # 前端页面
│   ├── index.html          # 聊天页面
│   ├── settings.html       # 全局设置
│   ├── bots.html           # Bot 管理
│   ├── advanced.html       # 高级设置
│   └── login.html          # 登录页面
├── mindcraft/              # MindCraft 原项目（不修改）
├── data/                   # 持久化数据
│   ├── config.json         # 配置文件
│   ├── profiles/           # Bot Profile 备份
│   ├── bots/               # 记忆备份
│   └── mindcraft-settings.js  # settings.js 备份
├── start.sh                # 启动脚本（Linux）
└── package.json
```

## 配置说明

### Bot 配置

| 字段 | 说明 |
|------|------|
| `name` | Bot 在游戏内的名字，需与 Minecraft 玩家名一致 |
| `personality` | 性格特征，如"勤劳、好奇、喜欢探索" |
| `style` | 说话风格，如"说话简洁但有温度" |
| `model` | AI 模型配置（api、model、url） |
| `vision_model` | 视觉模型配置（可选，用于分析游戏截图） |
| `apiKey` | 对应模型的 API Key |

### 支持的 API

MindCraft 支持多种 AI 模型提供商：

| 提供商 | 模型示例 | API 地址 |
|--------|----------|----------|
| MiMo | mimo-v2.5, mimo-v2.5-pro | https://api.xiaomimimo.com/v1 |
| OpenAI | gpt-4o, gpt-4o-mini | https://api.openai.com/v1 |
| DeepSeek | deepseek-chat | https://api.deepseek.com/v1 |
| Google | gemini-2.5-pro | https://generativelanguage.googleapis.com/v1beta |
| Ollama | llama3, qwen2 | http://localhost:11434/v1 |

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MC_HOST` | Minecraft 服务器地址 | host.docker.internal |
| `MC_PORT` | Minecraft 服务器端口 | 25565 |
| `MC_AUTH` | 认证方式（offline/microsoft） | offline |
| `MC_VERSION` | Minecraft 版本 | 1.21.11 |

## 常用操作

### 添加新 Bot

1. 打开 Web 界面 → 设置 → Bot 管理
2. 点击「+ 添加 Bot」
3. 填写名字、性格、模型、API Key
4. 保存后 MindCraft 自动重启

### 修改 Bot 性格

1. 设置 → Bot 管理 → 点击 Bot 名字展开编辑
2. 修改性格特征和说话风格
3. 保存后立即生效

### 开启视觉功能

1. 高级设置 → `allow_vision` 设为 `false`（不需要 GPU 渲染）
2. Bot 管理 → 为 Bot 配置 `vision_model`
3. AI 即可通过截图分析游戏画面

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

## 常见问题

**Q: Bot 无法连接 Minecraft 服务器？**
A: 检查 MC_HOST 和 MC_PORT 是否正确。Docker 环境下，如果 MC 在宿主机运行，使用 `host.docker.internal`。

**Q: API Key 报错？**
A: 在设置页面或 Bot 管理页面重新填写 API Key。遮蔽显示的 `...` 不是真实 Key。

**Q: 记忆丢失？**
A: 确保 `data/` 目录正确挂载（Docker）或存在（非 Docker）。记忆每 10 秒自动备份。

**Q: 如何使用正版账号？**
A: 设置 MC_AUTH 为 `microsoft`，Bot 名字需与微软账号的 Minecraft 名字一致。

## License

MIT
