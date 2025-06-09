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
  FormControl,
  Select,
  MenuItem,
  LinearProgress
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import VideocamIcon from '@mui/icons-material/Videocam';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoIcon from '@mui/icons-material/Info';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import SettingsIcon from '@mui/icons-material/Settings';
import SendIcon from '@mui/icons-material/Send';
import io from 'socket.io-client';

function SceneVoiceChat() {
  // 状态管理
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('准备就绪');
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [serverUrl, setServerUrl] = useState('http://localhost:8080');
  const [useRealServer, setUseRealServer] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [serverConfig, setServerConfig] = useState(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [audioContext, setAudioContext] = useState(null);
  const [videoError, setVideoError] = useState('');
  const [videoInfo, setVideoInfo] = useState({});
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [availableVideoDevices, setAvailableVideoDevices] = useState([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState('');
  const [videoElementReady, setVideoElementReady] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [asrConfidence, setAsrConfidence] = useState(0);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  
  // 引用
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const capturedFramesRef = useRef([]);
  const socketRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  // 连接WebSocket
  const connectWebSocket = () => {
    if (useRealServer) {
      // 使用实际WebSocket服务器
      try {
        setStatusMessage('正在连接到服务器...');
        
        console.log('准备连接到服务器:', serverUrl);

        // 添加Socket.io配置
        const socketOptions = {
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000,
          transports: ['websocket', 'polling'],
          path: '/socket.io/'  // 确保路径正确
        };

        console.log('Socket.io配置:', socketOptions);

        // 使用新的配置连接
        socketRef.current = io(serverUrl, socketOptions);
        
        socketRef.current.on('connect', () => {
          console.log('已连接到WebSocket服务器');
          setStatusMessage('已连接到服务器，正在录制中...');
          setIsConnected(true);
          setReconnectCount(0); // 重置重连计数
        });
        
        socketRef.current.on('disconnect', () => {
          console.log('与WebSocket服务器断开连接');
          setStatusMessage('与服务器断开连接');
          setIsConnected(false);
        });
        
        socketRef.current.on('connect_error', (error) => {
          console.error('WebSocket连接错误:', error);
          setStatusMessage(`连接错误: ${error.message}`);
          setIsConnected(false);
          setReconnectCount(prev => prev + 1);
          
          // 记录详细错误信息
          console.log('连接错误详情:', {
            message: error.message,
            description: error.description,
            type: error.type,
            target: error.target
          });
          
          // 如果重连次数过多，自动切换到模拟模式
          if (reconnectCount > 3) {
            console.log('多次连接失败，切换到模拟模式');
            setUseRealServer(false);
            setStatusMessage('多次连接失败，已切换到模拟模式');
            simulateResponses();
          }
        });
        
        socketRef.current.on('server_info', (data) => {
          console.log('服务器信息:', data);
          // 存储服务器配置信息
          setServerConfig(data);
        });
        
        socketRef.current.on('server_error', (data) => {
          console.error('服务器错误:', data);
          setStatusMessage(`服务器错误: ${data.message}`);
        });
        
        socketRef.current.on('asr_result', (data) => {
          console.log('收到ASR结果:', data);
          // 添加用户消息到对话列表
          const userMessage = {
            id: Date.now(),
            type: 'user',
            text: data.text,
            timestamp: new Date().toISOString(),
            audioUrl: null,
            confidence: data.confidence || 0,
            imageUrl: capturedFramesRef.current.length > 0 
              ? capturedFramesRef.current[capturedFramesRef.current.length - 1].dataUrl 
              : null
          };
          
          setAsrConfidence(data.confidence || 0);
          setConversations(prev => [...prev, userMessage]);
          setIsProcessing(true); // 设置处理中状态
          
          // 确保响应被发送
          return true;
        });
        
        socketRef.current.on('llm_response', (data) => {
          console.log('收到LLM响应:', data);
          // 添加助手消息到对话列表
          const assistantMessage = {
            id: Date.now(),
            type: 'assistant',
            text: data.text,
            timestamp: new Date().toISOString(),
            audioUrl: data.audioUrl || null,
            imageUrl: null,
            metadata: {
              processed_frames: data.processed_frames || 0,
              timestamp: data.timestamp
            }
          };
          
          setConversations(prev => [...prev, assistantMessage]);
          setIsProcessing(false);
          
          // 如果有语音URL并且TTS功能已启用，播放语音
          if (data.audioUrl && ttsEnabled) {
            playAudio(data.audioUrl);
          }
          
          // 确保响应被发送
          return true;
        });
        
        // 添加调试日志
      } catch (error) {
        console.error('WebSocket连接失败:', error);
        setStatusMessage(`连接失败: ${error.message}`);
        setIsConnected(false);
        // 失败时回退到模拟模式
        simulateResponses();
      }
    } else {
      // 使用模拟响应
      socketRef.current = {
        send: (data) => {
          console.log('模拟发送数据到服务器:', data);
        },
        close: () => {
          console.log('模拟WebSocket连接已关闭');
        }
      };
      
      // 模拟接收从服务器返回的对话数据
      simulateResponses();
    }
  };

  // 启动录制
  const startRecording = async () => {
    try {
      setStatusMessage('正在启动摄像头和麦克风...');
      console.log('请求媒体设备...');
      
      // 先列出可用的视频设备
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log('可用视频设备:', videoDevices);
      setVideoInfo(prev => ({ ...prev, devices: videoDevices }));
      
      if (videoDevices.length === 0) {
        console.warn('未检测到视频设备');
        setVideoError('未检测到视频设备，请确认摄像头已连接');
      }
      
      // 获取媒体流
      const constraints = {
        audio: true,
        video: selectedVideoDeviceId 
          ? { 
              deviceId: { exact: selectedVideoDeviceId },
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 }
            }
          : {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 }
            }
      };
      
      console.log('使用约束:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // 获取流信息
      const videoTracks = stream.getVideoTracks();
      if (videoTracks.length > 0) {
        const settings = videoTracks[0].getSettings();
        console.log('视频轨道设置:', settings);
        setVideoInfo(prev => ({ ...prev, settings }));
      }
      
      streamRef.current = stream;
      setVideoError('');
      
      console.log('成功获取媒体流:', stream);
      
      // 设置视频预览
      setTimeout(() => {
        if (videoRef.current) {
          console.log('设置视频流到预览元素...');
          try {
            videoRef.current.srcObject = stream;
            console.log('视频源对象已设置:', stream.id);
            
            // 记录视频轨道信息用于调试
            const videoTracks = stream.getVideoTracks();
            if (videoTracks.length > 0) {
              const trackInfo = {
                label: videoTracks[0].label,
                id: videoTracks[0].id,
                enabled: videoTracks[0].enabled,
                muted: videoTracks[0].muted,
                readyState: videoTracks[0].readyState
              };
              console.log('视频轨道信息:', trackInfo);
              setVideoInfo(prev => ({ ...prev, trackInfo }));
            }
          } catch (err) {
            console.error('设置视频源时出错:', err);
            setVideoError(`设置视频源失败: ${err.message}`);
          }
        } else {
          console.error('视频元素仍然不存在');
          setVideoError('视频元素引用不存在，请刷新页面重试');
        }
      }, 100);
      
      // 创建MediaRecorder用于录制音频
      const audioTrack = stream.getAudioTracks()[0];
      const audioStream = new MediaStream([audioTrack]);
      
      mediaRecorderRef.current = new MediaRecorder(audioStream);
      
      // 设置录制事件
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // 在实际模式下，将音频数据发送到服务器
          if (useRealServer && socketRef.current && isConnected) {
            try {
              // 转换Blob为ArrayBuffer以便发送
              event.data.arrayBuffer().then(buffer => {
                socketRef.current.emit('audio_data', {
                  audio: buffer,
                  timestamp: Date.now(),
                  device_info: {
                    sampleRate: audioContext?.sampleRate || 48000,
                    channels: 1
                  }
                }, (response) => {
                  // 添加回调函数处理响应
                  if (response) {
                    console.log('音频数据发送成功:', response);
                  }
                });
              });
            } catch (error) {
              console.error('发送音频数据失败:', error);
            }
          }
        }
      };
      
      // 每100ms获取一次音频数据
      mediaRecorderRef.current.start(100);
      
      // 连接WebSocket
      connectWebSocket();
      
      // 启动录制
      setIsRecording(true);
      setStatusMessage('正在录制中...');
      
      // 周期性捕获视频帧
      startFrameCapture();
      
    } catch (error) {
      console.error('启动录制失败:', error);
      setStatusMessage(`启动录制失败: ${error.message}`);
      setVideoError(`获取媒体设备失败: ${error.message}`);
      throw error; // 重新抛出错误以便外层catch能捕获
    }
  };

  // 停止录制
  const stopRecording = () => {
    if (streamRef.current) {
      // 停止MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      
      // 停止所有轨道
      streamRef.current.getTracks().forEach(track => track.stop());
      
      // 关闭WebSocket连接
      if (socketRef.current) {
        if (useRealServer) {
          socketRef.current.disconnect();
        } else {
          socketRef.current.close();
        }
      }
      
      // 更新状态
      setIsRecording(false);
      setStatusMessage('录制已停止');
      
      // 清理资源
      streamRef.current = null;
      capturedFramesRef.current = [];
      audioChunksRef.current = [];
      
      // 如果视频元素存在，清除源
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  // 捕获视频帧
  const startFrameCapture = () => {
    const frameRate = 2; // 每2秒捕获一帧
    const captureInterval = setInterval(() => {
      if (!isRecording) {
        clearInterval(captureInterval);
        return;
      }
      
      // 如果视频和画布元素存在，捕获当前帧
      if (videoRef.current && canvasRef.current) {
        try {
          const context = canvasRef.current.getContext('2d');
          
          // 设置画布尺寸与视频尺寸相同
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
          
          // 在画布上绘制当前视频帧
          context.drawImage(
            videoRef.current,
            0, 0,
            videoRef.current.videoWidth,
            videoRef.current.videoHeight
          );
          
          // 将画布内容转换为数据URL (较高质量用于本地存储)
          const frameDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.85);
          
          // 存储捕获的帧
          capturedFramesRef.current.push({
            time: new Date().toISOString(),
            dataUrl: frameDataUrl
          });
          
          // 限制存储的帧数量，防止内存过度使用
          if (capturedFramesRef.current.length > 20) {
            capturedFramesRef.current = capturedFramesRef.current.slice(-20);
          }
          
          // 发送帧数据到服务器
          if (useRealServer && socketRef.current && isConnected) {
            // 降低图像质量以减少数据传输量
            const compressedFrameDataUrl = canvasRef.current.toDataURL('image/jpeg', 0.5);
            
            socketRef.current.emit('video_frame', {
              frame: compressedFrameDataUrl,
              timestamp: Date.now(),
              resolution: {
                width: canvasRef.current.width,
                height: canvasRef.current.height
              }
            }, (response) => {
              // 添加回调函数处理响应
              if (response) {
                console.log('视频帧发送成功:', response);
              }
            });
          }
        } catch (error) {
          console.error('捕获视频帧失败:', error);
        }
      }
    }, 1000 / frameRate);
    
    return captureInterval;
  };

  // 模拟接收从服务器返回的对话数据
  const simulateResponses = () => {
    // 这是一个模拟函数，实际实现应该是基于WebSocket接收服务器消息
    
    const simulatedMessages = [
      {
        id: 1,
        type: 'user',
        text: '这是什么地方？',
        timestamp: new Date().toISOString(),
        audioUrl: null,
        imageUrl: 'https://via.placeholder.com/320x240'
      },
      {
        id: 2,
        type: 'assistant',
        text: '根据画面，这看起来是一个办公室环境，有电脑显示器和办公桌。',
        timestamp: new Date().toISOString(),
        audioUrl: '/demo-audio.mp3',
        imageUrl: null
      },
      {
        id: 3,
        type: 'user',
        text: '现在几点了？',
        timestamp: new Date().toISOString(),
        audioUrl: null,
        imageUrl: 'https://via.placeholder.com/320x240'
      },
      {
        id: 4,
        type: 'assistant',
        text: '从画面中的时钟来看，现在大约是下午3点15分左右。',
        timestamp: new Date().toISOString(),
        audioUrl: '/demo-audio.mp3',
        imageUrl: null
      }
    ];
    
    // 模拟随时间推移接收消息
    let index = 0;
    
    const messageInterval = setInterval(() => {
      if (index < simulatedMessages.length && isRecording) {
        setConversations(prev => [...prev, simulatedMessages[index]]);
        index++;
      } else {
        clearInterval(messageInterval);
      }
    }, 5000); // 每5秒添加一条消息
  };

  // 播放音频
  const playAudio = (url) => {
    if (!url) return;
    
    try {
      // 停止正在播放的音频
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      // 如果音频元素不存在，创建一个新的
      if (!audioRef.current) {
        audioRef.current = new Audio();
        
        // 添加事件监听器
        audioRef.current.addEventListener('ended', () => {
          console.log('音频播放完成');
        });
        
        audioRef.current.addEventListener('error', (e) => {
          console.error('音频播放错误:', e);
          setStatusMessage('音频播放失败');
        });
      }
      
      // 设置音频源并播放
      audioRef.current.src = url;
      audioRef.current.play().catch(error => {
        console.error('播放音频失败:', error);
      });
    } catch (error) {
      console.error('播放音频出错:', error);
    }
  };

  // 设置对话框
  const SettingsDialog = () => (
    <Dialog
      open={settingsDialogOpen}
      onClose={() => setSettingsDialogOpen(false)}
    >
      <DialogTitle>系统设置</DialogTitle>
      <DialogContent>
        <Box sx={{ minWidth: 400, p: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={useRealServer}
                onChange={(e) => setUseRealServer(e.target.checked)}
              />
            }
            label="使用实际服务器"
          />
          
          <TextField
            fullWidth
            margin="normal"
            label="服务器地址"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            disabled={!useRealServer}
            helperText={useRealServer ? "请输入WebSocket服务器地址" : "当前使用模拟模式，无需服务器"}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={ttsEnabled}
                onChange={(e) => setTtsEnabled(e.target.checked)}
              />
            }
            label="启用语音合成(TTS)"
          />
          
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            注意：实际服务器模式需要运行后端Python服务。
            如果您没有配置后端服务，请保持使用模拟模式。
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setSettingsDialogOpen(false)}>关闭</Button>
      </DialogActions>
    </Dialog>
  );

  // 信息对话框
  const InfoDialog = () => (
    <Dialog
      open={infoDialogOpen}
      onClose={() => setInfoDialogOpen(false)}
      maxWidth="md"
    >
      <DialogTitle>关于场景语音对话</DialogTitle>
      <DialogContent>
        <Box sx={{ minWidth: 400, maxWidth: 800 }}>
          <Typography variant="body1" paragraph>
            场景语音对话功能使用了以下技术：
          </Typography>
          <ul>
            <li>WebRTC VAD - 用于语音活动检测</li>
            <li>SenseVoice - 语音识别</li>
            <li>Qwen2-VL - 多模态视觉语言模型</li>
            <li>Edge TTS - 文本转语音</li>
          </ul>
          <Typography variant="body1" paragraph>
            系统会同时录制您的视频和音频，分析您的问题并结合场景内容提供回答。
          </Typography>
          <Typography variant="body1" paragraph>
            支持多语种回答和自动语音合成。
          </Typography>

          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle1" gutterBottom>
            后端服务实现说明
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            要连接实际的后端服务，您需要实现一个基于WebSocket的服务器，以下是Python实现示例：
          </Typography>
          <Box 
            component="pre"
            sx={{ 
              backgroundColor: '#f5f5f5', 
              p: 2, 
              borderRadius: 1, 
              overflow: 'auto',
              fontSize: '0.75rem',
              mt: 1,
              maxHeight: '400px'
            }}
          >
{`# 后端WebSocket服务器示例 (server.py)
from flask import Flask, request
from flask_socketio import SocketIO, emit
import numpy as np
import tempfile
import os
import base64
import asyncio
import threading
import wave
import cv2

# 导入必要的模型
# from transformers import Qwen2VLForConditionalGeneration, AutoProcessor
# from funasr import AutoModel
# import edge_tts

app = Flask(__name__)
app.config['SECRET_KEY'] = 'scene-voice-secret'
socketio = SocketIO(app, cors_allowed_origins="*")

# 临时存储音频和图像
audio_chunks = {}
video_frames = {}

# 设置模型
# model_dir = "模型路径"
# model_senceVoice = AutoModel(model=model_dir, trust_remote_code=True)
# qwen_model = Qwen2VLForConditionalGeneration.from_pretrained("Qwen/Qwen2-VL-2B-Instruct")
# processor = AutoProcessor.from_pretrained("Qwen/Qwen2-VL-2B-Instruct")

@socketio.on('connect')
def handle_connect():
    print('客户端已连接:', request.sid)
    audio_chunks[request.sid] = []
    video_frames[request.sid] = []

@socketio.on('disconnect')
def handle_disconnect():
    print('客户端已断开连接:', request.sid)
    if request.sid in audio_chunks:
        del audio_chunks[request.sid]
    if request.sid in video_frames:
        del video_frames[request.sid]

@socketio.on('audio_data')
def handle_audio_data(data):
    client_id = request.sid
    if client_id not in audio_chunks:
        audio_chunks[client_id] = []
    
    # 存储音频数据
    audio_chunks[client_id].append(data['audio'])
    
    # 检查是否有足够的音频数据进行处理
    if len(audio_chunks[client_id]) >= 10:  # 约1秒的音频
        process_audio(client_id)

@socketio.on('video_frame')
def handle_video_frame(data):
    client_id = request.sid
    if client_id not in video_frames:
        video_frames[client_id] = []
    
    # 存储帧数据
    frame_data = data['frame']
    if frame_data.startswith('data:image'):
        frame_data = frame_data.split(',')[1]
    
    video_frames[client_id].append({
        'data': frame_data,
        'timestamp': data['timestamp']
    })

def process_audio(client_id):
    # 合并音频块
    audio_data = b''.join(audio_chunks[client_id])
    audio_chunks[client_id] = []  # 清空缓冲区
    
    # 保存为临时WAV文件
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
        temp_path = temp_file.name
        with wave.open(temp_path, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(audio_data)
    
    # 使用SenseVoice进行ASR
    # res = model_senceVoice.generate(input=temp_path, language="auto")
    # asr_text = res[0]['text']
    
    # 模拟ASR结果
    asr_text = "这是模拟的语音识别结果"
    
    # 发送ASR结果给客户端
    emit('asr_result', {'text': asr_text}, room=client_id)
    
    # 如果有足够的视频帧，处理多模态理解
    if len(video_frames[client_id]) > 0:
        process_multimodal(client_id, asr_text)
    
    # 清理临时文件
    os.unlink(temp_path)

def process_multimodal(client_id, text_query):
    # 获取最近的视频帧
    recent_frames = video_frames[client_id][-4:]  # 最近4帧
    video_frames[client_id] = []  # 清空帧缓冲区
    
    # 将Base64图像数据转换为OpenCV图像
    images = []
    for frame_info in recent_frames:
        img_data = base64.b64decode(frame_info['data'])
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
            temp_file.write(img_data)
            images.append(temp_file.name)
    
    # 构建Qwen2-VL的输入
    # messages = [
    #    {
    #        "role": "user",
    #        "content": [
    #            {
    #                "type": "video",
    #                "video": images,
    #                "fps": 1.0,
    #            },
    #            {"type": "text", "text": text_query},
    #        ],
    #    }
    # ]
    
    # 模拟LLM响应
    # text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    # image_inputs, video_inputs = process_vision_info(messages)
    # inputs = processor(text=[text], images=image_inputs, videos=video_inputs, return_tensors="pt")
    # generated_ids = qwen_model.generate(**inputs, max_new_tokens=128)
    # generated_ids_trimmed = [out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)]
    # llm_response = processor.batch_decode(generated_ids_trimmed, skip_special_tokens=True)[0]
    
    llm_response = "这是一个模拟的多模态回答。真实实现中，这里会返回基于视频画面和问题的回答。"
    
    # 文本转语音
    # 实际实现中，这里应调用Edge TTS或其他TTS服务生成语音文件
    # audio_url = generate_tts(llm_response)
    audio_url = "/demo-audio.mp3"  # 模拟的音频URL
    
    # 发送LLM响应给客户端
    emit('llm_response', {
        'text': llm_response,
        'audioUrl': audio_url
    }, room=client_id)
    
    # 清理临时文件
    for img_path in images:
        os.unlink(img_path)

# 启动服务器
if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
`}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            将以上代码保存为server.py，安装必要的依赖后运行即可启动WebSocket服务器。
            前端可通过设置页面配置连接地址为http://localhost:5000进行连接。
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setInfoDialogOpen(false)}>关闭</Button>
      </DialogActions>
    </Dialog>
  );

  // 消息列表
  const ConversationsList = () => (
    <Stack spacing={2} sx={{ maxHeight: '60vh', overflow: 'auto', p: 2 }}>
      {conversations.map((message) => (
        <Box
          key={message.id}
          sx={{
            display: 'flex',
            justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
            mb: 2
          }}
        >
          <Card
            sx={{
              maxWidth: '80%',
              backgroundColor: message.type === 'user' ? '#e3f2fd' : '#f5f5f5',
              borderRadius: '12px',
              boxShadow: 1
            }}
          >
            <CardContent>
              <Typography variant="body1" gutterBottom>
                {message.text}
              </Typography>
              
              {message.imageUrl && (
                <Box sx={{ mt: 1, borderRadius: '8px', overflow: 'hidden' }}>
                  <img 
                    src={message.imageUrl}
                    alt="Captured frame"
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover' }}
                  />
                </Box>
              )}
              
              {message.audioUrl && (
                <IconButton 
                  color="primary" 
                  onClick={() => playAudio(message.audioUrl)}
                  sx={{ mt: 1 }}
                >
                  <VolumeUpIcon />
                </IconButton>
              )}
              
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </Typography>

              {message.type === 'user' && message.confidence !== undefined && (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1 }}>
                    识别准确度:
                  </Typography>
                  <Box sx={{ width: '60px', mr: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={message.confidence * 100} 
                      color={message.confidence > 0.7 ? "success" : message.confidence > 0.4 ? "warning" : "error"}
                    />
                  </Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {Math.round(message.confidence * 100)}%
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      ))}
    </Stack>
  );

  // 音频上下文初始化
  useEffect(() => {
    // 创建音频上下文
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const context = new AudioContext();
        setAudioContext(context);
        console.log('音频上下文已创建，采样率:', context.sampleRate);
      }
    } catch (error) {
      console.error('创建音频上下文失败:', error);
    }

    // 检测可用的视频设备
    async function getVideoDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('检测到的视频设备:', videoDevices);
        setAvailableVideoDevices(videoDevices);
        
        // 如果有可用设备，默认选择第一个
        if (videoDevices.length > 0) {
          setSelectedVideoDeviceId(videoDevices[0].deviceId);
        }
      } catch (error) {
        console.error('获取视频设备失败:', error);
        setStatusMessage('获取视频设备失败');
      }
    }

    // 检查摄像头权限
    async function checkCameraPermission() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // 立即释放测试流
        stream.getTracks().forEach(track => track.stop());
        console.log('摄像头权限已授予');
        
        // 获取设备列表
        getVideoDevices();
      } catch (error) {
        console.error('摄像头权限检查失败:', error);
        setStatusMessage('请确保已授予摄像头权限');
      }
    }
    
    checkCameraPermission();
    
    // 标记视频元素可以渲染
    setVideoElementReady(true);
    console.log('视频元素渲染状态已就绪');
    
    // 组件卸载时清理
    return () => {
      if (socketRef.current) {
        if (useRealServer) {
          socketRef.current.disconnect();
        } else {
          socketRef.current.close();
        }
      }
      
      if (audioContext) {
        audioContext.close();
      }
      
      // 确保停止所有媒体流
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // 清除视频源
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  // 在handleMessage函数中处理消息通道关闭问题
  const handleResponse = (response) => {
    // 不再使用chrome.runtime.lastError
    // 而是使用标准错误处理
    try {
      if (response) {
        console.log('接收到响应:', response);
      }
    } catch (error) {
      console.warn('处理响应时发生错误:', error);
    }
  };

  // 修改发送消息函数，添加错误处理
  const sendMessage = () => {
    if (!userInput.trim()) return;
    
    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: userInput,
      timestamp: new Date().toISOString(),
      confidence: 1.0,
      imageUrl: capturedFramesRef.current.length > 0 
        ? capturedFramesRef.current[capturedFramesRef.current.length - 1].dataUrl 
        : null
    };
    
    setConversations(prev => [...prev, userMessage]);
    
    if (useRealServer && socketRef.current && isConnected) {
      try {
        // 发送文本消息到服务器
        socketRef.current.emit('text_input', {
          text: userInput,
          timestamp: Date.now()
        }, (response) => {
          // 添加回调函数处理响应
          handleResponse(response);
        });
        
        setIsProcessing(true);
      } catch (error) {
        console.error('发送消息时出错:', error);
        setStatusMessage(`发送消息失败: ${error.message}`);
        // 如果发送失败，回退到模拟模式
        simulateMessageResponse(userInput);
      }
    } else {
      // 模拟响应
      simulateMessageResponse(userInput);
    }
    
    setUserInput('');
  };

  // 添加模拟消息响应函数
  const simulateMessageResponse = (text) => {
    setTimeout(() => {
      const assistantMessage = {
        id: Date.now(),
        type: 'assistant',
        text: `这是对"${text}"的模拟回复。在实际模式下，会由服务器处理并返回回答。`,
        timestamp: new Date().toISOString(),
        audioUrl: null,
        imageUrl: null
      };
      
      setConversations(prev => [...prev, assistantMessage]);
      setIsProcessing(false);
    }, 1000);
  };

  return (
    <Box sx={{ py: 4 }}>
      {/* 标题和操作按钮 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ flexGrow: 1 }}>
          场景语音对话
        </Typography>
        
        <Tooltip title="系统设置">
          <IconButton onClick={() => setSettingsDialogOpen(true)} sx={{ mr: 1 }}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
        
        <Tooltip title="了解更多">
          <IconButton onClick={() => setInfoDialogOpen(true)}>
            <InfoIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      {/* 主要内容区域 */}
      <Grid container spacing={3}>
        {/* 视频预览部分 */}
        <Grid item xs={12} md={6}>
          <Paper 
            elevation={3} 
            sx={{ 
              p: 2, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              height: '100%' 
            }}
          >
            <Typography variant="h6" gutterBottom>
              摄像头预览
            </Typography>
            
            {/* 添加设备选择下拉菜单 */}
            {!isRecording && availableVideoDevices.length > 0 && (
              <FormControl size="small" sx={{ mb: 2, width: '100%' }}>
                <Typography variant="caption" sx={{ mb: 0.5 }}>选择摄像头设备:</Typography>
                <Select
                  value={selectedVideoDeviceId}
                  onChange={(e) => setSelectedVideoDeviceId(e.target.value)}
                  displayEmpty
                  size="small"
                >
                  {availableVideoDevices.map((device) => (
                    <MenuItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `摄像头 ${device.deviceId.substring(0, 5)}...`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            
            <Box sx={{ 
              position: 'relative',
              width: '100%', 
              height: '320px', 
              backgroundColor: '#000', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              mb: 2,
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              {isRecording ? (
                <>
                  {videoElementReady ? (
                    <video 
                      ref={(el) => {
                        if (el && !videoRef.current) {
                          console.log('视频元素首次引用已设置');
                          videoRef.current = el;
                          
                          // 如果已经有流但尚未设置，立即设置
                          if (streamRef.current && !el.srcObject) {
                            console.log('检测到流但尚未设置，立即应用到视频元素');
                            el.srcObject = streamRef.current;
                          }
                        }
                      }}
                      autoPlay
                      playsInline
                      muted
                      onCanPlay={() => console.log('视频可以播放')}
                      onError={(e) => {
                        console.error('视频元素发生错误:', e);
                        setVideoError(`视频元素错误: ${e.target.error ? e.target.error.message : '未知错误'}`);
                      }}
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover'
                      }} 
                    />
                  ) : (
                    <Box sx={{ color: 'white', textAlign: 'center' }}>
                      <CircularProgress size={24} color="inherit" />
                      <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                        正在准备视频元素...
                      </Typography>
                    </Box>
                  )}
                  {videoError && (
                    <Box sx={{
                      position: 'absolute',
                      bottom: 8,
                      left: 8,
                      right: 8,
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      color: 'error.main',
                      padding: 1,
                      borderRadius: 1,
                      fontSize: '0.75rem'
                    }}>
                      {videoError}
                    </Box>
                  )}
                </>
              ) : (
                <VideocamIcon sx={{ fontSize: 60, color: '#555' }} />
              )}
              
              {showDebugInfo && (
                <Box 
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    padding: 1,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    maxWidth: '80%',
                    maxHeight: '80%',
                    overflow: 'auto'
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'white', fontWeight: 'bold' }}>调试信息:</Typography>
                  <pre style={{ fontSize: '0.65rem', margin: 0 }}>
                    {JSON.stringify(videoInfo, null, 2)}
                  </pre>
                </Box>
              )}
            </Box>
            
            {/* 隐藏的画布用于捕获视频帧 */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              状态: {statusMessage}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              {!isRecording ? (
                <Button 
                  variant="contained" 
                  color="primary" 
                  startIcon={<MicIcon />} 
                  onClick={startRecording}
                  disabled={isProcessing}
                >
                  开始录制
                </Button>
              ) : (
                <Button 
                  variant="contained" 
                  color="error" 
                  startIcon={<StopIcon />} 
                  onClick={stopRecording}
                >
                  停止录制
                </Button>
              )}
              
              <Button 
                variant="outlined" 
                size="small"
                onClick={() => setShowDebugInfo(!showDebugInfo)}
              >
                {showDebugInfo ? '隐藏调试' : '显示调试'}
              </Button>
              
              {isProcessing && (
                <CircularProgress size={24} sx={{ ml: 2 }} />
              )}
            </Box>
          </Paper>
        </Grid>
        
        {/* 对话内容部分 */}
        <Grid item xs={12} md={6}>
          <Paper 
            elevation={3} 
            sx={{ 
              p: 2, 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column' 
            }}
          >
            <Typography variant="h6" gutterBottom>
              对话内容
            </Typography>
            
            <Divider sx={{ mb: 2 }} />
            
            {conversations.length > 0 ? (
              <ConversationsList />
            ) : (
              <Box 
                sx={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  color: 'text.secondary'
                }}
              >
                <AutorenewIcon sx={{ fontSize: 48, mb: 2 }} />
                <Typography>
                  开始录制后，对话将显示在这里
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
      
      {/* 对话框 */}
      <InfoDialog />
      <SettingsDialog />
      
      {/* 连接状态指示器 */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
          服务器状态:
        </Typography>
        <Box 
          sx={{ 
            width: 12, 
            height: 12, 
            borderRadius: '50%', 
            backgroundColor: isConnected ? 'success.main' : 'error.main',
            mr: 1
          }} 
        />
        <Typography variant="body2" color={isConnected ? 'success.main' : 'error.main'}>
          {isConnected ? '已连接' : '未连接'}
        </Typography>
      </Box>

      {/* 添加输入框和发送按钮 */}
      <Box sx={{ display: 'flex', mt: 2, width: '100%' }}>
        <TextField
          fullWidth
          placeholder="输入文字消息..."
          variant="outlined"
          size="small"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          disabled={!isRecording}
          sx={{ mr: 1 }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={sendMessage}
          disabled={!isRecording || !userInput.trim()}
          startIcon={<SendIcon />}
        >
          发送
        </Button>
      </Box>
    </Box>
  );
}

export default SceneVoiceChat;