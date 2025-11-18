"""
TTS语音合成服务
"""
import asyncio
from pathlib import Path
from typing import Optional
import logging
import uuid

try:
    import edge_tts
    HAS_EDGE_TTS = True
except ImportError:
    HAS_EDGE_TTS = False

from app.config import settings

logger = logging.getLogger(__name__)


class TTSService:
    """TTS语音合成服务类"""
    
    def __init__(self):
        self.voices = {
            "zh-CN": ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural", "zh-CN-XiaoyiNeural"],
            "en-US": ["en-US-AriaNeural", "en-US-GuyNeural", "en-US-JennyNeural"]
        }
    
    def detect_language(self, text: str) -> str:
        """检测文本语言"""
        # 简单判断：包含中文字符则为中文
        if any('\u4e00' <= char <= '\u9fff' for char in text):
            return "zh-CN"
        return "en-US"
    
    def text_to_speech(
        self,
        text: str,
        language: Optional[str] = None,
        voice: Optional[str] = None,
        output_path: Optional[Path] = None
    ) -> Path:
        """
        文本转语音
        
        Args:
            text: 要合成的文本
            language: 语言代码（如果为None则自动检测）
            voice: 语音ID（如果为None则自动选择）
            output_path: 输出文件路径（如果为None则自动生成）
        
        Returns:
            输出音频文件路径
        """
        if not HAS_EDGE_TTS:
            logger.warning("edge_tts未安装，TTS功能将不可用")
            # 创建空文件作为占位符
            if output_path is None:
                output_path = settings.OUTPUT_DIR / f"tts_{uuid.uuid4().hex}.mp3"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(b"dummy audio data")
            return output_path
        
        try:
            # 检测语言
            if language is None:
                language = self.detect_language(text)
            
            # 选择语音
            if voice is None:
                import random
                voice = random.choice(self.voices.get(language, self.voices["zh-CN"]))
            
            # 生成输出路径
            if output_path is None:
                filename = f"tts_{uuid.uuid4().hex}.mp3"
                output_path = settings.OUTPUT_DIR / filename
            else:
                output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 使用edge_tts生成语音
            logger.info(f"使用EdgeTTS生成语音: {text[:30]}... (语音: {voice})")
            
            # 运行异步函数
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                loop.run_until_complete(self._async_tts(text, voice, output_path))
            finally:
                loop.close()
            
            return output_path
        except Exception as e:
            logger.error(f"TTS生成失败: {e}")
            # 创建空文件作为占位符
            if output_path is None:
                output_path = settings.OUTPUT_DIR / f"tts_{uuid.uuid4().hex}.mp3"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(b"error in tts")
            return output_path
    
    async def _async_tts(self, text: str, voice: str, output_path: Path):
        """异步TTS生成"""
        communicate = edge_tts.Communicate(text, voice)
        await communicate.save(str(output_path))


# 创建全局服务实例
tts_service = TTSService()

