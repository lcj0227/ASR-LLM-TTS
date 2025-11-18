# 数字人Web端项目

完整的数字人Web端应用，支持声音/视频克隆、唇形同步、实时对话和离线训练功能。

## 项目结构

```
.
├── digital-human-backend/     # 后端服务（FastAPI）
│   ├── app/
│   │   ├── api/               # API路由
│   │   ├── services/          # 业务逻辑服务
│   │   ├── models/           # 数据模型
│   │   ├── websocket/        # WebSocket处理
│   │   └── utils/            # 工具函数
│   └── requirements.txt
│
└── digital-human-frontend/    # 前端应用（React + Mobx）
    ├── src/
    │   ├── stores/           # Mobx状态管理
    │   ├── services/         # API服务
    │   ├── pages/            # 页面组件
    │   └── components/       # 通用组件
    └── package.json
```

## 功能特性

### 1. 语音克隆
- 上传参考音频文件
- 支持zero-shot、cross-lingual、VC、SFT多种模式
- 实时查看克隆进度和结果

### 2. 唇形同步
- 上传人脸图片或视频
- 上传音频文件
- 生成唇形同步视频

### 3. 实时对话
- WebSocket实时通信
- 语音识别（ASR）
- 大语言模型回复（LLM）
- 语音合成（TTS）
- 可选唇形同步

### 4. 训练管理
- 创建训练任务
- 查看训练进度
- 管理训练结果

## 快速开始

### 后端

1. 安装依赖：
```bash
cd digital-human-backend
pip install -r requirements.txt
```

2. 配置模型路径（环境变量或config.py）

3. 启动服务：
```bash
python -m app.main
```

### 前端

1. 安装依赖：
```bash
cd digital-human-frontend
npm install
```

2. 启动开发服务器：
```bash
npm start
```

## API文档

后端启动后访问：
- http://localhost:8000/docs (Swagger UI)
- http://localhost:8000/redoc (ReDoc)

## 注意事项

1. 模型文件较大，需要合理管理加载
2. 训练任务耗时，需要异步处理
3. 文件上传需要大小限制和格式验证
4. WebSocket连接需要处理断线重连
5. 前端需要处理大文件上传的进度显示

## 技术栈

### 后端
- FastAPI
- WebSocket
- CosyVoice
- Wav2Lip
- QWen2.5
- FunASR/SenseVoice
- Edge TTS

### 前端
- React 18
- Mobx 6
- Material-UI 5
- React Router 6
- Axios

