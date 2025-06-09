#!/bin/bash

# 安装依赖库
echo "安装必要的依赖库..."
pip install edge-tts flask flask-cors uvicorn nest-asyncio

# 启动TTS API服务
echo "启动TTS API服务..."
python tts_api.py 