/**
 * 唇形同步Store
 */
import { makeAutoObservable } from 'mobx';
import { lipSyncService } from '../services/lipSync';
import { uploadService } from '../services/upload';

class LipSyncStore {
  constructor() {
    this.faceImage = null;
    this.faceVideo = null;
    this.audio = null;
    this.currentTask = null;
    this.tasks = [];
    this.loading = false;
    this.error = null;
    
    makeAutoObservable(this);
  }

  // 上传人脸图片
  async uploadFaceImage(file) {
    this.loading = true;
    this.error = null;
    
    try {
      const response = await uploadService.uploadImage(file);
      this.faceImage = response;
      return response;
    } catch (error) {
      this.error = error.message;
      throw error;
    } finally {
      this.loading = false;
    }
  }

  // 上传人脸视频
  async uploadFaceVideo(file) {
    this.loading = true;
    this.error = null;
    
    try {
      const response = await uploadService.uploadVideo(file);
      this.faceVideo = response;
      return response;
    } catch (error) {
      this.error = error.message;
      throw error;
    } finally {
      this.loading = false;
    }
  }

  // 上传音频
  async uploadAudio(file) {
    this.loading = true;
    this.error = null;
    
    try {
      const response = await uploadService.uploadAudio(file);
      this.audio = response;
      return response;
    } catch (error) {
      this.error = error.message;
      throw error;
    } finally {
      this.loading = false;
    }
  }

  // 创建唇形同步任务
  async createTask(data) {
    this.loading = true;
    this.error = null;
    
    try {
      const response = await lipSyncService.createTask(data);
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
      const response = await lipSyncService.getTaskStatus(taskId);
      if (this.currentTask && this.currentTask.task_id === taskId) {
        this.currentTask = response;
      }
      return response;
    } catch (error) {
      this.error = error.message;
      throw error;
    }
  }

  // 获取任务列表
  async loadTasks(limit = 20, offset = 0) {
    this.loading = true;
    
    try {
      const response = await lipSyncService.getTasks(limit, offset);
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
    this.faceImage = null;
    this.faceVideo = null;
    this.audio = null;
    this.currentTask = null;
    this.error = null;
  }
}

export default new LipSyncStore();

