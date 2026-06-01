FROM node:20-slim

# 安装依赖（包括 OpenGL 库、Xvfb 虚拟显示、Mesa 软件渲染）
RUN apt-get update && apt-get install -y \
    python3 \
    python3-distutils \
    python3-pip \
    make \
    g++ \
    git \
    curl \
    iproute2 \
    xvfb \
    libgl1-mesa-dri \
    libgl1-mesa-glx \
    libglu1-mesa \
    libegl1-mesa \
    libxi6 \
    libxrandr2 \
    libxxf86vm1 \
    xauth \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

# 安装 edge-tts 和 faster-whisper (STT)
RUN pip3 install edge-tts faster-whisper --break-system-packages || pip3 install edge-tts faster-whisper

WORKDIR /app

# 克隆 MindCraft
RUN git clone https://github.com/mindcraft-bots/mindcraft.git mindcraft

# 安装 MindCraft 依赖
WORKDIR /app/mindcraft
RUN npm install --ignore-scripts || true
# 编译 gl 原生模块（需要 Mesa OpenGL 头文件）
RUN npm rebuild gl 2>&1 || echo "[warn] gl 编译失败，视觉功能可能不可用"
# 应用补丁
RUN npx patch-package || true

# 打补丁：MindServer 绑定地址 localhost → 0.0.0.0（修复 Docker 内 IPv4/IPv6 问题）
RUN sed -i "s/const host = 'localhost'/const host = '0.0.0.0'/g" src/mindcraft/mindserver.js || true

# 复制 AI 玩家配置
RUN mkdir -p /app/mindcraft/profiles
COPY andrew.json /app/mindcraft/profiles/andrew.json

# 复制 Web 服务
WORKDIR /app
COPY src/ ./src/
COPY public/ ./public/
COPY package.json ./
RUN npm install

# 复制启动脚本
COPY start.sh ./
RUN chmod +x start.sh

# 创建数据目录
RUN mkdir -p data/voices

EXPOSE 3000 8080

CMD ["./start.sh"]
