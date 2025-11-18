/**
 * 文件上传服务
 */
import api from './api';

export const uploadService = {
  /**
   * 上传音频文件
   */
  uploadAudio: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/api/upload/audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response;
  },

  /**
   * 上传视频文件
   */
  uploadVideo: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/api/upload/video', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response;
  },

  /**
   * 上传图片文件
   */
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/api/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response;
  },

  /**
   * 批量上传文件
   */
  uploadBatch: async (files) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    
    const response = await api.post('/api/upload/batch', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response;
  },

  /**
   * 获取文件信息
   */
  getFileInfo: async (fileId) => {
    const response = await api.get(`/api/upload/file/${fileId}`);
    return response;
  },

  /**
   * 删除文件
   */
  deleteFile: async (fileId) => {
    const response = await api.delete(`/api/upload/file/${fileId}`);
    return response;
  },
};

