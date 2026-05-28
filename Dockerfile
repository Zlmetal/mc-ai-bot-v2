FROM node:20-slim

# 安装依赖
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 克隆 MindCraft
RUN git clone https://github.com/mindcraft-bots/mindcraft.git mindcraft

# 安装 MindCraft 依赖
WORKDIR /app/mindcraft
RUN npm install

# 复制 Web 服务
WORKDIR /app
COPY src/ ./src/
COPY public/ ./public/
COPY package.json ./
RUN npm install

# 创建数据目录
RUN mkdir -p data/voices

# 启动脚本
COPY start.sh ./
RUN chmod +x start.sh

EXPOSE 3000 8080

CMD ["./start.sh"]
