# 使用 Node.js 官方镜像作为基础镜像
FROM node:20 AS build

# 设置工作目录
WORKDIR /app

# 将 package.json 和 package-lock.json 复制到工作目录
COPY package*.json ./

# 安装依赖
RUN npm install

# 将项目文件复制到工作目录
COPY . .

# 构建项目
RUN npm run build

# 使用 nginx 镜像来服务静态文件
FROM nginx:alpine

# 将 Vite 构建生成的文件复制到 nginx 的服务目录
COPY --from=build /app/dist /usr/share/nginx/html

# 暴露 nginx 默认端口
EXPOSE 80

# 启动 nginx 服务
CMD ["nginx", "-g", "daemon off;"]

