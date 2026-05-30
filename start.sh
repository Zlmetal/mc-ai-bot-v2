#!/bin/bash

echo "[启动] MC AI Bot V2 启动中..."

# 从环境变量读取配置
MC_HOST=${MC_HOST:-host.docker.internal}
MC_PORT=${MC_PORT:-25565}
MC_AUTH=${MC_AUTH:-offline}
MC_VERSION=${MC_VERSION:-1.21.11}

echo "[启动] MC 服务器: $MC_HOST:$MC_PORT"

# 读取配置文件中的 bot 名字
BOT_NAME="andrew"
if [ -f /app/data/config.json ]; then
  PARSED_NAME=$(python3 -c "import json; d=json.load(open('/app/data/config.json')); print(d.get('bot',{}).get('name','andrew'))" 2>/dev/null)
  if [ -n "$PARSED_NAME" ] && [ "$PARSED_NAME" != "None" ]; then
    BOT_NAME="$PARSED_NAME"
  fi
fi
echo "[启动] Bot 名字: $BOT_NAME"

# 生成 MindCraft settings.js
generate_settings() {
  # 重新读取最新的 bot 名字
  if [ -f /app/data/config.json ]; then
    local name=$(python3 -c "import json; d=json.load(open('/app/data/config.json')); print(d.get('bot',{}).get('name','andrew'))" 2>/dev/null)
    if [ -n "$name" ] && [ "$name" != "None" ]; then
      BOT_NAME="$name"
    fi
  fi

  # 确保 profile 文件存在
  mkdir -p /app/mindcraft/profiles
  if [ ! -f "/app/mindcraft/profiles/$BOT_NAME.json" ]; then
    echo "{\"name\":\"$BOT_NAME\",\"model\":{\"api\":\"openai\",\"model\":\"mimo-v2.5\",\"url\":\"https://api.xiaomimimo.com/v1\"}}" > "/app/mindcraft/profiles/$BOT_NAME.json"
    echo "[启动] 创建 profile: $BOT_NAME.json"
  fi

  cat > /app/mindcraft/settings.js << EOF
const settings = {
    "minecraft_version": "$MC_VERSION",
    "host": "$MC_HOST",
    "port": $MC_PORT,
    "auth": "$MC_AUTH",
    "mindserver_port": 8080,
    "auto_open_ui": false,
    "base_profile": "assistant",
    "profiles": ["./profiles/$BOT_NAME.json"],
    "load_memory": false,
    "init_message": "大家好！我是$BOT_NAME",
    "only_chat_with": [],
    "speak": false,
    "chat_ingame": true,
    "language": "zh-CN",
    "render_bot_view": false,
    "allow_insecure_coding": false,
    "allow_vision": false,
    "blocked_actions": ["!checkBlueprint","!checkBlueprintLevel","!getBlueprint","!getBlueprintLevel"],
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
  echo "[启动] settings.js 已生成 (Bot: $BOT_NAME)"
}

generate_settings

# 同步 API Key
cd /app && node src/sync-keys.js 2>/dev/null

# MindCraft 进程管理
MINDCRAFT_PID=""

# 启动 MindCraft
start_mindcraft() {
  generate_settings
  cd /app/mindcraft
  echo "[MindCraft] 启动中..."
  node main.js &
  MINDCRAFT_PID=$!
  echo "[MindCraft] PID: $MINDCRAFT_PID"
}

# 停止 MindCraft
stop_mindcraft() {
  if [ -n "$MINDCRAFT_PID" ]; then
    kill $MINDCRAFT_PID 2>/dev/null
    wait $MINDCRAFT_PID 2>/dev/null
    MINDCRAFT_PID=""
  fi
  # 杀掉所有占用 8080 端口的 node 进程
  for pid in $(ss -tlnp 'sport = :8080' 2>/dev/null | grep -oP 'pid=\K[0-9]+'); do
    kill -9 $pid 2>/dev/null
  done
  sleep 1
}

# 初始启动
stop_mindcraft
start_mindcraft

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

# 监听重启标记
while true; do
  sleep 3
  if [ -f /app/data/.restart ]; then
    rm -f /app/data/.restart
    echo ""
    echo "========================================="
    echo "[重启] 配置变更，重启 MindCraft..."
    echo "========================================="
    stop_mindcraft
    start_mindcraft
    echo "[重启] ✅ MindCraft 已重启 (PID: $MINDCRAFT_PID)"
    # 等待启动
    for i in $(seq 1 15); do
      if curl -s http://localhost:8080 > /dev/null 2>&1; then
        echo "[重启] ✅ MindServer 已就绪"
        break
      fi
      sleep 2
    done
  fi
  # 检查 MindCraft 是否意外退出
  if [ -n "$MINDCRAFT_PID" ] && ! kill -0 $MINDCRAFT_PID 2>/dev/null; then
    echo "[MindCraft] 进程意外退出，重新启动..."
    start_mindcraft
  fi
done
