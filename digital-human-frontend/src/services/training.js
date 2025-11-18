/**
 * 训练管理服务
 */
import api from './api';

export const trainingService = {
  /**
   * 创建训练任务
   */
  createTask: async (data) => {
    const response = await api.post('/api/training/create', data);
    return response;
  },

  /**
   * 获取任务状态
   */
  getTaskStatus: async (taskId) => {
    const response = await api.get(`/api/training/task/${taskId}`);
    return response;
  },

  /**
   * 获取任务详情
   */
  getTaskDetails: async (taskId) => {
    const response = await api.get(`/api/training/task/${taskId}/details`);
    return response;
  },

  /**
   * 获取任务列表
   */
  getTasks: async (limit = 20, offset = 0, status = null) => {
    const params = { limit, offset };
    if (status) {
      params.status = status;
    }
    const response = await api.get('/api/training/tasks', { params });
    return response;
  },

  /**
   * 取消训练任务
   */
  cancelTask: async (taskId) => {
    const response = await api.post(`/api/training/task/${taskId}/cancel`);
    return response;
  },

  /**
   * 删除训练任务
   */
  deleteTask: async (taskId) => {
    const response = await api.delete(`/api/training/task/${taskId}`);
    return response;
  },
};

