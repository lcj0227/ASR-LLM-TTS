# 启动指南

## 快速启动

### Windows

1. **使用启动脚本（推荐）**：
   ```cmd
   start_server_uvicorn.bat
   ```

2. **手动启动**：
   ```cmd
   conda activate digital-human
   cd digital-human-backend
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### Linux/Mac

```bash
conda activate digital-human
cd digital-human-backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 验证服务

服务启动后，访问以下地址验证：

- **健康检查**: http://localhost:8000/health
- **API文档**: http://localhost:8000/docs
- **根路径**: http://localhost:8000/

## 常见问题

### 1. 服务无法启动

**检查项：**
- ✅ Conda 环境是否激活：`conda activate digital-human`
- ✅ 依赖是否安装：`pip install -r requirements.txt`
- ✅ 端口是否被占用：`netstat -ano | findstr :8000` (Windows)

### 2. 看到警告信息

以下警告是**正常的**，不影响核心功能：

- ⚠️ `CosyVoice导入失败` - 语音克隆功能不可用，其他功能正常
- ⚠️ `ffmpeg not installed` - 某些音频格式可能无法处理，常见格式（WAV、MP3）仍可用

详细说明请查看 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### 3. 端口被占用

如果 8000 端口被占用，可以修改端口：

```cmd
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## 功能状态

启动后，服务会显示各功能的加载状态：

- ✅ **ASR服务** - 语音识别（FunASR）
- ✅ **LLM服务** - 大语言模型（Qwen2.5）
- ✅ **TTS服务** - 文本转语音（Edge TTS）
- ⚠️ **语音克隆** - 需要 CosyVoice 完整依赖（可选）
- ✅ **唇形同步** - 需要 Wav2Lip 模型文件

## 下一步

1. 启动前端服务（如果已配置）
2. 访问 API 文档测试接口：http://localhost:8000/docs
3. 查看日志了解服务运行状态

## 停止服务

在运行服务的终端按 `Ctrl+C` 停止服务。

