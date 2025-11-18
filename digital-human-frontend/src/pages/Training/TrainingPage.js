import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import TrainingStore from '../../stores/TrainingStore';

const TrainingPage = observer(() => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    training_type: 'voice_clone',
    config: {},
  });

  useEffect(() => {
    TrainingStore.loadTasks();
  }, []);

  const handleCreateTask = async () => {
    try {
      await TrainingStore.createTask(formData);
      setCreateDialogOpen(false);
      setFormData({
        name: '',
        description: '',
        training_type: 'voice_clone',
        config: {},
      });
    } catch (error) {
      alert(`创建任务失败: ${error.message}`);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" component="h1">
          训练管理
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          创建训练任务
        </Button>
      </Box>

      {TrainingStore.error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => TrainingStore.clearError()}>
          {TrainingStore.error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>任务名称</TableCell>
              <TableCell>类型</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>进度</TableCell>
              <TableCell>创建时间</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {TrainingStore.tasks.map((task) => (
              <TableRow key={task.task_id}>
                <TableCell>{task.name}</TableCell>
                <TableCell>{task.training_type}</TableCell>
                <TableCell>{task.status}</TableCell>
                <TableCell>
                  <Box sx={{ width: '100%' }}>
                    <LinearProgress variant="determinate" value={task.progress || 0} />
                    <Typography variant="caption">{task.progress || 0}%</Typography>
                  </Box>
                </TableCell>
                <TableCell>
                  {new Date(task.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    onClick={() => TrainingStore.setCurrentTask(task)}
                  >
                    查看
                  </Button>
                  {task.status === 'training' && (
                    <Button
                      size="small"
                      color="error"
                      onClick={() => TrainingStore.cancelTask(task.task_id)}
                    >
                      取消
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>创建训练任务</DialogTitle>
        <DialogContent>
          <TextField
            label="任务名称"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            sx={{ mb: 2 }}
          />
          <TextField
            label="描述"
            fullWidth
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            sx={{ mb: 2 }}
          />
          <Select
            label="训练类型"
            fullWidth
            value={formData.training_type}
            onChange={(e) => setFormData({ ...formData, training_type: e.target.value })}
            sx={{ mb: 2 }}
          >
            <MenuItem value="voice_clone">语音克隆 (CosyVoice SFT)</MenuItem>
            <MenuItem value="lip_sync">唇形同步 (Wav2Lip微调)</MenuItem>
          </Select>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleCreateTask}>
            创建
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
});

export default TrainingPage;

