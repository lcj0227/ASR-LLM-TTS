# 数字人Web端前端

基于React + Mobx + Material-UI的数字人Web端前端应用。

## 功能特性

- 语音克隆：上传参考音频，克隆任意声音
- 唇形同步：将音频与人脸图片/视频结合
- 实时对话：WebSocket实时语音对话
- 训练管理：离线训练模型管理

## 技术栈

- React 18
- Mobx 6
- Material-UI 5
- React Router 6
- Axios

## 安装

```bash
npm install
```

## 运行

```bash
npm start
```

应用将在 http://localhost:3000 启动

## 构建

```bash
npm run build
```

## 环境变量

创建 `.env` 文件：

```
REACT_APP_API_URL=http://localhost:8000
```

