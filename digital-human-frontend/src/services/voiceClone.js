/**
 * 语音克隆服务
 */
import api from './api';

export const voiceCloneService = {
  /**
   * 创建语音克隆任务
   */
  createCloneTask: async (data) => {
    const response = await api.post('/api/voice-clone/clone', data);
    return response;
  },

  /**
   * 获取克隆任务状态
   */
  getTaskStatus: async (taskId) => {
    const response = await api.get(`/api/voice-clone/task/${taskId}`);
    return response;
  },

  /**
   * 获取可用说话人列表
   */
  getSpeakers: async () => {
    const response = await api.get('/api/voice-clone/speakers');
    return response;
  },

  /**
   * 获取任务列表
   */
  getTasks: async (limit = 20, offset = 0) => {
    const response = await api.get('/api/voice-clone/tasks', {
      params: { limit, offset },
    });
    return response;
  },
};

