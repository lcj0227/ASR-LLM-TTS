#!/bin/bash
# 启动数字人前端服务

echo "正在启动数字人前端服务..."
echo ""

# 检查Node.js
node --version
echo ""

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
fi

# 启动开发服务器
npm start

