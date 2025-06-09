import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import InfoIcon from '@mui/icons-material/Info';
import { ReactMic } from 'react-mic';

// 模拟 API 调用
const fakeApi = {
  // 模拟处理语音并获取回复
  processAudio: (audioBlob) => new Promise(resolve => {
    setTimeout(() => {
      resolve({
        recognized: '请问今天的天气怎么样？',
        response: '根据我的信息，我无法获取实时天气数据。不过，您可以通过查看天气应用或网站来获取准确的天气信息。需要我帮您解答其他问题吗？',
        audioResponse: 'response_audio_url.mp3'
      });
    }, 2000);
  })
};

function RecordChat() {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const messagesEndRef = useRef(null);

  // 滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 开始录音
  const handleStartRecording = () => {
    setError(null);
    setRecording(true);
  };

  // 停止录音
  const handleStopRecording = () => {
    setRecording(false);
  };

  // 处理录音完成
  const handleOnStop = async (recordedBlob) => {
    setAudioBlob(recordedBlob.blob);
    
    try {
      setProcessing(true);
      
      // 处理音频
      const { recognized, response, audioResponse } = await fakeApi.processAudio(recordedBlob.blob);
      
      // 添加消息到对话历史
      setMessages(prev => [
        ...prev,
        { type: 'user', text: recognized, time: new Date().toLocaleTimeString() },
        { type: 'assistant', text: response, audio: audioResponse, time: new Date().toLocaleTimeString() }
      ]);
      
    } catch (err) {
      setError('处理语音时出错，请重试。');
    } finally {
      setProcessing(false);
    }
  };

  // 播放录制的音频
  const playRecordedAudio = () => {
    if (audioBlob) {
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.play();
    }
  };

  return (
    <Box sx={{ my: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        按键式语音交互
      </Typography>
      
      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 2, minHeight: '60vh', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
              对话历史
            </Typography>
            
            <Box sx={{ flexGrow: 1, overflow: 'auto', maxHeight: '45vh', mb: 2 }}>
              {messages.length === 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography color="text.secondary">
                    还没有对话记录，请点击下方按钮开始录音
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
            
            <Box sx={{ mb: 2 }}>
              <ReactMic
                record={recording}
                className="sound-wave"
                onStop={handleOnStop}
                strokeColor="#1976d2"
                backgroundColor="#f5f5f5"
                width="100%"
                height="50px"
              />
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
              {!recording ? (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<MicIcon />}
                  onClick={handleStartRecording}
                  disabled={processing}
                  size="large"
                >
                  按住开始录音
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<StopIcon />}
                  onClick={handleStopRecording}
                  size="large"
                >
                  松开结束录音
                </Button>
              )}
              
              {audioBlob && !recording && !processing && (
                <Button
                  variant="outlined"
                  startIcon={<VolumeUpIcon />}
                  onClick={playRecordedAudio}
                >
                  播放录音
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
                本功能提供按键式语音交互体验，用户可以通过按下录音按钮开始录音，松开结束录音，系统会自动处理语音并生成回答。
              </Typography>
              
              <Typography variant="subtitle2" gutterBottom>
                使用说明：
              </Typography>
              <Typography component="div" variant="body2">
                <ol>
                  <li>点击"按住开始录音"按钮</li>
                  <li>对着麦克风说话</li>
                  <li>松开按钮结束录音</li>
                  <li>系统会自动识别语音并生成回答</li>
                  <li>可以点击"播放录音"按钮听取您的录音</li>
                </ol>
              </Typography>
              
              <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
                相比实时模式，按键式更适合在噪音环境或需要精确控制录音时间的场景使用。
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
                <strong>录音工具：</strong> SoundDevice<br />
                <strong>支持语言：</strong> 中文、英语、日语、韩语、粤语
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default RecordChat; 