#!/bin/bash

# 小千语音助手后端启动脚本

echo "启动小千语音助手后端服务"
echo "=========================="

# 检查Python环境
if ! command -v python3 &> /dev/null
then
    echo "未检测到Python3，请先安装Python3"
    exit 1
fi

# 检查依赖
echo "检查依赖..."
python3 -c "import flask, flask_cors, pypinyin, funasr, modelscope, transformers, webrtcvad, edge_tts, langid" 2>/dev/null

if [ $? -ne 0 ]; then
    echo "检测到依赖缺失，开始安装..."
    python3 -m pip install flask flask-cors pypinyin webrtcvad langid edge-tts
    python3 -m pip install -U "modelscope[audio]" -f https://modelscope.oss-cn-beijing.aliyuncs.com/releases/repo.html
    python3 -m pip install funasr "transformers>=4.27.1" 
fi

# 创建必要的目录
mkdir -p output
mkdir -p SpeakerVerification_DIR/enroll_wav
mkdir -p tmp_audio

# 启动服务器
echo "启动服务器..."
python3 15.1_SenceVoice_kws_CAM++_server.py --port=5001 