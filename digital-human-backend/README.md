# 数字人Web端后端

基于FastAPI的数字人Web端后端服务。

## 功能特性

- 文件上传管理（音频/视频/图片）
- 语音克隆（CosyVoice）
- 唇形同步（Wav2Lip）
- 实时对话（WebSocket + ASR + LLM + TTS）
- 训练管理（CosyVoice SFT、Wav2Lip微调）

## 技术栈

- FastAPI
- WebSocket
- CosyVoice（语音克隆）
- Wav2Lip（唇形同步）
- QWen2.5（LLM）
- FunASR/SenseVoice（ASR）
- Edge TTS（TTS）

## 安装

```bash
pip install -r requirements.txt
```

## 配置

设置环境变量或修改 `app/config.py`：

```bash
export COSYVOICE_MODEL_PATH=./pretrained_models/CosyVoice-300M
export WAV2LIP_CHECKPOINT_PATH=./Wav2Lip/checkpoints/wav2lip_gan.pth
export LLM_MODEL_PATH=./QWen/Qwen2.5-0.5B-Instruct
export ASR_MODEL_PATH=./QWen/pretrained_models/SenseVoiceSmall
```

## 运行

```bash
cd digital-human-backend
python -m app.main
```

或使用uvicorn：

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## API文档

启动服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## WebSocket

实时对话WebSocket端点：
- ws://localhost:8000/ws/chat

