import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import StopIcon from '@mui/icons-material/Stop';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

// 后端API基础URL
const API_BASE_URL = 'http://localhost:8080/api';

// 实际API调用
const api = {
  // 开始录音 - 请求后端启动录音会话
  startRecording: async () => {
    const response = await fetch(`${API_BASE_URL}/recording/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error('启动录音失败');
    }
    
    return await response.json();
  },
  
  // 停止录音
  stopRecording: async (audioBlob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');
    
    const response = await fetch(`${API_BASE_URL}/recording/stop`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error('处理录音失败');
    }
    
    return await response.json();
  },
  
  // 处理语音并获取回复
  processAudio: async (audioId) => {
    const response = await fetch(`${API_BASE_URL}/chat/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audioId })
    });
    
    if (!response.ok) {
      throw new Error('处理语音失败');
    }
    
    return await response.json();
  }
};

function RealTimeChat() {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const sessionIdRef = useRef(null);

  // 滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 播放音频
  const playAudio = (audioUrl) => {
    const audio = new Audio(audioUrl);
    audio.play();
  };

  // 开始录音
  const handleStartRecording = async () => {
    setError(null);
    audioChunksRef.current = [];
    
    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 创建MediaRecorder实例
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      // 收集音频数据
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // 告知后端开始新的录音会话
      const { sessionId } = await api.startRecording();
      sessionIdRef.current = sessionId;
      
      // 开始录音
      mediaRecorder.start(100);
      setRecording(true);
      
    } catch (err) {
      console.error('启动录音失败:', err);
      setError('启动麦克风失败，请检查麦克风权限。');
    }
  };

  // 停止录音并处理
  const handleStopRecording = async () => {
    if (!recording || !mediaRecorderRef.current) return;
    
    try {
      setRecording(false);
      setProcessing(true);
      
      // 停止录音
      return new Promise((resolve) => {
        mediaRecorderRef.current.onstop = async () => {
          try {
            // 创建音频Blob
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
            
            // 发送录音到后端
            const { audioId } = await api.stopRecording(audioBlob);
            
            // 处理音频
            const { recognized, response, audioResponse } = await api.processAudio(audioId);
            
            // 添加消息到对话历史
            setMessages(prev => [
              ...prev,
              { type: 'user', text: recognized, time: new Date().toLocaleTimeString() },
              { type: 'assistant', text: response, audio: audioResponse, time: new Date().toLocaleTimeString() }
            ]);
            
            resolve();
          } catch (err) {
            console.error('处理录音失败:', err);
            setError('处理语音时出错，请重试。');
            resolve();
          }
        };
        
        mediaRecorderRef.current.stop();
      });
      
    } catch (err) {
      console.error('停止录音失败:', err);
      setError('处理语音时出错，请重试。');
    } finally {
      setProcessing(false);
      
      // 关闭媒体流
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  return (
    <Box sx={{ my: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        实时语音交互
      </Typography>
      
      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Paper 
            elevation={3}
            sx={{ 
              p: 2, 
              minHeight: '60vh',
              maxHeight: '60vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <Typography variant="h6" gutterBottom>
              对话历史
            </Typography>
            
            <Box sx={{ flexGrow: 1, overflow: 'auto', mb: 2 }}>
              {messages.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography color="text.secondary">
                    还没有对话记录，点击下方麦克风按钮开始对话
                  </Typography>
                </Box>
              ) : (
                <List>
                  {messages.map((msg, index) => (
                    <React.Fragment key={index}>
                      <ListItem alignItems="flex-start">
                        <ListItemAvatar>
                          <Avatar>
                            {msg.type === 'user' ? <PersonIcon /> : <SmartToyIcon />}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography
                              sx={{ display: 'inline' }}
                              component="span"
                              variant="body1"
                              color="text.primary"
                            >
                              {msg.type === 'user' ? '您' : '千问'}
                            </Typography>
                          }
                          secondary={
                            <React.Fragment>
                              <Typography
                                sx={{ display: 'block' }}
                                component="span"
                                variant="body2"
                                color="text.primary"
                              >
                                {msg.text}
                              </Typography>
                              <Typography
                                component="span"
                                variant="caption"
                                color="text.secondary"
                              >
                                {msg.time}
                                {msg.audio && msg.type === 'assistant' && (
                                  <Button 
                                    size="small" 
                                    startIcon={<VolumeUpIcon />} 
                                    sx={{ ml: 1 }}
                                    onClick={() => playAudio(msg.audio)}
                                  >
                                    播放
                                  </Button>
                                )}
                              </Typography>
                            </React.Fragment>
                          }
                        />
                      </ListItem>
                      {index < messages.length - 1 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                  ))}
                  <div ref={messagesEndRef} />
                </List>
              )}
            </Box>
            
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              {!recording ? (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<MicIcon />}
                  onClick={handleStartRecording}
                  disabled={processing}
                  size="large"
                >
                  {processing ? '处理中...' : '开始录音'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<StopIcon />}
                  onClick={handleStopRecording}
                  size="large"
                >
                  停止录音
                </Button>
              )}
              
              {processing && (
                <CircularProgress 
                  size={24} 
                  sx={{ ml: 2, mt: 1 }} 
                />
              )}
            </Box>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                功能说明
              </Typography>
              <Typography variant="body2" paragraph>
                本功能使用WebRTC VAD进行实时语音活动检测，提供了自然流畅的对话体验。
              </Typography>
              
              <Typography variant="subtitle2" gutterBottom>
                技术特点：
              </Typography>
              <Typography component="div" variant="body2">
                <ul>
                  <li>使用WebRTC VAD实时检测语音活动</li>
                  <li>自动分段并处理有效语音</li>
                  <li>支持语音交互中的自由打断</li>
                  <li>多语言语音识别和响应</li>
                  <li>根据语种自动选择合适的语音合成音色</li>
                </ul>
              </Typography>
              
              <Alert severity="info" icon={<HelpOutlineIcon />} sx={{ mt: 2 }}>
                要开始对话，请点击"开始录音"按钮，然后对着麦克风说话。系统会自动检测语音并生成回应。
              </Alert>
            </CardContent>
          </Card>
          
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                技术实现
              </Typography>
              <Typography variant="body2">
                <strong>语音识别：</strong> SenseVoice<br />
                <strong>大语言模型：</strong> QWen2.5-1.5B-Instruct<br />
                <strong>语音合成：</strong> EdgeTTS<br />
                <strong>语音活动检测：</strong> WebRTC VAD<br />
                <strong>支持语言：</strong> 中文、英语、日语、韩语、粤语
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default RealTimeChat; 