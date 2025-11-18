/**
 * 训练管理Store
 */
import { makeAutoObservable } from 'mobx';
import { trainingService } from '../services/training';

class TrainingStore {
  constructor() {
    this.tasks = [];
    this.currentTask = null;
    this.loading = false;
    this.error = null;
    
    makeAutoObservable(this);
  }

  // 创建训练任务
  async createTask(data) {
    this.loading = true;
    this.error = null;
    
    try {
      const response = await trainingService.createTask(data);
      this.currentTask = response;
      // 刷新任务列表
      await this.loadTasks();
      return response;
    } catch (error) {
      this.error = error.message;
      throw error;
    } finally {
      this.loading = false;
    }
  }

  // 获取任务状态
  async getTaskStatus(taskId) {
    try {
      const response = await trainingService.getTaskStatus(taskId);
      // 更新任务列表中的对应任务
      const taskIndex = this.tasks.findIndex(t => t.task_id === taskId);
      if (taskIndex !== -1) {
        this.tasks[taskIndex] = response;
      }
      if (this.currentTask && this.currentTask.task_id === taskId) {
        this.currentTask = response;
      }
      return response;
    } catch (error) {
      this.error = error.message;
      throw error;
    }
  }

  // 获取任务详情
  async getTaskDetails(taskId) {
    try {
      const response = await trainingService.getTaskDetails(taskId);
      return response.task;
    } catch (error) {
      this.error = error.message;
      throw error;
    }
  }

  // 加载任务列表
  async loadTasks(limit = 20, offset = 0, status = null) {
    this.loading = true;
    
    try {
      const response = await trainingService.getTasks(limit, offset, status);
      this.tasks = response.tasks || [];
      return this.tasks;
    } catch (error) {
      this.error = error.message;
      throw error;
    } finally {
      this.loading = false;
    }
  }

  // 取消训练任务
  async cancelTask(taskId) {
    try {
      const response = await trainingService.cancelTask(taskId);
      // 刷新任务列表
      await this.loadTasks();
      return response;
    } catch (error) {
      this.error = error.message;
      throw error;
    }
  }

  // 删除训练任务
  async deleteTask(taskId) {
    try {
      const response = await trainingService.deleteTask(taskId);
      // 从列表中移除
      this.tasks = this.tasks.filter(t => t.task_id !== taskId);
      if (this.currentTask && this.currentTask.task_id === taskId) {
        this.currentTask = null;
      }
      return response;
    } catch (error) {
      this.error = error.message;
      throw error;
    }
  }

  // 设置当前任务
  setCurrentTask(task) {
    this.currentTask = task;
  }

  // 清除错误
  clearError() {
    this.error = null;
  }
}

export default new TrainingStore();

