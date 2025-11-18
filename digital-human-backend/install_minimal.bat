@echo off
REM 最小化安装脚本（仅安装必需依赖）

echo 正在创建conda环境: digital-human (最小化安装)

REM 创建基础环境
conda create -n digital-human python=3.10 -y

REM 激活环境
call conda activate digital-human

REM 安装conda包
conda install -c conda-forge -y pytorch torchvision torchaudio numpy opencv pillow scipy librosa soundfile pynini=2.1.5

REM 安装pip包（仅核心依赖）
pip install fastapi==0.115.3 uvicorn[standard]==0.32.0 python-multipart==0.0.12 websockets==11.0.3 pydantic==2.9.2 transformers>=4.45.0 accelerate>=0.33.0 funasr>=1.1.0 edge-tts>=6.1.0 python-dotenv==1.0.1 pydub==0.25.1 tqdm>=4.66.0 requests>=2.32.0 aiofiles>=23.2.0

echo.
echo 环境创建完成！
echo 运行以下命令激活环境：
echo   conda activate digital-human

pause

