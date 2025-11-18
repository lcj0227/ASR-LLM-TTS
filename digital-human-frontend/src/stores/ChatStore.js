/**
 * 实时对话Store
 */
import { makeAutoObservable } from 'mobx';
import { ChatWebSocket } from '../utils/websocket';

class ChatStore {
  constructor() {
    this.connected = false;
    this.messages = [];
    this.isRecording = false;
    this.isProcessing = false;
    this.ws = null;
    this.error = null;
    
    makeAutoObservable(this);
  }

  // 连接WebSocket
  connect(wsUrl) {
    if (this.ws) {
      this.disconnect();
    }

    this.ws = new ChatWebSocket(
      wsUrl,
      this.handleMessage.bind(this),
      this.handleError.bind(this),
      this.handleOpen.bind(this),
      this.handleClose.bind(this)
    );

    this.ws.connect();
  }

  // 断开连接
  disconnect() {
    if (this.ws) {
      this.ws.disconnect();
      this.ws = null;
    }
    this.connected = false;
  }

  // 处理WebSocket打开
  handleOpen() {
    this.connected = true;
    this.error = null;
    this.addSystemMessage('已连接到服务器');
  }

  // 处理WebSocket关闭
  handleClose() {
    this.connected = false;
    this.addSystemMessage('连接已断开');
  }

  // 处理WebSocket错误
  handleError(error) {
    this.error = 'WebSocket连接错误';
    console.error('WebSocket错误:', error);
  }

  // 处理收到的消息
  handleMessage(data) {
    switch (data.type) {
      case 'connected':
        this.addSystemMessage('连接成功');
        break;
      
      case 'asr_result':
        this.addUserMessage(data.text);
        this.isProcessing = true;
        break;
      
      case 'llm_response':
        this.addAssistantMessage(data.text, data.audio_url);
        this.isProcessing = false;
        break;
      
      case 'error':
        this.error = data.message;
        this.isProcessing = false;
        break;
      
      default:
        console.log('未知消息类型:', data);
    }
  }

  // 发送音频数据
  sendAudio(audioData) {
    if (this.ws && this.connected) {
      return this.ws.sendAudio(audioData);
    }
    return false;
  }

  // 发送文本
  sendText(text) {
    if (this.ws && this.connected) {
      return this.ws.sendText(text);
    }
    return false;
  }

  // 请求处理音频
  requestProcess() {
    if (this.ws && this.connected) {
      return this.ws.requestProcess();
    }
    return false;
  }

  // 添加用户消息
  addUserMessage(text) {
    this.messages.push({
      id: Date.now(),
      type: 'user',
      text: text,
      timestamp: new Date(),
    });
  }

  // 添加助手消息
  addAssistantMessage(text, audioUrl = null) {
    this.messages.push({
      id: Date.now(),
      type: 'assistant',
      text: text,
      audioUrl: audioUrl,
      timestamp: new Date(),
    });
  }

  // 添加系统消息
  addSystemMessage(text) {
    this.messages.push({
      id: Date.now(),
      type: 'system',
      text: text,
      timestamp: new Date(),
    });
  }

  // 设置录音状态
  setRecording(isRecording) {
    this.isRecording = isRecording;
  }

  // 清空消息
  clearMessages() {
    this.messages = [];
  }

  // 清除错误
  clearError() {
    this.error = null;
  }
}

export default new ChatStore();

