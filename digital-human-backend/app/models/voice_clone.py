"""
语音克隆数据模型
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class VoiceCloneRequest(BaseModel):
    """语音克隆请求"""
    text: str
    prompt_text: Optional[str] = None
    reference_audio_id: str
    mode: str = "zero_shot"  # zero_shot, cross_lingual, vc


class VoiceCloneResponse(BaseModel):
    """语音克隆响应"""
    task_id: str
    status: str  # pending, processing, completed, failed
    output_audio_url: Optional[str] = None
    message: Optional[str] = None
    created_at: datetime


class VoiceCloneTask(BaseModel):
    """语音克隆任务"""
    task_id: str
    user_id: Optional[str] = None
    text: str
    prompt_text: Optional[str] = None
    reference_audio_path: str
    output_audio_path: Optional[str] = None
    status: str
    mode: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

