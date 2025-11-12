# 使用官方 Node.js 镜像
FROM node:20-alpine

# 设置上海时区
ENV TZ=Asia/Shanghai

# 设置工作目录
WORKDIR /chess

RUN npm config set registry https://registry.npmmirror.com

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install pm2 -g && npm install

# 复制项目文件
COPY . .

RUN npm run build

# 暴露端口
EXPOSE 9099
EXPOSE 7005

# 启动 PM2 进程管理
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
