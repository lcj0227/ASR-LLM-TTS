import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  TextField,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { Mic as MicIcon, Stop as StopIcon, Send as SendIcon } from '@mui/icons-material';
import ChatStore from '../../stores/ChatStore';

const ChatPage = observer(() => {
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // 连接WebSocket
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws/chat';
    ChatStore.connect(wsUrl);

    return () => {
      ChatStore.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ChatStore.messages]);

  const handleStartRecording = () => {
    // 实现录音逻辑
    ChatStore.setRecording(true);
  };

  const handleStopRecording = () => {
    ChatStore.setRecording(false);
    ChatStore.requestProcess();
  };

  const handleSendText = () => {
    if (textInput.trim()) {
      ChatStore.sendText(textInput);
      setTextInput('');
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        实时对话
      </Typography>

      {ChatStore.error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => ChatStore.clearError()}>
          {ChatStore.error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="body2" color={ChatStore.connected ? 'success.main' : 'error.main'}>
          状态: {ChatStore.connected ? '已连接' : '未连接'}
        </Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2, height: '400px', overflow: 'auto' }}>
        <List>
          {ChatStore.messages.map((message) => (
            <ListItem
              key={message.id}
              sx={{
                justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <Paper
                sx={{
                  p: 1.5,
                  maxWidth: '70%',
                  bgcolor: message.type === 'user' ? 'primary.light' : 'grey.100',
                }}
              >
                <ListItemText
                  primary={message.text}
                  secondary={new Date(message.timestamp).toLocaleTimeString()}
                />
                {message.audioUrl && (
                  <audio controls src={message.audioUrl} style={{ width: '100%', marginTop: 8 }} />
                )}
              </Paper>
            </ListItem>
          ))}
        </List>
        <div ref={messagesEndRef} />
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant="contained"
            color={ChatStore.isRecording ? 'error' : 'primary'}
            startIcon={ChatStore.isRecording ? <StopIcon /> : <MicIcon />}
            onClick={ChatStore.isRecording ? handleStopRecording : handleStartRecording}
            disabled={!ChatStore.connected}
          >
            {ChatStore.isRecording ? '停止录音' : '开始录音'}
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            placeholder="输入文本消息..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendText();
              }
            }}
          />
          <Button
            variant="contained"
            startIcon={<SendIcon />}
            onClick={handleSendText}
            disabled={!ChatStore.connected}
          >
            发送
          </Button>
        </Box>
      </Paper>
    </Box>
  );
});

export default ChatPage;

