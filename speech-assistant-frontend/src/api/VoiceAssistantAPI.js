import axios from 'axios';

/**
 * 语音助手API接口
 * 用于连接前端VoiceAssistant.js与后端15.1_SenceVoice_kws_CAM++.py
 */
class VoiceAssistantAPI {
  constructor(baseURL = 'http://localhost:5001') {
    this.baseURL = baseURL;
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30秒超时
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  /**
   * 设置API基础URL
   * @param {string} url - 新的基础URL
   */
  setBaseURL(url) {
    this.baseURL = url;
    this.axios.defaults.baseURL = url;
  }

  /**
   * 处理音频
   * @param {Blob} audioBlob - 音频数据
   * @param {Object} options - 配置选项
   * @returns {Promise} - 处理结果
   */
  async processAudio(audioBlob, options = {}) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      
      // 添加配置选项
      if (options.kwsEnabled !== undefined) {
        formData.append('kws_enabled', options.kwsEnabled ? '1' : '0');
      }
      
      if (options.svEnabled !== undefined) {
        formData.append('sv_enabled', options.svEnabled ? '1' : '0');
      }
      
      if (options.kwsText) {
        formData.append('kws_text', options.kwsText);
      }

      const response = await this.axios.post('/process_audio', formData);
      return response.data;
    } catch (error) {
      console.error('处理音频失败:', error);
      throw error;
    }
  }

  /**
   * 注册声纹
   * @param {Blob} audioBlob - 声纹音频数据
   * @returns {Promise} - 注册结果
   */
  async enrollSpeaker(audioBlob) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'enroll.wav');
      formData.append('enroll', '1');

      const response = await this.axios.post('/enroll_speaker', formData);
      return response.data;
    } catch (error) {
      console.error('声纹注册失败:', error);
      throw error;
    }
  }

  /**
   * 更新唤醒词
   * @param {string} keyword - 新的唤醒词
   * @returns {Promise} - 更新结果
   */
  async updateKeyword(keyword) {
    try {
      const formData = new FormData();
      formData.append('keyword', keyword);

      const response = await this.axios.post('/update_keyword', formData);
      return response.data;
    } catch (error) {
      console.error('更新唤醒词失败:', error);
      throw error;
    }
  }

  /**
   * 检查声纹注册状态
   * @returns {Promise<boolean>} - 是否已注册
   */
  async checkEnrollmentStatus() {
    try {
      const response = await this.axios.get('/check_enrollment');
      return response.data.enrolled || false;
    } catch (error) {
      console.error('检查声纹注册状态失败:', error);
      return false;
    }
  }

  /**
   * 获取系统状态
   * @returns {Promise} - 系统状态
   */
  async getSystemStatus() {
    try {
      const response = await this.axios.get('/system_status');
      return response.data;
    } catch (error) {
      console.error('获取系统状态失败:', error);
      throw error;
    }
  }
}

// 创建并导出API实例
const voiceAssistantAPI = new VoiceAssistantAPI();
export default voiceAssistantAPI; 