# 语音助手前端应用

这是一个基于React和Material UI构建的语音助手前端应用，提供多种语音交互功能。

## 功能特性

- **实时语音对话**：实时语音识别和回答
- **按键式语音对话**：按住按钮进行录音，松开自动识别并回答
- **文本转语音**：将文本转换为语音输出
- **场景语音对话**：结合视频画面和语音内容，进行多模态交互

## 场景语音对话功能

场景语音对话是一项创新功能，它能够同时分析用户的视频和音频输入，提供更加智能的上下文相关回答。

### 技术组件

- **前端**：使用WebRTC获取摄像头和麦克风数据，通过WebSocket实时传输到后端
- **后端**：
  - **WebRTC VAD**：用于语音活动检测
  - **SenseVoice**：语音识别模型
  - **Qwen2-VL**：多模态视觉语言模型，用于理解视频内容和语音内容
  - **Edge TTS**：文本转语音，支持多语种回答

### 使用方法

1. 点击"开始录制"按钮，允许浏览器访问摄像头和麦克风
2. 对着摄像头和麦克风说话
3. 系统会自动检测语音活动，分析视频场景和语音内容
4. 接收系统的回答，并自动播放语音

### 连接实际后端服务

默认情况下，场景语音对话功能使用模拟数据。要连接到实际的后端服务：

1. 点击右上角的"设置"图标
2. 启用"使用实际服务器"选项
3. 输入WebSocket服务器地址（默认为http://localhost:5000）
4. 关闭设置对话框，开始使用

## 小千语音助手 (VoiceAssistant)

小千语音助手是一个基于SenceVoice和CAM++实现的智能语音交互系统，具有以下特点：

1. **唤醒词识别**：通过设定唤醒词（默认为"站起来"）激活语音助手
2. **声纹识别**：支持声纹注册和验证，提供个性化安全访问
3. **语音交互**：集成语音识别、大语言模型对话和语音合成
4. **多语言支持**：支持中文、英文、日文等多种语言的自动识别和回复

### 功能亮点

- **可视化音频波形**：实时显示语音输入的波形
- **声纹安全验证**：只有经过授权的用户才能使用完整功能
- **友好交互界面**：简洁直观的用户界面，易于使用

### 使用方法

1. 点击"开始录音"按钮开始交互
2. 说出唤醒词（默认为"站起来"）
3. 系统会自动进行声纹验证（如已注册）
4. 验证通过后，即可开始对话

首次使用时，需要进行声纹注册，请点击设置中的"注册声纹"按钮，并按照提示完成至少3秒的语音录制。

## 安装与运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm start
```

## 项目依赖

- React 16
- Material UI 5
- React Router 6
- Socket.io Client 4
- React Mic

## 后端服务

场景语音对话功能需要配套的后端服务支持。后端服务实现可参考应用中的"了解更多"信息对话框中的示例代码。

## 技术栈

- **React**: 用于构建用户界面
- **React Router**: 页面路由管理
- **Material-UI**: UI组件库和样式
- **React Mic**: 录音功能支持

## 项目结构

```
speech-assistant-frontend/
├── public/                # 静态文件
├── src/                   # 源代码
│   ├── components/        # 通用组件
│   │   ├── Header.js      # 页头组件
│   │   └── Footer.js      # 页脚组件
│   ├── pages/             # 页面组件
│   │   ├── Home.js        # 首页
│   │   ├── RealTimeChat.js # 实时语音对话
│   │   ├── RecordChat.js  # 按键式语音对话
│   │   └── TextToSpeech.js # 文本转语音
│   ├── App.js             # 应用入口
│   ├── index.js           # 渲染入口
│   └── index.css          # 全局样式
├── package.json           # 项目依赖和脚本
└── README.md              # 项目说明
```

## 连接后端

当前版本使用模拟数据演示功能。要连接到实际的后端服务，请修改各组件中的API调用部分，将模拟API替换为实际的后端API端点。

例如:
```javascript
// 在各页面组件中，将类似这样的模拟API调用:
const fakeApi = {
  processAudio: (audioBlob) => new Promise(resolve => {
    setTimeout(() => {
      resolve({
        recognized: '请问今天的天气怎么样？',
        response: '今天天气晴朗...',
      });
    }, 2000);
  })
};

// 替换为实际的API调用:
import axios from 'axios';

const realApi = {
  processAudio: async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    
    const response = await axios.post('http://localhost:5000/api/process-audio', formData);
    return response.data;
  }
};
```

## 许可

MIT 