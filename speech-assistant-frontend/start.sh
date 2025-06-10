#!/bin/bash

echo "启动语音助手前端应用"
echo "====================="
echo "1. 仅启动前端应用"
echo "2. 启动前端应用和场景语音对话后端服务"
read -p "请选择 [1/2]: " choice

case $choice in
  1)
    echo "启动前端应用..."
    npm start
    ;;
  2)
    echo "检查后端服务依赖..."
    if ! command -v python3 &> /dev/null; then
      echo "错误: 未找到 Python3，请先安装 Python3"
      exit 1
    fi
    
    # 检查后端服务文件是否存在
    if [ ! -f "../scene_voice_server.py" ]; then
      echo "场景语音对话后端服务文件不存在，创建示例文件..."
      cat > "../scene_voice_server.py" << 'EOF'
from flask import Flask, request
from flask_socketio import SocketIO, emit
import tempfile
import os
import base64
import wave

app = Flask(__name__)
app.config['SECRET_KEY'] = 'scene-voice-secret'
socketio = SocketIO(app, cors_allowed_origins="*")

# 临时存储音频和图像
audio_chunks = {}
video_frames = {}

@socketio.on('connect')
def handle_connect():
    print('客户端已连接:', request.sid)
    audio_chunks[request.sid] = []
    video_frames[request.sid] = []

@socketio.on('disconnect')
def handle_disconnect():
    print('客户端已断开连接:', request.sid)
    if request.sid in audio_chunks:
        del audio_chunks[request.sid]
    if request.sid in video_frames:
        del video_frames[request.sid]

@socketio.on('audio_data')
def handle_audio_data(data):
    client_id = request.sid
    print(f"收到音频数据，客户端ID: {client_id}")
    
    # 模拟ASR处理
    emit('asr_result', {'text': "这是模拟的语音识别结果"}, room=client_id)
    
    # 模拟LLM响应
    emit('llm_response', {
        'text': "这是一个模拟的多模态回答。这是测试模式，未连接实际的AI模型。",
        'audioUrl': "/demo-audio.mp3"
    }, room=client_id)

@socketio.on('video_frame')
def handle_video_frame(data):
    client_id = request.sid
    print(f"收到视频帧，客户端ID: {client_id}")

if __name__ == '__main__':
    print("启动场景语音对话后端服务，监听端口5000...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
EOF
      echo "已创建示例后端服务文件: ../scene_voice_server.py"
    fi
    
    echo "启动后端服务..."
    # 在后台启动后端服务
    python3 ../scene_voice_server.py &
    BACKEND_PID=$!
    
    echo "启动前端应用..."
    npm start
    
    # 当前端应用关闭时，终止后端服务
    kill $BACKEND_PID
    ;;
  *)
    echo "无效的选择，仅启动前端应用..."
    npm start
    ;;
esac

echo "如果浏览器没有自动打开，请访问: http://localhost:3000"

# 语音助手前端启动脚本
# 本脚本用于启动语音助手前端服务

# 小千语音助手已添加到系统，集成了唤醒词和声纹识别功能

# 检查Node.js环境
if ! command -v node &> /dev/null
then
    echo "未检测到Node.js，请先安装Node.js"
    exit 1
fi

# 检查yarn
if ! command -v yarn &> /dev/null
then
    echo "未检测到yarn，正在安装..."
    npm install -g yarn
fi

# 安装依赖
echo "正在安装依赖..."
yarn install

# 启动开发服务器
echo "正在启动开发服务器..."
yarn start

# 脚本结束后提示
echo "开发服务器已停止。" 