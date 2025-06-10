import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Stack,
  Tooltip,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  LinearProgress,
  Avatar,
  Snackbar
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import PersonIcon from '@mui/icons-material/Person';
import HelpIcon from '@mui/icons-material/Help';
import axios from 'axios';
import voiceAssistantAPI from '../api/VoiceAssistantAPI';

function VoiceAssistant() {
  // 状态管理
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('准备就绪');
  const [conversations, setConversations] = useState([]);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [kwsEnabled, setKwsEnabled] = useState(false); // 唤醒词识别
  const [svEnabled, setSvEnabled] = useState(false); // 声纹识别
  const [kwsText, setKwsText] = useState('乐迪乐迪'); // 唤醒词
  const [svEnrolled, setSvEnrolled] = useState(false); // 声纹注册
  const [svEnrollDialogOpen, setSvEnrollDialogOpen] = useState(false);
  const [svEnrollTime, setSvEnrollTime] = useState(0);
  const [svEnrollRecording, setSvEnrollRecording] = useState(false);
  const [serverUrl, setServerUrl] = useState('http://localhost:5001');
  const [audioWaves, setAudioWaves] = useState(Array(8).fill(10));
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // 引用
  const audioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const svEnrollTimerRef = useRef(null);

  // 组件加载时检查声纹注册状态
  useEffect(() => {
    checkEnrollmentStatus();
    
    // 组件卸载时清理所有资源
    return () => {
      stopAudioVisualization();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      
      // 清理定时器和录音
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // 当服务器URL变更时更新API基础URL
  useEffect(() => {
    voiceAssistantAPI.setBaseURL(serverUrl);
  }, [serverUrl]);

  // 检查声纹注册状态
  const checkEnrollmentStatus = async () => {
    try {
      // 实际连接时使用API
      const enrolled = await voiceAssistantAPI.checkEnrollmentStatus();
      setSvEnrolled(enrolled);
      
      // 模拟检查
      // const enrolled = localStorage.getItem('svEnrolled') === 'true';
      // setSvEnrolled(enrolled);
    } catch (error) {
      console.error('检查声纹注册状态失败:', error);
    }
  };

  // 音频可视化动画
  useEffect(() => {
    if (isRecording) {
      startAudioVisualization();
    } else {
      stopAudioVisualization();
    }

    return () => {
      stopAudioVisualization();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [isRecording]);

  const startAudioVisualization = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
    }

    const updateVisualization = () => {
      if (!isRecording) return;

      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      
      // 从频谱数据中提取8个点用于波形显示
      const step = Math.floor(dataArrayRef.current.length / 8);
      const newWaves = Array(8).fill(0).map((_, i) => {
        const value = dataArrayRef.current[i * step];
        // 缩放值到10-50范围内
        return Math.max(10, Math.min(50, 10 + (value / 255) * 40));
      });
      
      setAudioWaves(newWaves);
      animationFrameRef.current = requestAnimationFrame(updateVisualization);
    };

    animationFrameRef.current = requestAnimationFrame(updateVisualization);
  };

  const stopAudioVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioWaves(Array(8).fill(10));
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 连接音频流到可视化分析器
      if (audioContextRef.current && analyserRef.current) {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
      }
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // 设置定时器，每2.5秒处理一次录音内容
      const processingInterval = 2500; // 2.5秒
      let processingTimer = null;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // 修改为定时处理录音内容，而不是在停止录音时处理
      const processCurrentAudio = async () => {
        if (!isRecording) return;
        
        // 如果当前正在处理中，跳过此次处理
        if (isProcessing) {
          processingTimer = setTimeout(processCurrentAudio, processingInterval);
          return;
        }
        
        // 临时停止录音以获取当前数据
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      };
      
      mediaRecorder.onstop = async () => {
        // 如果仍在录音状态，则这是定时处理，否则是真正的停止
        if (isRecording) {
          // 设置临时处理状态，但不显示给用户
          const hasData = audioChunksRef.current.length > 0;
          
          if (hasData) {
            setIsProcessing(true);
            await handleRecordingChunk();
            setIsProcessing(false);
          }
          
          // 重新开始录音
          audioChunksRef.current = [];
          try {
            mediaRecorder.start(100); // 设置更小的时间片，便于获取数据
            
            // 设置下一次处理
            processingTimer = setTimeout(processCurrentAudio, processingInterval);
          } catch (e) {
            console.error('重新开始录音失败:', e);
            // 如果失败，尝试重新启动录音
            stopRecording();
            setTimeout(() => startRecording(), 500);
          }
        } else {
          // 最终停止录音时的处理
          await handleRecordingStop();
          
          // 清理定时器
          if (processingTimer) {
            clearTimeout(processingTimer);
          }
        }
      };

      mediaRecorder.start(100); // 设置100ms的时间片，便于获取数据
      setIsRecording(true);
      setStatusMessage('录音中...');
      
      // 启动第一次处理的定时器
      processingTimer = setTimeout(processCurrentAudio, processingInterval);

    } catch (error) {
      console.error('录音失败:', error);
      setStatusMessage(`录音失败: ${error.message}`);
      showSnackbar(`录音失败: ${error.message}`);
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setIsRecording(false); // 先设置状态，让onstop事件知道这是真正的停止
      mediaRecorderRef.current.stop();
      setStatusMessage('处理中...');
      setIsProcessing(true);
    }
  };

  // 显示提示消息
  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarOpen(true);
  };

  // 处理录音片段
  const handleRecordingChunk = async () => {
    try {
      // 只有在有录音数据时才处理
      if (audioChunksRef.current.length === 0) return;
      
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      
      // 使用API发送请求，但不显示"处理中"状态，保持录音状态
      try {
        const response = await voiceAssistantAPI.processAudio(audioBlob, {
          kwsEnabled,
          svEnabled,
          kwsText
        });
        
        // 如果是成功响应，显示在界面上
        if (response.status === 'success') {
          handleResponse(response);
        } 
        // 对于唤醒词错误，不显示错误信息，继续录音
        else if (response.status === 'kws_failed') {
          // 静默忽略唤醒词错误，等待用户继续说话
          console.log("等待唤醒词...");
        }
        // 对于声纹验证或注册问题，显示一次提示
        else if (['sv_failed', 'sv_enroll_required'].includes(response.status)) {
          handleResponse(response);
        }
      } catch (error) {
        console.error('处理音频片段失败:', error);
        // 不显示错误通知，以免干扰用户体验
      }
    } catch (error) {
      console.error('处理录音片段失败:', error);
    }
  };

  // 处理录音停止
  const handleRecordingStop = async () => {
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      
      // 使用API发送请求
      try {
        // 实际连接后端时使用
        const response = await voiceAssistantAPI.processAudio(audioBlob, {
          kwsEnabled,
          svEnabled,
          kwsText
        });
        handleResponse(response);

        // 模拟响应
        // const simulatedResponse = simulateResponse(audioBlob);
        // handleResponse(simulatedResponse);
      } catch (error) {
        console.error('处理音频请求失败:', error);
        showSnackbar('处理音频请求失败，请检查服务器连接');
      }
      
      setIsProcessing(false);
      setStatusMessage('准备就绪');
      
    } catch (error) {
      console.error('处理录音失败:', error);
      setIsProcessing(false);
      setStatusMessage(`处理失败: ${error.message}`);
      showSnackbar(`处理失败: ${error.message}`);
    }
  };

  // 模拟响应（仅用于演示）
  const simulateResponse = (audioBlob) => {
    // 创建一个音频URL用于播放
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // 根据当前设置状态模拟不同的响应
    if (svEnabled && !svEnrolled) {
      // 模拟声纹注册提示
      return {
        status: 'sv_enroll_required',
        message: '无声纹注册文件！请先注册声纹，需大于三秒哦~',
        audio_url: null
      };
    } else if (kwsEnabled) {
      // 随机模拟唤醒词识别成功或失败
      const kwsSuccess = Math.random() > 0.3;
      
      if (!kwsSuccess) {
        return {
          status: 'kws_failed',
          message: '很抱歉，唤醒词错误，请说出正确的唤醒词哦',
          audio_url: null
        };
      }
    }
    
    // 模拟声纹验证（如果启用）
    if (svEnabled && svEnrolled) {
      // 随机模拟声纹验证成功或失败
      const svSuccess = Math.random() > 0.2;
      
      if (!svSuccess) {
        return {
          status: 'sv_failed',
          message: '很抱歉，声纹验证失败，我无法为您服务',
          audio_url: null
        };
      }
    }
    
    // 模拟正常响应
    return {
      status: 'success',
      message: '你好啊！我是小千，很高兴为你服务。有什么我能帮你的吗？',
      audio_url: audioUrl,
      user_message: '你好，小千'
    };
  };

  // 处理响应
  const handleResponse = (data) => {
    // 处理不同类型的响应
    switch (data.status) {
      case 'sv_enroll_required':
        // 显示声纹注册提示
        addSystemMessage(data.message);
        showSnackbar('请先注册声纹');
        break;
      
      case 'kws_failed':
        // 显示唤醒词识别失败消息
        addSystemMessage(data.message);
        showSnackbar('唤醒词识别失败');
        break;
        
      case 'sv_failed':
        // 显示声纹验证失败消息
        addSystemMessage(data.message);
        showSnackbar('声纹验证失败');
        break;
      
      case 'success':
        // 添加用户消息和系统响应
        if (data.user_message) {
          addUserMessage(data.user_message);
        }
        addSystemMessage(data.message);
        
        // 播放音频（如果有）
        if (data.audio_url) {
          playAudio(data.audio_url);
        }
        break;
      
      default:
        console.error('未知响应类型:', data);
        showSnackbar('收到未知类型的响应');
    }
  };

  // 播放音频
  const playAudio = (url) => {
    if (audioRef.current) {
      // 如果是相对URL，则添加服务器基础URL
      if (url && url.startsWith('/')) {
        url = `${serverUrl}${url}`;
      }
      audioRef.current.src = url;
      audioRef.current.play().catch(err => {
        console.error('音频播放失败:', err);
        showSnackbar('音频播放失败');
      });
    }
  };

  // 添加用户消息到对话
  const addUserMessage = (text) => {
    const newMessage = {
      id: Date.now(),
      type: 'user',
      text: text,
      timestamp: new Date().toISOString()
    };
    setConversations(prev => [...prev, newMessage]);
  };

  // 添加系统消息到对话
  const addSystemMessage = (text) => {
    const newMessage = {
      id: Date.now(),
      type: 'system',
      text: text,
      timestamp: new Date().toISOString()
    };
    setConversations(prev => [...prev, newMessage]);
  };

  // 清空对话
  const clearConversations = () => {
    setConversations([]);
  };

  // 开始声纹注册
  const startSvEnroll = () => {
    setSvEnrollDialogOpen(true);
  };

  // 开始声纹注册录音
  const startSvEnrollRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = handleSvEnrollStop;

      mediaRecorder.start();
      setSvEnrollRecording(true);
      
      // 启动计时器
      setSvEnrollTime(0);
      svEnrollTimerRef.current = setInterval(() => {
        setSvEnrollTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('声纹录音失败:', error);
      showSnackbar('声纹录音失败，请检查麦克风权限');
    }
  };

  // 停止声纹注册录音
  const stopSvEnrollRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setSvEnrollRecording(false);
      
      // 停止计时器
      if (svEnrollTimerRef.current) {
        clearInterval(svEnrollTimerRef.current);
        svEnrollTimerRef.current = null;
      }
    }
  };

  // 处理声纹注册录音停止
  const handleSvEnrollStop = async () => {
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      
      // 检查录音时长是否足够
      if (svEnrollTime < 3) {
        // 提示时间不足
        showSnackbar('声纹注册时间不足3秒，请重新录音');
        return;
      }
      
      // 使用API发送声纹注册请求
      try {
        // 实际连接后端时使用
        const response = await voiceAssistantAPI.enrollSpeaker(audioBlob);
        
        if (response.status === 'success') {
          setSvEnrolled(true);
          setSvEnrollDialogOpen(false);
          
          // 添加系统消息
          addSystemMessage('声纹注册成功！现在只有你可以命令我啦！');
          showSnackbar('声纹注册成功！');
        } else {
          showSnackbar(`声纹注册失败: ${response.message || '未知错误'}`);
        }
        
        // 模拟成功
        // localStorage.setItem('svEnrolled', 'true');
        // setSvEnrolled(true);
        // setSvEnrollDialogOpen(false);
        
        // 添加系统消息
        // addSystemMessage('声纹注册成功！现在只有你可以命令我啦！');
        // showSnackbar('声纹注册成功！');
      } catch (error) {
        console.error('声纹注册请求失败:', error);
        showSnackbar('声纹注册请求失败，请检查服务器连接');
      }
      
    } catch (error) {
      console.error('处理声纹注册失败:', error);
      showSnackbar('处理声纹注册失败');
    }
  };

  // 更新唤醒词
  const updateKeyword = async () => {
    try {
      // 实际连接后端时使用
      const response = await voiceAssistantAPI.updateKeyword(kwsText);
      
      if (response.status === 'success') {
        showSnackbar('唤醒词更新成功');
      } else {
        showSnackbar(`唤醒词更新失败: ${response.message || '未知错误'}`);
      }
      
      // 模拟成功
      // showSnackbar('唤醒词更新成功');
    } catch (error) {
      console.error('更新唤醒词失败:', error);
      showSnackbar('更新唤醒词失败，请检查服务器连接');
    }
  };

  // 设置对话框
  const SettingsDialog = () => (
    <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>设置</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <FormControlLabel
            control={<Switch checked={kwsEnabled} onChange={(e) => setKwsEnabled(e.target.checked)} />}
            label="唤醒词识别"
          />
          
          {kwsEnabled && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField
                label="唤醒词"
                value={kwsText}
                onChange={(e) => setKwsText(e.target.value)}
                variant="outlined"
                size="small"
                sx={{ flexGrow: 1 }}
              />
              <Button 
                variant="contained" 
                size="small"
                onClick={updateKeyword}
              >
                更新
              </Button>
            </Box>
          )}
          
          <Divider />
          
          <FormControlLabel
            control={<Switch checked={svEnabled} onChange={(e) => setSvEnabled(e.target.checked)} />}
            label="声纹识别"
          />
          
          {svEnabled && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button 
                variant="contained" 
                color={svEnrolled ? "success" : "primary"}
                onClick={startSvEnroll}
                startIcon={<PersonIcon />}
              >
                {svEnrolled ? "重新注册声纹" : "注册声纹"}
              </Button>
              <Typography variant="body2" color={svEnrolled ? "success.main" : "text.secondary"}>
                {svEnrolled ? "已注册" : "未注册"}
              </Typography>
            </Box>
          )}
          
          <Divider />
          
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              服务器设置
            </Typography>
            <TextField
              label="服务器地址"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
              margin="normal"
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSettingsDialogOpen(false)}>关闭</Button>
      </DialogActions>
    </Dialog>
  );

  // 声纹注册对话框
  const SvEnrollDialog = () => (
    <Dialog open={svEnrollDialogOpen} onClose={() => !svEnrollRecording && setSvEnrollDialogOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>声纹注册</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body1">
            请对着麦克风说话，至少持续<strong>3秒</strong>以上。
          </Typography>
          
          {svEnrollRecording ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, my: 2 }}>
              <CircularProgress size={40} />
              <Typography variant="h6" color="primary">
                录音中...{svEnrollTime}秒
              </Typography>
              <LinearProgress variant="determinate" value={Math.min(100, (svEnrollTime / 3) * 100)} sx={{ width: '100%' }} />
            </Box>
          ) : (
            <Alert severity="info" sx={{ my: 2 }}>
              请清晰地说出一些句子，以便系统可以识别您的声音特征。
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {!svEnrollRecording ? (
          <>
            <Button onClick={() => setSvEnrollDialogOpen(false)}>取消</Button>
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<MicIcon />}
              onClick={startSvEnrollRecording}
            >
              开始录音
            </Button>
          </>
        ) : (
          <Button 
            variant="contained" 
            color="error" 
            startIcon={<StopIcon />}
            onClick={stopSvEnrollRecording}
          >
            停止录音
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );

  // 会话列表组件
  const ConversationsList = () => (
    <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
      {conversations.length === 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.7 }}>
          <HelpIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            对我说"乐迪乐迪"来开始对话
          </Typography>
        </Box>
      ) : (
        conversations.map((message) => (
          <Box
            key={message.id}
            sx={{
              display: 'flex',
              justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
              mb: 2
            }}
          >
            {message.type === 'system' && (
              <Avatar src="/images/peiqi.png" sx={{ mr: 1 }}></Avatar>
            )}
            
            <Paper
              sx={{
                p: 2,
                maxWidth: '70%',
                backgroundColor: message.type === 'user' ? 'primary.light' : 'background.paper',
                borderRadius: 2,
                boxShadow: 1
              }}
            >
              <Typography variant="body1">{message.text}</Typography>
            </Paper>
            
            {message.type === 'user' && (
              <Avatar sx={{ bgcolor: 'secondary.main', ml: 1 }}>我</Avatar>
            )}
          </Box>
        ))
      )}
    </Box>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 头部 */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">小千语音助手</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
            {statusMessage}
          </Typography>
          
          <Tooltip title="设置">
            <IconButton onClick={() => setSettingsDialogOpen(true)}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
      
      {/* 主体内容 */}
      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
        {/* 左侧 - 助手头像和音频可视化 */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexGrow: 1 }}>
              <Avatar
                src="/avatar.png"
                alt="小千助手"
                sx={{ 
                  width: 120, 
                  height: 120, 
                  mb: 3,
                  border: 3,
                  borderColor: isRecording ? 'success.main' : 'primary.light'
                }}
              />
              
              {/* 音频波形可视化 */}
              <Box sx={{ 
                width: '100%', 
                height: 60, 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 3
              }}>
                {audioWaves.map((height, index) => (
                  <Box
                    key={index}
                    sx={{
                      height: `${height}px`,
                      width: '8px',
                      bgcolor: 'primary.main',
                      borderRadius: '4px',
                      transition: 'height 0.1s ease'
                    }}
                  />
                ))}
              </Box>
              
              {/* 状态指示器 */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: isRecording ? 'success.main' : 'grey.400',
                    mr: 1
                  }}
                />
                <Typography variant="body2" color={isRecording ? 'success.main' : 'text.secondary'}>
                  {isRecording ? '录音中' : '待机中'}
                </Typography>
              </Box>
              
              {/* 设置状态摘要 */}
              <Box sx={{ width: '100%', mt: 'auto' }}>
                <Stack spacing={1} sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    唤醒词: {kwsEnabled ? kwsText : '已禁用'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    声纹识别: {svEnabled ? (svEnrolled ? '已注册' : '未注册') : '已禁用'}
                  </Typography>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        {/* 右侧 - 对话内容 */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* 对话历史 */}
            <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <ConversationsList />
            </Box>
            
            {/* 控制按钮 */}
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={clearConversations}
                disabled={isRecording || isProcessing || conversations.length === 0}
              >
                清空对话
              </Button>
              
              <Box>
                {isProcessing && <CircularProgress size={24} sx={{ mr: 2 }} />}
                
                <Button
                  variant="contained"
                  color={isRecording ? "error" : "primary"}
                  startIcon={isRecording ? <StopIcon /> : <MicIcon />}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                >
                  {isRecording ? "停止录音" : "开始录音"}
                </Button>
              </Box>
            </Box>
          </Card>
        </Grid>
      </Grid>
      
      {/* 设置对话框 */}
      <SettingsDialog />
      
      {/* 声纹注册对话框 */}
      <SvEnrollDialog />
      
      {/* 提示消息 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
      
      {/* 隐藏的音频播放器 */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </Box>
  );
}

export default VoiceAssistant; 