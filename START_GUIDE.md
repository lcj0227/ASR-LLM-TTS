# 启动指南

## 前提条件

1. ✅ 已创建并激活conda环境 `digital-human`
2. ✅ 已安装所有Python依赖
3. ✅ 已安装Node.js（前端需要）

## 启动步骤

### 1. 启动后端服务

#### 方法1: 使用启动脚本（推荐）

**Windows:**
```cmd
cd digital-human-backend
conda activate digital-human
start_server_uvicorn.bat
```

**Linux/Mac:**
```bash
cd digital-human-backend
conda activate digital-human
chmod +x start_server_uvicorn.sh
./start_server_uvicorn.sh
```

#### 方法2: 手动启动

```bash
cd digital-human-backend
conda activate digital-human
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 方法3: 使用Python模块

```bash
cd digital-human-backend
conda activate digital-human
python -m app.main
```

后端服务启动后，访问：
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

### 2. 启动前端服务

**Windows:**
```cmd
cd digital-human-frontend
start_frontend.bat
```

**Linux/Mac:**
```bash
cd digital-human-frontend
chmod +x start_frontend.sh
./start_frontend.sh
```

或者手动启动：
```bash
cd digital-human-frontend
npm install  # 首次运行需要
npm start
```

前端服务启动后，访问：
- 应用地址: http://localhost:3000

### 3. 配置模型路径（重要）

在启动后端前，需要配置模型路径。可以通过以下方式：

#### 方式1: 环境变量

**Windows PowerShell:**
```powershell
$env:COSYVOICE_MODEL_PATH="./pretrained_models/CosyVoice-300M"
$env:WAV2LIP_CHECKPOINT_PATH="./Wav2Lip/checkpoints/wav2lip_gan.pth"
$env:LLM_MODEL_PATH="./QWen/Qwen2.5-0.5B-Instruct"
$env:ASR_MODEL_PATH="./QWen/pretrained_models/SenseVoiceSmall"
```

**Windows CMD:**
```cmd
set COSYVOICE_MODEL_PATH=./pretrained_models/CosyVoice-300M
set WAV2LIP_CHECKPOINT_PATH=./Wav2Lip/checkpoints/wav2lip_gan.pth
set LLM_MODEL_PATH=./QWen/Qwen2.5-0.5B-Instruct
set ASR_MODEL_PATH=./QWen/pretrained_models/SenseVoiceSmall
```

**Linux/Mac:**
```bash
export COSYVOICE_MODEL_PATH="./pretrained_models/CosyVoice-300M"
export WAV2LIP_CHECKPOINT_PATH="./Wav2Lip/checkpoints/wav2lip_gan.pth"
export LLM_MODEL_PATH="./QWen/Qwen2.5-0.5B-Instruct"
export ASR_MODEL_PATH="./QWen/pretrained_models/SenseVoiceSmall"
```

#### 方式2: 修改配置文件

编辑 `digital-human-backend/app/config.py`，修改默认路径。

#### 方式3: 创建.env文件

在 `digital-human-backend/` 目录创建 `.env` 文件：

```env
COSYVOICE_MODEL_PATH=./pretrained_models/CosyVoice-300M
WAV2LIP_CHECKPOINT_PATH=./Wav2Lip/checkpoints/wav2lip_gan.pth
LLM_MODEL_PATH=./QWen/Qwen2.5-0.5B-Instruct
ASR_MODEL_PATH=./QWen/pretrained_models/SenseVoiceSmall
```

## 快速启动（一键启动）

### Windows

创建 `start_all.bat`:

```batch
@echo off
echo 启动数字人Web端项目...
echo.

REM 启动后端（新窗口）
start "数字人后端" cmd /k "cd digital-human-backend && conda activate digital-human && start_server_uvicorn.bat"

REM 等待后端启动
timeout /t 5

REM 启动前端（新窗口）
start "数字人前端" cmd /k "cd digital-human-frontend && start_frontend.bat"

echo.
echo 后端服务: http://localhost:8000
echo 前端应用: http://localhost:3000
echo API文档: http://localhost:8000/docs
pause
```

### Linux/Mac

创建 `start_all.sh`:

```bash
#!/bin/bash
echo "启动数字人Web端项目..."
echo ""

# 启动后端（后台）
cd digital-human-backend
conda activate digital-human
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# 等待后端启动
sleep 5

# 启动前端
cd ../digital-human-frontend
npm start &
FRONTEND_PID=$!

echo ""
echo "后端服务: http://localhost:8000"
echo "前端应用: http://localhost:3000"
echo "API文档: http://localhost:8000/docs"
echo ""
echo "按Ctrl+C停止所有服务"

# 等待中断信号
trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
```

## 验证启动

### 检查后端

访问 http://localhost:8000/health，应该返回：
```json
{"status": "healthy"}
```

### 检查前端

访问 http://localhost:3000，应该看到数字人Web端首页。

## 常见问题

1. **端口被占用**: 修改 `app/config.py` 中的 `PORT` 或使用 `--port` 参数
2. **模型加载失败**: 检查模型路径是否正确，模型文件是否存在
3. **前端无法连接后端**: 检查 `digital-human-frontend/src/services/api.js` 中的 `API_BASE_URL`
4. **CORS错误**: 检查后端 `app/main.py` 中的CORS配置

## 停止服务

- **后端**: 在运行后端的终端按 `Ctrl+C`
- **前端**: 在运行前端的终端按 `Ctrl+C`

