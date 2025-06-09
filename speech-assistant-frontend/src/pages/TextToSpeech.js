import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Slider,
  Tooltip
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import InfoIcon from '@mui/icons-material/Info';
import SpeedIcon from '@mui/icons-material/Speed';
import WavesIcon from '@mui/icons-material/Waves';

// 实际语音列表，将通过API获取
const availableVoices = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '中文 - 晓晓 (女声)', language: '中文' },
  { id: 'zh-CN-YunxiNeural', name: '中文 - 云希 (男声)', language: '中文' },
  { id: 'zh-CN-YunjianNeural', name: '中文 - 云健 (男声)', language: '中文' },
  { id: 'zh-HK-HiuGaaiNeural', name: '粤语 - 晓佳 (女声)', language: '粤语' },
  { id: 'en-US-AriaNeural', name: '英语 - Aria (女声)', language: '英语' },
  { id: 'en-US-GuyNeural', name: '英语 - Guy (男声)', language: '英语' },
  { id: 'ja-JP-NanamiNeural', name: '日语 - Nanami (女声)', language: '日语' },
  { id: 'ko-KR-SunHiNeural', name: '韩语 - SunHi (女声)', language: '韩语' }
];

// API 基本URL
const API_BASE_URL = 'http://localhost:5001/api';

function TextToSpeech() {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('zh-CN-XiaoxiaoNeural');
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [voices, setVoices] = useState(availableVoices);
  const audioRef = useRef(null);

  // 获取支持的语音列表
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/voices`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.voices) {
            setVoices(data.voices);
            console.log("获取到语音列表:", data.voices);
          }
        }
      } catch (err) {
        console.error('获取语音列表失败:', err);
        // 失败时使用默认语音列表
      }
    };
    
    fetchVoices();
  }, []);

  // 分组语音
  const groupedVoices = voices.reduce((acc, voice) => {
    if (!acc[voice.language]) {
      acc[voice.language] = [];
    }
    acc[voice.language].push(voice);
    return acc;
  }, {});

  console.log("分组后的语音:", groupedVoices);
  
  // 播放/暂停音频
  const togglePlay = () => {
    if (audioRef.current) {
      try {
        if (playing) {
          audioRef.current.pause();
          setPlaying(false);
        } else {
          // 在播放前重置错误状态
          setError(null);
          
          const playPromise = audioRef.current.play();
          
          // 现代浏览器中，play()返回一个Promise
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                setPlaying(true);
              })
              .catch(err => {
                console.error('播放错误:', err);
                setError('音频播放失败，请重试');
                setPlaying(false);
              });
          } else {
            // 旧浏览器兼容
            setPlaying(true);
          }
        }
      } catch (err) {
        console.error('播放控制错误:', err);
        setError('音频控制失败，请重试');
        setPlaying(false);
      }
    }
  };

  // 音频播放结束时处理
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => {
        setPlaying(false);
      };
      
      // 添加音频加载错误处理
      audioRef.current.onerror = (e) => {
        console.error('音频加载错误:', e);
        setError('音频加载失败，请重试');
        setPlaying(false);
      };
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
      }
    };
  }, [audioUrl]);

  // 生成语音
  const generateSpeech = async () => {
    if (!text.trim()) {
      setError('请输入要转换的文本');
      return;
    }

    try {
      setError(null);
      setLoading(true);
      
      // 调用后端API
      const response = await fetch(`${API_BASE_URL}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          voice,
          speed,
          pitch
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAudioUrl(data.audioData);
        
        // 确保音频加载
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.load();
          }
        }, 100);
      } else {
        setError(data.error || '生成语音失败，请重试');
      }
    } catch (err) {
      console.error('语音生成错误:', err);
      setError('服务器连接错误，请检查后端服务是否运行');
    } finally {
      setLoading(false);
    }
  };

  // 下载音频
  const downloadAudio = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = 'generated_speech.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <Box sx={{ my: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        文本转语音
      </Typography>
      
      <Grid container spacing={4}>
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              输入文本
            </Typography>
            
            <TextField
              fullWidth
              multiline
              rows={6}
              variant="outlined"
              label="请输入要转换为语音的文本"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="例如：你好，我是人工智能助手。很高兴为您服务！"
              sx={{ mb: 3 }}
            />
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="voice-select-label">选择语音</InputLabel>
                  <Select
                    labelId="voice-select-label"
                    id="voice-select"
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    label="选择语音"
                  >
                    {voices.map((v) => (
                      <MenuItem key={v.id} value={v.id}>
                        {v.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6}>
                <Typography gutterBottom>
                  <Tooltip title="调整语音速度">
                    <SpeedIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  </Tooltip>
                  语速: {speed.toFixed(1)}
                </Typography>
                <Slider
                  value={speed}
                  onChange={(e, newValue) => setSpeed(newValue)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  valueLabelDisplay="auto"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography gutterBottom>
                  <Tooltip title="调整语音音高">
                    <WavesIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                  </Tooltip>
                  音高: {pitch.toFixed(1)}
                </Typography>
                <Slider
                  value={pitch}
                  onChange={(e, newValue) => setPitch(newValue)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  valueLabelDisplay="auto"
                />
              </Grid>
            </Grid>
            
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={generateSpeech}
                disabled={loading || !text.trim()}
                startIcon={loading ? <CircularProgress size={20} /> : null}
              >
                {loading ? '生成中...' : '生成语音'}
              </Button>
              
              {audioUrl && (
                <Box>
                  <Button
                    variant="outlined"
                    color={playing ? 'secondary' : 'primary'}
                    startIcon={playing ? <StopIcon /> : <PlayArrowIcon />}
                    onClick={togglePlay}
                    sx={{ mr: 1 }}
                  >
                    {playing ? '停止' : '播放'}
                  </Button>
                  
                  <Button
                    variant="outlined"
                    startIcon={<SaveAltIcon />}
                    onClick={downloadAudio}
                  >
                    下载
                  </Button>
                </Box>
              )}
            </Box>
            
            {audioUrl && (
              <audio 
                ref={audioRef} 
                src={audioUrl} 
                preload="auto"
                controls={false}
                crossOrigin="anonymous"
                style={{ display: 'none' }} 
              >
                您的浏览器不支持音频播放
              </audio>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                功能说明
              </Typography>
              <Typography variant="body2" paragraph>
                本功能使用EdgeTTS技术将文本转换为自然流畅的语音。您可以选择不同的语音、调整语速和音高，以获得最适合您需求的语音效果。
              </Typography>
              
              <Typography variant="subtitle2" gutterBottom>
                使用说明：
              </Typography>
              <Typography component="div" variant="body2">
                <ol>
                  <li>在文本框中输入要转换的文本</li>
                  <li>选择合适的语音（不同语言和性别）</li>
                  <li>调整语速和音高（可选）</li>
                  <li>点击"生成语音"按钮</li>
                  <li>等待处理完成后，使用播放按钮收听结果</li>
                  <li>满意后可以下载语音文件</li>
                </ol>
              </Typography>
              
              <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
                为获得最佳效果，建议使用与输入文本相匹配的语言语音。
              </Alert>
            </CardContent>
          </Card>
          
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                技术实现
              </Typography>
              <Typography variant="body2">
                <strong>语音合成引擎：</strong> Microsoft EdgeTTS<br />
                <strong>支持语言：</strong> 中文、英语、日语、韩语、粤语等<br />
                <strong>文件格式：</strong> MP3<br />
                <strong>语音特性：</strong> 支持调整语速、音高<br />
                <strong>语音库：</strong> 超过100种不同的语音选择
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default TextToSpeech; 