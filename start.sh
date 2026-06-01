#!/bin/bash

echo "[启动] MC AI Bot V2 启动中..."

# 启动虚拟显示（支持 allow_vision）
if command -v Xvfb &> /dev/null; then
  export DISPLAY=:99
  Xvfb :99 -screen 0 1024x768x24 -ac &> /dev/null &
  export LIBGL_ALWAYS_SOFTWARE=1
  echo "[启动] Xvfb 虚拟显示已启动"
fi

# 从环境变量读取配置
MC_HOST=${MC_HOST:-host.docker.internal}
MC_PORT=${MC_PORT:-25565}
MC_AUTH=${MC_AUTH:-offline}
MC_VERSION=${MC_VERSION:-1.21.11}

echo "[启动] MC 服务器: $MC_HOST:$MC_PORT"

# 读取配置文件中的 bot 名字
BOT_NAME="andrew"
if [ -f /app/data/config.json ]; then
  # 优先读取新格式 config.bots，兼容旧格式 config.bot
  PARSED_NAME=$(python3 -c "import json; d=json.load(open('/app/data/config.json')); bots=d.get('bots',[]); print(bots[0]['name'] if bots else d.get('bot',{}).get('name','andrew'))" 2>/dev/null)
  if [ -n "$PARSED_NAME" ] && [ "$PARSED_NAME" != "None" ]; then
    BOT_NAME="$PARSED_NAME"
  fi
fi
echo "[启动] Bot 名字: $BOT_NAME"

# 恢复备份的 profile 到 MindCraft 目录
restore_profile() {
  local name="$1"
  mkdir -p /app/mindcraft/profiles
  mkdir -p /app/mindcraft/bots
  # 从 data 备份恢复（备份存在就覆盖）
  if [ -f "/app/data/profiles/$name.json" ]; then
    cp "/app/data/profiles/$name.json" "/app/mindcraft/profiles/$name.json"
    echo "[启动] 从备份恢复 profile: $name.json"
  fi
}

# 备份 profile 到 data 目录
backup_profile() {
  local name="$1"
  mkdir -p /app/data/profiles
  if [ -f "/app/mindcraft/profiles/$name.json" ]; then
    cp "/app/mindcraft/profiles/$name.json" "/app/data/profiles/$name.json"
  fi
}

