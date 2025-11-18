"""
训练任务数据模型
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum


class TrainingType(str, Enum):
    """训练类型"""
    VOICE_CLONE = "voice_clone"  # CosyVoice SFT训练
    LIP_SYNC = "lip_sync"  # Wav2Lip微调训练


class TrainingStatus(str, Enum):
    """训练状态"""
    PENDING = "pending"
    PREPARING = "preparing"
    TRAINING = "training"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TrainingRequest(BaseModel):
    """训练请求"""
    training_type: TrainingType
    name: str
    description: Optional[str] = None
    config: Dict[str, Any] = {}


class TrainingResponse(BaseModel):
    """训练响应"""
    task_id: str
    status: TrainingStatus
    progress: float = 0.0
    message: Optional[str] = None
    created_at: datetime


class TrainingTask(BaseModel):
    """训练任务"""
    task_id: str
    user_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    training_type: TrainingType
    status: TrainingStatus
    config: Dict[str, Any] = {}
    progress: float = 0.0
    output_model_path: Optional[str] = None
    logs: list = []
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

