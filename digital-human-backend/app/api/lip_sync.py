"""
唇形同步API
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
from datetime import datetime
import uuid
import logging
from app.config import settings
from app.models.lip_sync import LipSyncRequest, LipSyncResponse
from app.services.lip_sync_service import lip_sync_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/lip-sync", tags=["唇形同步"])

# 任务存储
tasks: dict = {}


class LipSyncTaskRequest(BaseModel):
    """唇形同步任务请求"""
    face_image_id: Optional[str] = None
    face_video_id: Optional[str] = None
    audio_id: str
    static: bool = False
    fps: float = 25.0


def process_lip_sync_task(task_id: str, task_data: dict):
    """后台处理唇形同步任务"""
    try:
        tasks[task_id]["status"] = "processing"
        tasks[task_id]["updated_at"] = datetime.now()
        
        # 确定人脸文件路径
        if task_data["face_image_id"]:
            face_path = settings.UPLOAD_DIR / task_data["face_image_id"]
            static = True
        elif task_data["face_video_id"]:
            face_path = settings.UPLOAD_VIDEO_DIR / task_data["face_video_id"]
            static = False
        else:
            raise ValueError("必须提供face_image_id或face_video_id")
        
        if not face_path.exists():
            raise FileNotFoundError(f"人脸文件不存在: {face_path}")
        
        # 获取音频路径
        audio_path = settings.UPLOAD_AUDIO_DIR / task_data["audio_id"]
        if not audio_path.exists():
            raise FileNotFoundError(f"音频文件不存在: {audio_path}")
        
        # 生成输出文件名
        output_filename = f"lipsync_{task_id}.mp4"
        output_path = settings.OUTPUT_LIP_SYNC_DIR / output_filename
        
        # 执行唇形同步
        lip_sync_service.process_lip_sync(
            face_path=face_path,
            audio_path=audio_path,
            output_path=output_path,
            static=static,
            fps=task_data.get("fps", 25.0)
        )
        
        # 更新任务状态
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["output_video_path"] = str(output_path)
        tasks[task_id]["output_video_url"] = f"/outputs/lip_sync/{output_filename}"
        tasks[task_id]["updated_at"] = datetime.now()
        
        logger.info(f"唇形同步任务完成: {task_id}")
    except Exception as e:
        logger.error(f"唇形同步任务失败 {task_id}: {e}")
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error_message"] = str(e)
        tasks[task_id]["updated_at"] = datetime.now()


@router.post("/process", response_model=LipSyncResponse)
async def create_lip_sync_task(
    request: LipSyncTaskRequest,
    background_tasks: BackgroundTasks
):
    """
    创建唇形同步任务
    
    需要提供:
    - face_image_id 或 face_video_id（二选一）
    - audio_id（音频文件ID）
    """
    try:
        # 验证输入
        if not request.face_image_id and not request.face_video_id:
            raise HTTPException(status_code=400, detail="必须提供face_image_id或face_video_id")
        
        if request.face_image_id and request.face_video_id:
            raise HTTPException(status_code=400, detail="不能同时提供face_image_id和face_video_id")
        
        # 验证文件是否存在
        if request.face_image_id:
            face_path = settings.UPLOAD_DIR / request.face_image_id
            if not face_path.exists():
                raise HTTPException(status_code=404, detail="人脸图片文件不存在")
        
        if request.face_video_id:
            face_path = settings.UPLOAD_VIDEO_DIR / request.face_video_id
            if not face_path.exists():
                raise HTTPException(status_code=404, detail="人脸视频文件不存在")
        
        audio_path = settings.UPLOAD_AUDIO_DIR / request.audio_id
        if not audio_path.exists():
            raise HTTPException(status_code=404, detail="音频文件不存在")
        
        # 创建任务
        task_id = uuid.uuid4().hex[:16]
        task_data = {
            "task_id": task_id,
            "face_image_id": request.face_image_id,
            "face_video_id": request.face_video_id,
            "audio_id": request.audio_id,
            "static": request.static,
            "fps": request.fps,
            "status": "pending",
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }
        
        tasks[task_id] = task_data
        
        # 后台处理任务
        background_tasks.add_task(process_lip_sync_task, task_id, task_data)
        
        return LipSyncResponse(
            task_id=task_id,
            status="pending",
            created_at=task_data["created_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建唇形同步任务失败: {e}")
        raise HTTPException(status_code=500, detail=f"创建任务失败: {str(e)}")


@router.get("/task/{task_id}", response_model=LipSyncResponse)
async def get_lip_sync_task(task_id: str):
    """获取唇形同步任务状态"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = tasks[task_id]
    return LipSyncResponse(
        task_id=task["task_id"],
        status=task["status"],
        output_video_url=task.get("output_video_url"),
        message=task.get("error_message"),
        created_at=task["created_at"]
    )


@router.get("/tasks")
async def list_lip_sync_tasks(limit: int = 20, offset: int = 0):
    """获取唇形同步任务列表"""
    task_list = list(tasks.values())
    task_list.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "success": True,
        "total": len(task_list),
        "tasks": task_list[offset:offset+limit]
    }

