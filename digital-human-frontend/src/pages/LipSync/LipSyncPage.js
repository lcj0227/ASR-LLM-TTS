import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import { CloudUpload as UploadIcon } from '@mui/icons-material';
import LipSyncStore from '../../stores/LipSyncStore';

const LipSyncPage = observer(() => {
  const [faceFile, setFaceFile] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [useImage, setUseImage] = useState(true);

  const handleFaceFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setFaceFile(file);
    }
  };

  const handleAudioFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setAudioFile(file);
    }
  };

  const handleUploadFace = async () => {
    if (!faceFile) {
      alert('请选择人脸文件');
      return;
    }

    try {
      if (useImage) {
        await LipSyncStore.uploadFaceImage(faceFile);
      } else {
        await LipSyncStore.uploadFaceVideo(faceFile);
      }
      alert('上传成功');
    } catch (error) {
      alert(`上传失败: ${error.message}`);
    }
  };

  const handleUploadAudio = async () => {
    if (!audioFile) {
      alert('请选择音频文件');
      return;
    }

    try {
      await LipSyncStore.uploadAudio(audioFile);
      alert('上传成功');
    } catch (error) {
      alert(`上传失败: ${error.message}`);
    }
  };

  const handleProcess = async () => {
    if (!LipSyncStore.faceImage && !LipSyncStore.faceVideo) {
      alert('请先上传人脸图片或视频');
      return;
    }

    if (!LipSyncStore.audio) {
      alert('请先上传音频文件');
      return;
    }

    try {
      await LipSyncStore.createTask({
        face_image_id: LipSyncStore.faceImage?.file_id,
        face_video_id: LipSyncStore.faceVideo?.file_id,
        audio_id: LipSyncStore.audio.file_id,
        static: !!LipSyncStore.faceImage,
      });
      alert('处理任务已创建');
    } catch (error) {
      alert(`创建任务失败: ${error.message}`);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        唇形同步
      </Typography>

      {LipSyncStore.error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => LipSyncStore.clearError()}>
          {LipSyncStore.error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          1. 上传人脸文件
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Button
            variant={useImage ? 'contained' : 'outlined'}
            onClick={() => setUseImage(true)}
            sx={{ mr: 1 }}
          >
            图片
          </Button>
          <Button
            variant={!useImage ? 'contained' : 'outlined'}
            onClick={() => setUseImage(false)}
          >
            视频
          </Button>
        </Box>
        <Box sx={{ mb: 2 }}>
          <input
            accept={useImage ? 'image/*' : 'video/*'}
            style={{ display: 'none' }}
            id="face-upload"
            type="file"
            onChange={handleFaceFileSelect}
          />
          <label htmlFor="face-upload">
            <Button
              variant="outlined"
              component="span"
              startIcon={<UploadIcon />}
              sx={{ mr: 2 }}
            >
              选择{useImage ? '图片' : '视频'}文件
            </Button>
          </label>
          {faceFile && (
            <Typography variant="body2" color="text.secondary">
              已选择: {faceFile.name}
            </Typography>
          )}
          <Button
            variant="contained"
            onClick={handleUploadFace}
            disabled={!faceFile || LipSyncStore.loading}
            sx={{ ml: 2 }}
          >
            上传
          </Button>
        </Box>
        {(LipSyncStore.faceImage || LipSyncStore.faceVideo) && (
          <Alert severity="success">
            人脸文件已上传
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          2. 上传音频文件
        </Typography>
        <Box sx={{ mb: 2 }}>
          <input
            accept="audio/*"
            style={{ display: 'none' }}
            id="audio-upload"
            type="file"
            onChange={handleAudioFileSelect}
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
          {audioFile && (
            <Typography variant="body2" color="text.secondary">
              已选择: {audioFile.name}
            </Typography>
          )}
          <Button
            variant="contained"
            onClick={handleUploadAudio}
            disabled={!audioFile || LipSyncStore.loading}
            sx={{ ml: 2 }}
          >
            上传
          </Button>
        </Box>
        {LipSyncStore.audio && (
          <Alert severity="success">
            音频文件已上传: {LipSyncStore.audio.filename}
          </Alert>
        )}
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Button
          variant="contained"
          onClick={handleProcess}
          disabled={LipSyncStore.loading}
          fullWidth
          size="large"
        >
          {LipSyncStore.loading ? <CircularProgress size={24} /> : '开始处理'}
        </Button>
      </Paper>

      {LipSyncStore.currentTask && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              任务状态
            </Typography>
            <Typography>任务ID: {LipSyncStore.currentTask.task_id}</Typography>
            <Typography>状态: {LipSyncStore.currentTask.status}</Typography>
            {LipSyncStore.currentTask.output_video_url && (
              <Box sx={{ mt: 2 }}>
                <video controls width="100%" src={LipSyncStore.currentTask.output_video_url} />
              </Box>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
});

export default LipSyncPage;

