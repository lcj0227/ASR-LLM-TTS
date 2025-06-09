# 文本转语音功能使用指南

本项目实现了一个基于EdgeTTS的文本转语音服务，包含后端API和前端界面。

## 功能特点

- 支持多种语言和声音（中文、英语、日语、韩语、粤语等）
- 可调节语速和音高
- 实时生成MP3格式音频
- 支持音频播放和下载

## 系统架构

- 前端：React + Material UI
- 后端：Flask + EdgeTTS
- 通信：RESTful API

## 运行方法

### 1. 启动后端服务

```bash
# 方法一：使用脚本启动
./start_tts_api.sh

# 方法二：手动启动
pip install edge-tts flask flask-cors
python tts_api.py
```

默认情况下，后端服务会在 http://localhost:5000 运行。

### 2. 启动前端服务

```bash
cd speech-assistant-frontend
npm install  # 首次运行时安装依赖
npm start
```

前端服务会在 http://localhost:3000 运行。

## API文档

### 获取可用语音列表

```
GET /api/voices
```

返回示例：

```json
{
  "success": true,
  "voices": [
    { "id": "zh-CN-XiaoxiaoNeural", "name": "中文 - 晓晓 (女声)", "language": "中文" },
    ...
  ]
}
```

### 文本转语音

```
POST /api/tts
```

请求参数：

```json
{
  "text": "要转换的文本内容",
  "voice": "zh-CN-XiaoxiaoNeural",
  "speed": 1.0,
  "pitch": 1.0
}
```

返回示例：

```json
{
  "success": true,
  "audioData": "data:audio/mp3;base64,..."
}
```

## 常见问题

1. **如果后端服务无法启动**，请检查是否已安装所需的依赖库
2. **如果前端无法连接后端**，请检查API_BASE_URL是否配置正确（默认为http://localhost:5000/api）
3. **如果音频无法播放**，请检查浏览器是否支持MP3格式，以及是否存在跨域问题

## 未来改进

- 添加更多语音选项
- 支持批量文本转语音
- 添加更多音频调整参数
- 支持长文本自动分段处理 