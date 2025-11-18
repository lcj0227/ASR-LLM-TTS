#!/bin/bash
# 简化版conda环境创建脚本（避免权限问题）

echo "正在创建conda环境: digital-human"

# 创建基础Python环境
conda create -n digital-human python=3.10 -y

# 激活环境
source $(conda info --base)/etc/profile.d/conda.sh
conda activate digital-human

# 安装conda包（分批安装，避免冲突）
echo "安装PyTorch相关包..."
conda install -c pytorch -y pytorch torchvision torchaudio

echo "安装基础科学计算包..."
conda install -c conda-forge -y numpy scipy pillow opencv

echo "安装音频处理包..."
conda install -c conda-forge -y librosa

echo "安装pynini（CosyVoice需要）..."
conda install -c conda-forge -y pynini=2.1.5

echo "安装pip包..."
pip install fastapi==0.115.3 uvicorn[standard]==0.32.0 python-multipart==0.0.12 websockets==11.0.3 pydantic==2.9.2
pip install pydub==0.25.1 soundfile>=0.12.0
pip install transformers>=4.45.0 accelerate>=0.33.0
pip install funasr>=1.1.0 edge-tts>=6.1.0
pip install python-dotenv==1.0.1 tqdm>=4.66.0 requests>=2.32.0 aiofiles>=23.2.0

echo ""
echo "环境创建完成！"
echo "运行以下命令激活环境："
echo "  conda activate digital-human"

