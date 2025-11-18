import React, { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import VoiceCloneStore from '../../stores/VoiceCloneStore';

const VoiceClonePage = observer(() => {
  const [text, setText] = useState('');
  const [promptText, setPromptText] = useState('');
  const [mode, setMode] = useState('zero_shot');
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    // 加载说话人列表（SFT模式）
    if (mode === 'sft') {
      VoiceCloneStore.loadSpeakers();
    }
  }, [mode]);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('请选择参考音频文件');
      return;
    }

    try {
      await VoiceCloneStore.uploadReferenceAudio(selectedFile);
      alert('上传成功');
    } catch (error) {
      alert(`上传失败: ${error.message}`);
    }
  };

  const handleClone = async () => {
    if (!VoiceCloneStore.referenceAudio) {
      alert('请先上传参考音频');
      return;
    }

    if (!text.trim()) {
      alert('请输入要合成的文本');
      return;
    }

    try {
      await VoiceCloneStore.createCloneTask({
        text,
        prompt_text: promptText,
        reference_audio_id: VoiceCloneStore.referenceAudio.file_id,
        mode,
      });
      alert('克隆任务已创建');
    } catch (error) {
      alert(`创建任务失败: ${error.message}`);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        语音克隆
      </Typography>

      {VoiceCloneStore.error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => VoiceCloneStore.clearError()}>
          {VoiceCloneStore.error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          1. 上传参考音频
        </Typography>
        <Box sx={{ mb: 2 }}>
          <input
            accept="audio/*"
            style={{ display: 'none' }}
            id="audio-upload"
            type="file"
            onChange={handleFileSelect}
          />
          <label htmlFor="audio-upload">
            <Button
              variant="outlined"
              component="span"
              startIcon={<UploadIcon />}
              sx={{ mr: 2 }}
            >
              选择音频文件
            </Button>
          </label>
          {selectedFile && (
            <Typography variant="body2" color="text.secondary">
              已选择: {selectedFile.name}
            </Typography>
          )}
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!selectedFile || VoiceCloneStore.loading}
            sx={{ ml: 2 }}
          >
            上传
          </Button>
        </Box>
        {VoiceCloneStore.referenceAudio && (
          <Alert severity="success">
            参考音频已上传: {VoiceCloneStore.referenceAudio.filename}
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          2. 配置克隆参数
        </Typography>
        <TextField
          label="模式"
          select
          SelectProps={{ native: true }}
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        >
          <option value="zero_shot">Zero-shot</option>
          <option value="cross_lingual">Cross-lingual</option>
          <option value="vc">Voice Conversion</option>
          <option value="sft">SFT</option>
        </TextField>
        <TextField
          label="要合成的文本"
          multiline
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        />
        {mode === 'zero_shot' && (
          <TextField
            label="提示文本"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
        )}
        <Button
          variant="contained"
          onClick={handleClone}
          disabled={VoiceCloneStore.loading}
          fullWidth
        >
          {VoiceCloneStore.loading ? <CircularProgress size={24} /> : '开始克隆'}
        </Button>
      </Paper>

      {VoiceCloneStore.currentTask && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              任务状态
            </Typography>
            <Typography>任务ID: {VoiceCloneStore.currentTask.task_id}</Typography>
            <Typography>状态: {VoiceCloneStore.currentTask.status}</Typography>
            {VoiceCloneStore.currentTask.output_audio_url && (
              <Box sx={{ mt: 2 }}>
                <audio controls src={VoiceCloneStore.currentTask.output_audio_url} />
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
});

export default VoiceClonePage;

