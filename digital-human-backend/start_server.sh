#!/bin/bash
# 启动数字人后端服务

echo "正在启动数字人后端服务..."
echo ""

# 检查是否在conda环境中
python --version
echo ""

# 启动FastAPI服务器
python -m app.main

