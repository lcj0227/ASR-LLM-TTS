/**
 * 唇形同步服务
 */
import api from './api';

export const lipSyncService = {
  /**
   * 创建唇形同步任务
   */
  createTask: async (data) => {
    const response = await api.post('/api/lip-sync/process', data);
    return response;
  },

  /**
   * 获取任务状态
   */
  getTaskStatus: async (taskId) => {
    const response = await api.get(`/api/lip-sync/task/${taskId}`);
    return response;
  },

  /**
   * 获取任务列表
   */
  getTasks: async (limit = 20, offset = 0) => {
    const response = await api.get('/api/lip-sync/tasks', {
      params: { limit, offset },
    });
    return response;
  },
};

