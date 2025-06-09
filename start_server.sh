#!/bin/bash

# 检查必要的Python包
echo "检查必要的Python包..."
pip install flask flask-socketio flask-cors eventlet transformers torch edge-tts

# 如果没有指定参数，则使用默认选项
if [ "$#" -eq 0 ]; then
    # 创建临时音频目录
    mkdir -p ./temp_audio

    # 启动服务器
    echo "启动语音助手服务器..."
    python scene_voice_server.py --debug
else
    # 创建临时音频目录
    mkdir -p ./temp_audio

    # 使用传递的参数启动服务器
    echo "启动语音助手服务器..."
    python scene_voice_server.py "$@"
fi 