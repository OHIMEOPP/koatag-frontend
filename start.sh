#!/bin/bash

# 启动 Node.js 应用
node index.js &

# 启动 Nginx
nginx -g 'daemon off;'
