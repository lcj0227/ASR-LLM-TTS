"""
LLM大语言模型服务
"""
import sys
from pathlib import Path
from typing import Optional, List, Dict
import logging
import torch

try:
    from transformers import AutoModelForCausalLM, AutoTokenizer
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False

from app.config import settings

logger = logging.getLogger(__name__)


class LLMService:
    """LLM大语言模型服务类"""
    
    def __init__(self):
        self.model: Optional[AutoModelForCausalLM] = None
        self.tokenizer: Optional[AutoTokenizer] = None
        self.model_loaded = False
    
    def load_model(self, model_path: Optional[str] = None):
        """加载LLM模型"""
        if self.model_loaded:
            return
        
        if not HAS_TRANSFORMERS:
            logger.warning("transformers未安装，LLM功能将不可用")
            return
        
        try:
            model_path = model_path or settings.LLM_MODEL_PATH
            if not model_path:
                logger.warning("LLM模型路径未配置")
                return
            
            logger.info(f"加载LLM模型: {model_path}")
            self.model = AutoModelForCausalLM.from_pretrained(
                model_path,
                torch_dtype="auto",
                device_map="auto"
            )
            self.tokenizer = AutoTokenizer.from_pretrained(model_path)
            self.model_loaded = True
            logger.info("LLM模型加载成功")
        except Exception as e:
            logger.error(f"加载LLM模型失败: {e}")
            # 不抛出异常，允许在没有LLM的情况下运行
    
    def generate(
        self,
        prompt: str,
        system_prompt: str = "你是一个有用的助手。",
        max_tokens: int = 512,
        temperature: float = 0.7
    ) -> str:
        """
        生成回复
        
        Args:
            prompt: 用户输入
            system_prompt: 系统提示词
            max_tokens: 最大生成token数
            temperature: 温度参数
        
        Returns:
            生成的文本
        """
        if not self.model_loaded:
            self.load_model()
        
        if not self.model or not self.tokenizer:
            # 返回模拟回复
            return "抱歉，语言模型服务暂时不可用。"
        
        try:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ]
            
            text = self.tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
            )
            
            model_inputs = self.tokenizer([text], return_tensors="pt").to(self.model.device)
            
            generated_ids = self.model.generate(
                **model_inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                do_sample=True,
            )
            
            generated_ids = [
                output_ids[len(input_ids):] 
                for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
            ]
            
            response = self.tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
            
            logger.info(f"LLM生成回复: {response[:100]}...")
            return response
        except Exception as e:
            logger.error(f"LLM生成失败: {e}")
            return "抱歉，生成回复时出现错误。"


# 创建全局服务实例
llm_service = LLMService()

