"""
语音克隆服务
"""
import os
import sys
import torch
import torchaudio
from pathlib import Path
from typing import Optional, Dict, Any
import logging
from datetime import datetime
import uuid

# 添加cosyvoice到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from app.config import settings

logger = logging.getLogger(__name__)

# 尝试导入CosyVoice，如果失败则设置为None
try:
    from cosyvoice.cli.cosyvoice import CosyVoice
    from cosyvoice.utils.file_utils import load_wav
    HAS_COSYVOICE = True
except ImportError as e:
    logger.warning(f"CosyVoice导入失败: {e}。语音克隆功能将不可用。")
    CosyVoice = None
    load_wav = None
    HAS_COSYVOICE = False


class VoiceCloneService:
    """语音克隆服务类"""
    
    def __init__(self):
        self.cosyvoice: Optional[CosyVoice] = None
        self.model_loaded = False
    
    def load_model(self, model_path: Optional[str] = None):
        """加载CosyVoice模型"""
        if not HAS_COSYVOICE:
            logger.error("CosyVoice未安装，无法加载模型")
            raise RuntimeError("CosyVoice未安装，请安装相关依赖")
        
        if self.model_loaded:
            return
        
        try:
            model_path = model_path or settings.COSYVOICE_MODEL_PATH
            if not model_path:
                # 使用默认模型路径
                model_path = "pretrained_models/CosyVoice-300M"
            
            logger.info(f"加载CosyVoice模型: {model_path}")
            self.cosyvoice = CosyVoice(
                model_path,
                load_jit=True,
                load_onnx=False,
                fp16=True
            )
            self.model_loaded = True
            logger.info("CosyVoice模型加载成功")
        except Exception as e:
            logger.error(f"加载CosyVoice模型失败: {e}")
            raise
    
    def zero_shot_clone(
        self,
        text: str,
        prompt_text: str,
        reference_audio_path: Path,
        output_path: Path,
        stream: bool = False
    ) -> Path:
        """
        Zero-shot语音克隆
        
        Args:
            text: 要合成的文本
            prompt_text: 提示文本
            reference_audio_path: 参考音频路径
            output_path: 输出音频路径
        
        Returns:
            输出音频路径
        """
        if not self.model_loaded:
            self.load_model()
        
        try:
            # 加载参考音频（16kHz）
            prompt_speech_16k = load_wav(str(reference_audio_path), 16000)
            
            # 执行推理
            logger.info(f"开始zero-shot语音克隆: {text[:50]}...")
            output_generator = self.cosyvoice.inference_zero_shot(
                text,
                prompt_text,
                prompt_speech_16k,
                stream=stream
            )
            
            # 保存输出
            for i, output in enumerate(output_generator):
                output_file = output_path if i == 0 else output_path.parent / f"{output_path.stem}_{i}{output_path.suffix}"
                torchaudio.save(
                    str(output_file),
                    output['tts_speech'],
                    22050  # CosyVoice输出采样率
                )
                logger.info(f"保存语音克隆结果: {output_file}")
            
            return output_path
        except Exception as e:
            logger.error(f"Zero-shot语音克隆失败: {e}")
            raise
    
    def cross_lingual_clone(
        self,
        text: str,
        reference_audio_path: Path,
        output_path: Path,
        stream: bool = False
    ) -> Path:
        """
        跨语言语音克隆
        
        Args:
            text: 要合成的文本（支持多语言标记，如<|zh|>, <|en|>等）
            reference_audio_path: 参考音频路径
            output_path: 输出音频路径
        
        Returns:
            输出音频路径
        """
        if not self.model_loaded:
            self.load_model()
        
        try:
            # 加载参考音频（16kHz）
            prompt_speech_16k = load_wav(str(reference_audio_path), 16000)
            
            # 执行推理
            logger.info(f"开始跨语言语音克隆: {text[:50]}...")
            output_generator = self.cosyvoice.inference_cross_lingual(
                text,
                prompt_speech_16k,
                stream=stream
            )
            
            # 保存输出
            for i, output in enumerate(output_generator):
                output_file = output_path if i == 0 else output_path.parent / f"{output_path.stem}_{i}{output_path.suffix}"
                torchaudio.save(
                    str(output_file),
                    output['tts_speech'],
                    22050
                )
                logger.info(f"保存语音克隆结果: {output_file}")
            
            return output_path
        except Exception as e:
            logger.error(f"跨语言语音克隆失败: {e}")
            raise
    
    def voice_conversion(
        self,
        source_audio_path: Path,
        reference_audio_path: Path,
        output_path: Path,
        stream: bool = False
    ) -> Path:
        """
        语音转换（Voice Conversion）
        
        Args:
            source_audio_path: 源音频路径
            reference_audio_path: 参考音频路径
            output_path: 输出音频路径
        
        Returns:
            输出音频路径
        """
        if not self.model_loaded:
            self.load_model()
        
        try:
            # 加载音频（16kHz）
            prompt_speech_16k = load_wav(str(reference_audio_path), 16000)
            source_speech_16k = load_wav(str(source_audio_path), 16000)
            
            # 执行推理
            logger.info("开始语音转换")
            output_generator = self.cosyvoice.inference_vc(
                source_speech_16k,
                prompt_speech_16k,
                stream=stream
            )
            
            # 保存输出
            for i, output in enumerate(output_generator):
                output_file = output_path if i == 0 else output_path.parent / f"{output_path.stem}_{i}{output_path.suffix}"
                torchaudio.save(
                    str(output_file),
                    output['tts_speech'],
                    22050
                )
                logger.info(f"保存语音转换结果: {output_file}")
            
            return output_path
        except Exception as e:
            logger.error(f"语音转换失败: {e}")
            raise
    
    def sft_inference(
        self,
        text: str,
        speaker_id: str,
        output_path: Path,
        stream: bool = False
    ) -> Path:
        """
        SFT模式推理（使用预训练说话人）
        
        Args:
            text: 要合成的文本
            speaker_id: 说话人ID（如'中文女'）
            output_path: 输出音频路径
        
        Returns:
            输出音频路径
        """
        if not self.model_loaded:
            self.load_model()
        
        try:
            # 获取可用说话人列表
            available_speakers = self.cosyvoice.list_avaliable_spks()
            if speaker_id not in available_speakers:
                raise ValueError(f"说话人ID '{speaker_id}' 不存在。可用说话人: {available_speakers}")
            
            # 执行推理
            logger.info(f"开始SFT推理: {text[:50]}... (说话人: {speaker_id})")
            output_generator = self.cosyvoice.inference_sft(
                text,
                speaker_id,
                stream=stream
            )
            
            # 保存输出
            for i, output in enumerate(output_generator):
                output_file = output_path if i == 0 else output_path.parent / f"{output_path.stem}_{i}{output_path.suffix}"
                torchaudio.save(
                    str(output_file),
                    output['tts_speech'],
                    22050
                )
                logger.info(f"保存SFT推理结果: {output_file}")
            
            return output_path
        except Exception as e:
            logger.error(f"SFT推理失败: {e}")
            raise
    
    def get_available_speakers(self) -> list:
        """获取可用说话人列表"""
        if not self.model_loaded:
            self.load_model()
        
        try:
            return self.cosyvoice.list_avaliable_spks()
        except Exception as e:
            logger.error(f"获取说话人列表失败: {e}")
            return []


# 创建全局服务实例
voice_clone_service = VoiceCloneService()

