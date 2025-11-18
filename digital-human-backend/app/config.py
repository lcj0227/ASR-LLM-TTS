"""
配置文件
"""
import os
from pathlib import Path
from typing import Optional

class Settings:
    """应用配置"""
    
    # 基础配置
    APP_NAME: str = "数字人Web端后端"
    VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # 服务器配置
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # 文件存储路径
    BASE_DIR: Path = Path(__file__).parent.parent
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    OUTPUT_DIR: Path = BASE_DIR / "outputs"
    TEMP_DIR: Path = BASE_DIR / "temp"
    
    # 上传文件目录
    UPLOAD_AUDIO_DIR: Path = UPLOAD_DIR / "audio"
    UPLOAD_VIDEO_DIR: Path = UPLOAD_DIR / "video"
    UPLOAD_MODEL_DIR: Path = UPLOAD_DIR / "models"
    
    # 输出文件目录
    OUTPUT_VOICE_CLONE_DIR: Path = OUTPUT_DIR / "voice_clone"
    OUTPUT_LIP_SYNC_DIR: Path = OUTPUT_DIR / "lip_sync"
    OUTPUT_TRAINING_DIR: Path = OUTPUT_DIR / "training"
    
    # 文件大小限制 (MB)
    MAX_AUDIO_SIZE: int = 100  # 100MB
    MAX_VIDEO_SIZE: int = 500  # 500MB
    MAX_FILE_SIZE: int = 1000  # 1000MB
    
    # 允许的文件类型
    ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac", ".ogg"}
    ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
    ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp"}
    
    # 模型路径配置
    COSYVOICE_MODEL_PATH: Optional[str] = os.getenv("COSYVOICE_MODEL_PATH", None)
    WAV2LIP_CHECKPOINT_PATH: Optional[str] = os.getenv("WAV2LIP_CHECKPOINT_PATH", None)
    LLM_MODEL_PATH: Optional[str] = os.getenv("LLM_MODEL_PATH", "./QWen/Qwen2.5-0.5B-Instruct")
    ASR_MODEL_PATH: Optional[str] = os.getenv("ASR_MODEL_PATH", "./QWen/pretrained_models/SenseVoiceSmall")
    
    # WebSocket配置
    WS_MAX_CONNECTIONS: int = 100
    
    # CORS配置
    CORS_ORIGINS: list = ["*"]  # 生产环境应该设置具体域名
    
    @classmethod
    def init_directories(cls):
        """初始化必要的目录"""
        directories = [
            cls.UPLOAD_DIR,
            cls.OUTPUT_DIR,
            cls.TEMP_DIR,
            cls.UPLOAD_AUDIO_DIR,
            cls.UPLOAD_VIDEO_DIR,
            cls.UPLOAD_MODEL_DIR,
            cls.OUTPUT_VOICE_CLONE_DIR,
            cls.OUTPUT_LIP_SYNC_DIR,
            cls.OUTPUT_TRAINING_DIR,
        ]
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)

# 创建全局配置实例
settings = Settings()
settings.init_directories()

