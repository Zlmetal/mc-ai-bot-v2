FROM node:20-slim

# 安装编译依赖
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制 package.json 并安装依赖
COPY package.json ./
RUN npm install --production

# 复制源代码
COPY src/ ./src/
COPY public/ ./public/

# 创建数据目录
RUN mkdir -p data/voices

EXPOSE 3000

CMD ["node", "src/main.js"]
