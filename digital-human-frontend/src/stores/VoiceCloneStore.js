/**
 * 语音克隆Store
 */
import { makeAutoObservable } from 'mobx';
import { voiceCloneService } from '../services/voiceClone';
import { uploadService } from '../services/upload';

class VoiceCloneStore {
  constructor() {
    this.referenceAudio = null;
    this.currentTask = null;
    this.tasks = [];
    this.speakers = [];
    this.loading = false;
    this.error = null;
    
    makeAutoObservable(this);
  }

  // 上传参考音频
  async uploadReferenceAudio(file) {
    this.loading = true;
    this.error = null;
    
    try {
      const response = await uploadService.uploadAudio(file);
      this.referenceAudio = response;
      return response;
    } catch (error) {
      this.error = error.message;
      throw error;
    } finally {
      this.loading = false;
    }
  }

  // 创建克隆任务
  async createCloneTask(data) {
    this.loading = true;
    this.error = null;
    
    try {
      const response = await voiceCloneService.createCloneTask(data);
      this.currentTask = response;
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
      const response = await voiceCloneService.getTaskStatus(taskId);
      if (this.currentTask && this.currentTask.task_id === taskId) {
        this.currentTask = response;
      }
      return response;
    } catch (error) {
      this.error = error.message;
      throw error;
    }
  }

  // 获取说话人列表
  async loadSpeakers() {
    this.loading = true;
    
    try {
      const response = await voiceCloneService.getSpeakers();
      this.speakers = response.speakers || [];
      return this.speakers;
    } catch (error) {
      this.error = error.message;
      throw error;
    } finally {
      this.loading = false;
    }
  }

  // 获取任务列表
  async loadTasks(limit = 20, offset = 0) {
    this.loading = true;
    
    try {
      const response = await voiceCloneService.getTasks(limit, offset);
      this.tasks = response.tasks || [];
      return this.tasks;
    } catch (error) {
      this.error = error.message;
      throw error;
    } finally {
      this.loading = false;
    }
  }

  // 清除错误
  clearError() {
    this.error = null;
  }

  // 重置状态
  reset() {
    this.referenceAudio = null;
    this.currentTask = null;
    this.error = null;
  }
}

export default new VoiceCloneStore();

