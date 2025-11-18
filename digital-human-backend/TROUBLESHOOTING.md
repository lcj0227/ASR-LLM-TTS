# 故障排查指南

## 常见警告和问题

### 1. CosyVoice 相关警告

**警告信息：**
```
WARNING:app.services.voice_clone_service:CosyVoice导入失败: No module named 'tn'。语音克隆功能将不可用。
failed to import ttsfrd, use WeTextProcessing instead
```

**原因：**
- CosyVoice 需要 `WeTextProcessing` 或 `ttsfrd` 库
- 这些库依赖 `pynini`，而 `pynini` 在 Windows 上需要 C++ 编译器才能编译安装

**影响：**
- 语音克隆功能将不可用
- 其他功能（ASR、LLM、TTS、Lip-Sync）不受影响

**解决方案（可选）：**
1. 安装 Visual Studio Build Tools（包含 C++ 编译器）
2. 然后安装：`pip install pynini WeTextProcessing`

### 2. FFmpeg 警告

**警告信息：**
```
RuntimeWarning: Couldn't find ffmpeg or avconv - defaulting to ffmpeg, but may not work
Notice: ffmpeg is not installed. torchaudio is used to load audio
```

**原因：**
- FFmpeg 未安装或不在系统 PATH 中

**影响：**
- 某些音频格式可能无法处理
- `torchaudio` 会作为后备方案，支持常见格式（WAV、MP3等）

**解决方案（可选）：**
1. Windows: 下载 FFmpeg 并添加到 PATH
   - 下载：https://ffmpeg.org/download.html
   - 解压并添加到系统 PATH
2. 或使用 conda 安装：`conda install -c conda-forge ffmpeg`

### 3. 服务启动成功但无法访问

**检查步骤：**
1. 确认服务正在运行：
   ```powershell
   Get-Process python | Where-Object {$_.CommandLine -like "*uvicorn*"}
   ```

2. 检查端口是否被占用：
   ```powershell
   netstat -ano | findstr :8000
   ```

3. 测试健康检查端点：
   ```powershell
   Invoke-WebRequest -Uri http://localhost:8000/health -UseBasicParsing
   ```

### 4. 依赖安装问题

**如果遇到依赖安装失败：**

1. 确保 conda 环境已激活：
   ```powershell
   conda activate digital-human
   ```

2. 使用 requirements.txt 安装：
   ```powershell
   pip install -r requirements.txt
   ```

3. 如果某个包安装失败，可以跳过可选依赖：
   - `pynini` 和 `WeTextProcessing` 是可选依赖
   - 可以注释掉 requirements.txt 中的相关行

## 功能可用性检查

### 可用功能（即使有警告）
- ✅ 文件上传（音频/视频/图片）
- ✅ ASR 语音识别（FunASR）
- ✅ LLM 对话（Qwen2.5）
- ✅ TTS 语音合成（Edge TTS）
- ✅ 唇形同步（Wav2Lip，如果模型文件存在）
- ✅ 训练任务管理
- ✅ WebSocket 实时对话

### 可能不可用的功能
- ❌ 语音克隆（CosyVoice）- 需要 WeTextProcessing/pynini
- ⚠️ 某些音频格式处理 - 需要 FFmpeg

## 验证服务状态

运行以下命令验证服务是否正常：

```powershell
# 1. 检查服务是否启动
Invoke-WebRequest -Uri http://localhost:8000/health -UseBasicParsing

# 2. 检查 API 文档
Start-Process http://localhost:8000/docs

# 3. 检查根路径
Invoke-WebRequest -Uri http://localhost:8000/ -UseBasicParsing
```

## 日志查看

服务日志会显示在控制台。主要关注：
- `INFO` - 正常信息
- `WARNING` - 警告（通常不影响核心功能）
- `ERROR` - 错误（需要处理）

## 联系支持

如果遇到其他问题，请检查：
1. Python 版本（推荐 3.10+）
2. Conda 环境是否正确激活
3. 所有必需依赖是否已安装
4. 模型文件路径是否正确配置

