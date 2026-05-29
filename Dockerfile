FROM node:20-slim

# 安装依赖（包括 OpenGL 库和 python）
RUN apt-get update && apt-get install -y \
    python3 \
    python3-distutils \
    make \
    g++ \
    git \
    curl \
    libgl1-mesa-glx \
    libglu1-mesa \
    libxi6 \
    libxrandr2 \
    libxxf86vm1 \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 克隆 MindCraft
RUN git clone https://github.com/mindcraft-bots/mindcraft.git mindcraft

# 安装 MindCraft 依赖（忽略 gl 模块的编译错误）
WORKDIR /app/mindcraft
RUN npm install --ignore-scripts || true
RUN npm rebuild || true

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
