#!/bin/bash

# 启动 MindCraft（后台运行）
cd /app/mindcraft
node main.js &
MINDCRAFT_PID=$!

# 等待 MindCraft 启动
sleep 5

# 启动 Web 服务
cd /app
node src/main.js &
WEB_PID=$!

# 等待任意进程退出
wait -n $MINDCRAFT_PID $WEB_PID
