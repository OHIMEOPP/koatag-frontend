# 建構階段
FROM node:20 AS build
WORKDIR /app

# 安裝相依
COPY package*.json ./
RUN npm install --force

# 複製程式碼
COPY . .

# 建構 React 靜態檔案
RUN npm run build

# -----
# 部署階段，用 nginx serve
FROM nginx:stable-alpine

# 移除預設 nginx 靜態檔案
RUN rm -rf /usr/share/nginx/html/*

# 複製 React build 出來的檔案到 nginx
COPY --from=build /app/build /usr/share/nginx/html

# 複製 nginx 設定檔 (可選)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
