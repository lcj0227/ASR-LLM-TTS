/**
 * WebSocket工具函数
 */

export class ChatWebSocket {
  constructor(url, onMessage, onError, onOpen, onClose) {
    this.url = url;
    this.onMessage = onMessage;
    this.onError = onError;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        if (this.onOpen) {
          this.onOpen();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onMessage) {
            this.onMessage(data);
          }
        } catch (e) {
          console.error('解析WebSocket消息失败:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        if (this.onError) {
          this.onError(error);
        }
      };

      this.ws.onclose = () => {
        if (this.onClose) {
          this.onClose();
        }
        this.reconnect();
      };
    } catch (error) {
      console.error('WebSocket连接失败:', error);
      if (this.onError) {
        this.onError(error);
      }
    }
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('WebSocket重连失败，已达到最大重试次数');
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (typeof data === 'string') {
        this.ws.send(data);
      } else {
        this.ws.send(JSON.stringify(data));
      }
      return true;
    } else {
      console.warn('WebSocket未连接，无法发送消息');
      return false;
    }
  }

  sendAudio(audioData) {
    // 发送音频数据（base64编码）
    const base64 = btoa(
      new Uint8Array(audioData).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );
    
    return this.send({
      type: 'audio',
      data: base64,
    });
  }

  sendText(text) {
    return this.send({
      type: 'text',
      text: text,
    });
  }

  requestProcess() {
    return this.send({
      type: 'process',
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

