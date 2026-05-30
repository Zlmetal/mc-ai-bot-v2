#!/bin/bash

echo "[启动] MC AI Bot V2 启动中..."

# 从环境变量读取配置
MC_HOST=${MC_HOST:-host.docker.internal}
MC_PORT=${MC_PORT:-25565}
MC_AUTH=${MC_AUTH:-offline}
MC_VERSION=${MC_VERSION:-1.21.11}

echo "[启动] MC 服务器: $MC_HOST:$MC_PORT"
echo "[启动] 协议版本: $MC_VERSION (兼容 1.21.10)"

# 生成 MindCraft 的 settings.js
cat > /app/mindcraft/settings.js << EOF
const settings = {
    "minecraft_version": "$MC_VERSION",
    "host": "$MC_HOST",
    "port": $MC_PORT,
    "auth": "$MC_AUTH",
    "mindserver_port": 8080,
    "auto_open_ui": false,
    "base_profile": "assistant",
    "profiles": [
        "./profiles/andrew.json"
    ],
    "load_memory": false,
    "init_message": "大家好！我是AI玩家",
    "only_chat_with": [],
    "speak": false,
    "chat_ingame": true,
    "language": "zh",
    "render_bot_view": false,
    "allow_insecure_coding": false,
    "allow_vision": false,
    "blocked_actions": ["!checkBlueprint", "!checkBlueprintLevel", "!getBlueprint", "!getBlueprintLevel"],
    "code_timeout_mins": -1,
    "relevant_docs_count": 5,
    "max_messages": 15,
    "num_examples": 2,
    "max_commands": -1,
    "show_command_syntax": "full",
    "narrate_behavior": true,
    "chat_bot_messages": true,
    "spawn_timeout": 60,
    "block_place_delay": 0,
    "log_all_prompts": false
}

export default settings
EOF

echo "[启动] MindCraft settings.js 已生成"

# 首次同步 API Key
cd /app && node src/sync-keys.js

# 显示 keys.json 内容（调试用）
echo "[启动] keys.json 内容:"
cat /app/mindcraft/keys.json

# 后台循环：每 30 秒同步一次 API Key
(
  while true; do
    sleep 30
    cd /app && node src/sync-keys.js 2>/dev/null
  done
) &
SYNC_PID=$!

# 启动 MindCraft（带自动重启）
cd /app/mindcraft

start_mindcraft() {
  echo "[MindCraft] 启动中..."
  node main.js
  echo "[MindCraft] 进程退出，5秒后重启..."
  sleep 5
}

# 循环启动 MindCraft，崩溃自动重启
(
  while true; do
    start_mindcraft
  done
) &
MINDCRAFT_PID=$!

# 等待 MindServer 启动
echo "[启动] 等待 MindCraft 启动..."
for i in $(seq 1 30); do
  if curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo "[启动] ✅ MindCraft 已启动"
    break
  fi
  sleep 2
done

# 启动 Web 服务
cd /app
echo "[启动] 启动 Web 服务..."
node src/main.js &
WEB_PID=$!

echo "[启动] ✅ 所有服务已启动"
echo "[启动] Web: http://localhost:3000"
echo "[启动] MindCraft: http://localhost:8080"

# 等待
wait