# 从备份恢复 bots 目录（记忆等，备份存在就覆盖）
restore_bots() {
  mkdir -p /app/mindcraft/bots
  if [ -d /app/data/bots ]; then
    cp -r /app/data/bots/* /app/mindcraft/bots/ 2>/dev/null
    echo "[启动] 从备份恢复 bots 目录"
  fi
}

# 备份 bots 目录到 data
backup_bots() {
  mkdir -p /app/data/bots
  if [ -d /app/mindcraft/bots ]; then
    cp -r /app/mindcraft/bots/* /app/data/bots/ 2>/dev/null
  fi
}

# 停止时备份
cleanup() {
  echo "[停止] 备份记忆..."
  backup_bots
  echo "[停止] 完成"
}
trap cleanup SIGTERM SIGINT EXIT

# 生成 MindCraft 配置
generate_settings() {
  # 重新读取最新的 bot 名字
  if [ -f /app/data/config.json ]; then
    local name=$(python3 -c "import json; d=json.load(open('/app/data/config.json')); bots=d.get('bots',[]); print(bots[0]['name'] if bots else d.get('bot',{}).get('name','andrew'))" 2>/dev/null)
    if [ -n "$name" ] && [ "$name" != "None" ]; then
      BOT_NAME="$name"
    fi
  fi

  # 先尝试从备份恢复
  restore_profile "$BOT_NAME"
  restore_bots

  # 仅当 profile 不存在时才生成
  if [ ! -f "/app/mindcraft/profiles/$BOT_NAME.json" ]; then
    echo "{\"name\":\"$BOT_NAME\",\"model\":{\"api\":\"openai\",\"model\":\"mimo-v2.5\",\"url\":\"https://api.xiaomimimo.com/v1\"},\"vision_model\":{\"api\":\"openai\",\"model\":\"mimo-v2.5\",\"url\":\"https://api.xiaomimimo.com/v1\"}}" > "/app/mindcraft/profiles/$BOT_NAME.json"
    echo "[启动] 创建 profile: $BOT_NAME.json"
  else
    echo "[启动] 使用已有 profile: $BOT_NAME.json"
  fi

  # 备份 profile
  backup_profile "$BOT_NAME"

  # 从备份恢复 settings.js（备份存在就覆盖）
  if [ -f /app/data/mindcraft-settings.js ]; then
    cp /app/data/mindcraft-settings.js /app/mindcraft/settings.js
    echo "[启动] 从备份恢复 settings.js"
  fi

  # 仅当 settings.js 不存在时才生成
  if [ ! -f /app/mindcraft/settings.js ]; then
    cat > /app/mindcraft/settings.js << 'SETTINGSEOF'
const settings = {
    "minecraft_version": "MCVER",
    "host": "MCHOST",
    "port": MCPORT,
    "auth": "MCAUTH",
    "mindserver_port": 8080,
    "auto_open_ui": false,
    "base_profile": "assistant",
    "profiles": ["./profiles/BOTNAME.json"],
    "load_memory": false,
    "init_message": "HELLOMSG",
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
SETTINGSEOF
    # 替换占位符
    sed -i "s/MCVER/$MC_VERSION/g" /app/mindcraft/settings.js
    sed -i "s/MCHOST/$MC_HOST/g" /app/mindcraft/settings.js
    sed -i "s/MCPORT/$MC_PORT/g" /app/mindcraft/settings.js
    sed -i "s/MCAUTH/$MC_AUTH/g" /app/mindcraft/settings.js
    sed -i "s/BOTNAME/$BOT_NAME/g" /app/mindcraft/settings.js
    sed -i "s|HELLOMSG|大家好！我是$BOT_NAME|g" /app/mindcraft/settings.js
    echo "[启动] settings.js 已生成"
  else
    echo "[启动] 使用已有 settings.js"
  fi

  # 确保关键字段正确
  if [ -f /app/mindcraft/settings.js ]; then
    python3 -c "
import json, os
# 读取 config.json 获取 bot 名字
bots = []
config_path = '/app/data/config.json'
if os.path.exists(config_path):
    with open(config_path, 'r') as f:
        cfg = json.load(f)
    if 'bots' in cfg:
        bots = [b['name'] for b in cfg['bots'] if b.get('enabled', True)]
    elif 'bot' in cfg:
        bots = [cfg['bot'].get('name', 'andrew')]
if not bots:
    bots = ['andrew']
# 读取并更新 settings.js
with open('/app/mindcraft/settings.js', 'r') as f:
    content = f.read()
start = content.find('{')
end = content.rfind('}')
if start != -1 and end > start:
    obj = json.loads(content[start:end+1])
    obj['host'] = '$MC_HOST'
    obj['port'] = $MC_PORT
    obj['auth'] = '$MC_AUTH'
    obj['profiles'] = ['./profiles/' + name + '.json' for name in bots]
    new_content = 'const settings = ' + json.dumps(obj, indent=4, ensure_ascii=False) + '\nexport default settings\n'
    with open('/app/mindcraft/settings.js', 'w') as f:
        f.write(new_content)
"
    echo "[启动] settings.js 关键字段已修正"
  fi
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
    echo "[启动] MindCraft 已启动"
    break
  fi
  sleep 2
done

# 启动 Web 服务
cd /app
echo "[启动] 启动 Web 服务..."
node src/main.js &
WEB_PID=$!

echo "[启动] 所有服务已启动"

# 监听重启标记
BACKUP_COUNTER=0
while true; do
  sleep 3
  BACKUP_COUNTER=$((BACKUP_COUNTER + 1))
  # 每 10 秒备份一次 bots 目录（记忆）
  if [ $BACKUP_COUNTER -ge 3 ]; then
    backup_bots
    BACKUP_COUNTER=0
  fi
  if [ -f /app/data/.restart ]; then
    rm -f /app/data/.restart
    echo ""
    echo "========================================="
    echo "[重启] 配置变更，重启 MindCraft..."
    echo "========================================="
    # 重新读取 bot 名字
    if [ -f /app/data/config.json ]; then
      NEW_NAME=$(python3 -c "import json; d=json.load(open('/app/data/config.json')); bots=d.get('bots',[]); print(bots[0]['name'] if bots else d.get('bot',{}).get('name','andrew'))" 2>/dev/null)
      if [ -n "$NEW_NAME" ] && [ "$NEW_NAME" != "None" ] && [ "$NEW_NAME" != "$BOT_NAME" ]; then
        echo "[重启] Bot 名字从 $BOT_NAME 改为 $NEW_NAME"
        if [ -f "/app/mindcraft/profiles/$BOT_NAME.json" ]; then
          mv "/app/mindcraft/profiles/$BOT_NAME.json" "/app/mindcraft/profiles/$NEW_NAME.json"
          # 同步备份
          mkdir -p /app/data/profiles
          cp "/app/mindcraft/profiles/$NEW_NAME.json" "/app/data/profiles/$NEW_NAME.json"
          rm -f "/app/data/profiles/$BOT_NAME.json"
        fi
        BOT_NAME="$NEW_NAME"
        if [ -f /app/mindcraft/settings.js ]; then
          sed -i "s|./profiles/[^\"]*.json|./profiles/$BOT_NAME.json|g" /app/mindcraft/settings.js
        fi
      fi
    fi
    generate_settings
    stop_mindcraft
    start_mindcraft
    echo "[重启] MindCraft 已重启"
    for i in $(seq 1 15); do
      if curl -s http://localhost:8080 > /dev/null 2>&1; then
        echo "[重启] MindServer 已就绪"
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
