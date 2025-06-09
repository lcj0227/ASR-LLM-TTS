import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Paper,
  Divider,
  Container
} from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import ChatIcon from '@mui/icons-material/Chat';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';

// 功能列表
const features = [
  {
    id: 1,
    title: '实时语音对话',
    description: '使用实时语音识别和合成，提供自然流畅的语音交互体验',
    icon: <RecordVoiceOverIcon fontSize="large" color="primary" />,
    link: '/realtime-chat'
  },
  {
    id: 2,
    title: '按键式语音对话',
    description: '按下按钮录音，松开后自动识别并回答，适合噪音环境',
    icon: <MicIcon fontSize="large" color="primary" />,
    link: '/record-chat'
  },
  {
    id: 3,
    title: '文本转语音',
    description: '将输入的文本转换为自然流畅的语音，支持多种语言和声音',
    icon: <VolumeUpIcon fontSize="large" color="primary" />,
    link: '/text-to-speech'
  },
  {
    id: 4,
    title: '更多功能',
    description: '我们正在开发更多语音交互功能，敬请期待',
    icon: <ChatIcon fontSize="large" color="primary" />,
    link: '/'
  }
];

function Home() {
  return (
    <Box sx={{ my: 4 }}>
      <Paper 
        elevation={2} 
        sx={{ 
          p: 4, 
          borderRadius: 3, 
          background: 'linear-gradient(120deg, #e0f7fa 0%, #bbdefb 100%)',
          mb: 4
        }}
      >
        <Container maxWidth="md">
          <Typography 
            variant="h3" 
            component="h1" 
            sx={{ 
              mb: 2, 
              fontWeight: 600,
              textAlign: 'center' 
            }}
          >
            语音助手演示平台
          </Typography>
          <Typography 
            variant="h6" 
            component="p" 
            sx={{ 
              mb: 3, 
              opacity: 0.9,
              textAlign: 'center' 
            }}
          >
            集成语音识别、大语言模型和语音合成的一体化解决方案
          </Typography>
        </Container>
      </Paper>

      <Typography variant="h4" component="h2" gutterBottom>
        功能概览
      </Typography>
      <Divider sx={{ mb: 4 }} />

      <Grid container spacing={3}>
        {features.map((feature) => (
          <Grid item xs={12} sm={6} md={4} key={feature.id}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-5px)',
                  boxShadow: 6
                }
              }}
            >
              <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 4 }}>
                <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                <Typography variant="h5" component="h3" gutterBottom>
                  {feature.title}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {feature.description}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'center', pb: 3 }}>
                <Button 
                  variant="contained" 
                  component={RouterLink} 
                  to={feature.link}
                  size="large"
                >
                  开始使用
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ mt: 6, p: 4, borderRadius: 3, bgcolor: '#f5f7fa' }}>
        <Typography variant="h5" gutterBottom>
          关于本项目
        </Typography>
        <Typography variant="body1" paragraph>
          本项目展示了将语音识别技术、大语言模型和语音合成技术结合，构建智能语音交互系统的可能性。系统使用SenseVoice进行语音识别，QWen2.5实现对话生成，EdgeTTS进行语音合成。
        </Typography>
        <Typography variant="body1">
          该系统支持多种语言，包括中文、英语、日语、韩语和粤语，可以满足不同用户的需求。无论是实时对话、按键式交互还是文本转语音，都提供了简单易用的界面和流畅的用户体验。
        </Typography>
      </Paper>
    </Box>
  );
}

export default Home; 