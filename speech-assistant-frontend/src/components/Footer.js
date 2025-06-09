import React from 'react';
import { Box, Container, Typography, Link } from '@mui/material';

function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: 'auto',
        backgroundColor: (theme) => theme.palette.grey[200],
      }}
    >
      <Container maxWidth="lg">
        <Typography variant="body2" color="text.secondary" align="center">
          {'© '}
          {new Date().getFullYear()}
          {' '}
          <Link color="inherit" href="https://github.com/modelscope/FunASR" target="_blank">
            SenseVoice-QWen2.5-TTS
          </Link>
          {' 语音交互助手 - 基于SenseVoice、QWen2.5和EdgeTTS的语音交互系统'}
        </Typography>
      </Container>
    </Box>
  );
}

export default Footer; 