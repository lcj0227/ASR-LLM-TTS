"""
ASR语音识别服务
"""
import sys
from pathlib import Path
from typing import Optional, Tuple
import logging

try:
    from funasr import AutoModel
    HAS_FUNASR = True
except ImportError:
    HAS_FUNASR = False

from app.config import settings

logger = logging.getLogger(__name__)


class ASRService:
    """ASR语音识别服务类"""
    
    def __init__(self):
        self.model: Optional[AutoModel] = None
        self.model_loaded = False
    
    def load_model(self, model_path: Optional[str] = None):
        """加载ASR模型"""
        if self.model_loaded:
            return
        
        if not HAS_FUNASR:
            logger.warning("FunASR未安装，ASR功能将不可用")
            return
        
        try:
            model_path = model_path or settings.ASR_MODEL_PATH
            if not model_path:
                logger.warning("ASR模型路径未配置")
                return
            
            logger.info(f"加载ASR模型: {model_path}")
            self.model = AutoModel(
                model=model_path,
                trust_remote_code=True,
            )
            self.model_loaded = True
            logger.info("ASR模型加载成功")
        except Exception as e:
            logger.error(f"加载ASR模型失败: {e}")
            # 不抛出异常，允许在没有ASR的情况下运行
    
    def recognize(self, audio_path: Path, language: str = "auto") -> Tuple[str, float]:
        """
        语音识别
        
        Args:
            audio_path: 音频文件路径
            language: 语言代码 (auto, zh, en, yue, ja, ko)
        
        Returns:
            (识别文本, 置信度) 元组
        """
        if not self.model_loaded:
            self.load_model()
        
        if not self.model:
            # 返回模拟结果
            return "语音识别服务不可用", 0.0
        
        try:
            res = self.model.generate(
                input=str(audio_path),
                cache={},
                language=language,
                use_itn=False,
            )
            
            # 提取识别文本
            text = res[0]['text'].split(">")[-1] if ">" in res[0]['text'] else res[0]['text']
            confidence = res[0].get('score', 0.9)
            
            logger.info(f"ASR识别结果: {text} (置信度: {confidence})")
            return text, confidence
        except Exception as e:
            logger.error(f"ASR识别失败: {e}")
            return "语音识别失败", 0.0


# 创建全局服务实例
asr_service = ASRService()

