import React from 'react';
import { Link } from 'react-router-dom';
import {
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
} from '@mui/material';
import {
  RecordVoiceOver as VoiceCloneIcon,
  Face as LipSyncIcon,
  Chat as ChatIcon,
  School as TrainingIcon,
} from '@mui/icons-material';

const Dashboard = () => {
  const features = [
    {
      title: '语音克隆',
      description: '上传参考音频，克隆任意声音进行语音合成',
      icon: <VoiceCloneIcon sx={{ fontSize: 60 }} />,
      path: '/voice-clone',
      color: '#1976d2',
    },
    {
      title: '唇形同步',
      description: '将音频与人脸图片/视频结合，生成唇形同步视频',
      icon: <LipSyncIcon sx={{ fontSize: 60 }} />,
      path: '/lip-sync',
      color: '#dc004e',
    },
    {
      title: '实时对话',
      description: '实时语音对话，支持ASR、LLM、TTS完整流程',
      icon: <ChatIcon sx={{ fontSize: 60 }} />,
      path: '/chat',
      color: '#2e7d32',
    },
    {
      title: '训练管理',
      description: '离线训练语音克隆和唇形同步模型',
      icon: <TrainingIcon sx={{ fontSize: 60 }} />,
      path: '/training',
      color: '#ed6c02',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4 }}>
        数字人Web端平台
      </Typography>
      <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 4 }}>
        支持声音/视频克隆、唇形同步、实时对话和离线训练
      </Typography>

      <Grid container spacing={3}>
        {features.map((feature) => (
          <Grid item xs={12} sm={6} md={3} key={feature.path}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                },
              }}
            >
              <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                <Box sx={{ color: feature.color, mb: 2 }}>
                  {feature.icon}
                </Box>
                <Typography variant="h6" component="h2" gutterBottom>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </CardContent>
              <CardActions>
                <Button
                  component={Link}
                  to={feature.path}
                  fullWidth
                  variant="contained"
                  sx={{ backgroundColor: feature.color }}
                >
                  开始使用
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default Dashboard;

