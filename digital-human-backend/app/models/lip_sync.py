"""
唇形同步数据模型
"""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class LipSyncRequest(BaseModel):
    """唇形同步请求"""
    face_image_id: Optional[str] = None
    face_video_id: Optional[str] = None
    audio_id: str
    static: bool = False  # 是否使用静态图片


class LipSyncResponse(BaseModel):
    """唇形同步响应"""
    task_id: str
    status: str  # pending, processing, completed, failed
    output_video_url: Optional[str] = None
    message: Optional[str] = None
    created_at: datetime


class LipSyncTask(BaseModel):
    """唇形同步任务"""
    task_id: str
    user_id: Optional[str] = None
    face_image_path: Optional[str] = None
    face_video_path: Optional[str] = None
    audio_path: str
    output_video_path: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

