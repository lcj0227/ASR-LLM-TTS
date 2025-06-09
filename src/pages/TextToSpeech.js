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

// 模拟 API 调用
const fakeApi = {
  // 模拟文本转语音处理
  textToSpeech: (text, voice, speed, pitch) => new Promise(resolve => {
    setTimeout(() => {
      // 这里通常会返回音频 URL 或 Blob
      resolve({
        audioUrl: 'https://example.com/audio.mp3', // 示例 URL
        success: true
      });
    }, 1500);
  })
};

// 模拟可用的语音列表
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

function TextToSpeech() {
  const [text, setText] = useState('');
  const [voice, setVoice] = useState('zh-CN-XiaoxiaoNeural');
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  // 分组语音
  const groupedVoices = availableVoices.reduce((acc, voice) => {
    if (!acc[voice.language]) {
      acc[voice.language] = [];
    }
    acc[voice.language].push(voice);
    return acc;
  }, {});

  // 播放/暂停音频
  const togglePlay = () => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  // 音频播放结束时处理
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => {
        setPlaying(false);
      };
    }
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
      
      const result = await fakeApi.textToSpeech(text, voice, speed, pitch);
      
      if (result.success) {
        setAudioUrl(result.audioUrl);
        // 在实际应用中，这里应该设置实际返回的音频 URL
        // 现在我们使用一个示例音频文件来演示功能
        setAudioUrl('https://file-examples.com/storage/fe29a6dce864f1d39de0a45/2017/11/file_example_MP3_700KB.mp3');
      } else {
        setError('生成语音失败，请重试');
      }
    } catch (err) {
      setError('服务器错误，请稍后再试');
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
                  <InputLabel>选择语音</InputLabel>
                  <Select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    label="选择语音"
                  >
                    {Object.keys(groupedVoices).map(language => (
                      <React.Fragment key={language}>
                        <MenuItem disabled sx={{ opacity: 0.7, fontWeight: 'bold' }}>
                          {language}
                        </MenuItem>
                        {groupedVoices[language].map(v => (
                          <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>
                        ))}
                      </React.Fragment>
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
              <audio ref={audioRef} src={audioUrl} style={{ display: 'none' }} />
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