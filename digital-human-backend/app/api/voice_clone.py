"""
语音克隆API
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
from datetime import datetime
import uuid
import logging
from app.config import settings
from app.models.voice_clone import VoiceCloneRequest, VoiceCloneResponse
from app.services.voice_clone_service import voice_clone_service
from app.utils.file_utils import get_file_info

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice-clone", tags=["语音克隆"])

# 任务存储（实际应用中应使用数据库）
tasks: dict = {}


class CloneTaskRequest(BaseModel):
    """克隆任务请求"""
    text: str
    prompt_text: Optional[str] = None
    reference_audio_id: str
    mode: str = "zero_shot"  # zero_shot, cross_lingual, vc, sft
    speaker_id: Optional[str] = None  # SFT模式需要


def process_voice_clone_task(task_id: str, task_data: dict):
    """后台处理语音克隆任务"""
    try:
        tasks[task_id]["status"] = "processing"
        tasks[task_id]["updated_at"] = datetime.now()
        
        # 获取参考音频路径
        reference_audio_path = settings.UPLOAD_AUDIO_DIR / task_data["reference_audio_id"]
        if not reference_audio_path.exists():
            raise FileNotFoundError(f"参考音频不存在: {reference_audio_path}")
        
        # 生成输出文件名
        output_filename = f"clone_{task_id}.wav"
        output_path = settings.OUTPUT_VOICE_CLONE_DIR / output_filename
        
        # 根据模式执行克隆
        mode = task_data["mode"]
        text = task_data["text"]
        
        if mode == "zero_shot":
            prompt_text = task_data.get("prompt_text", "")
            voice_clone_service.zero_shot_clone(
                text=text,
                prompt_text=prompt_text,
                reference_audio_path=reference_audio_path,
                output_path=output_path
            )
        elif mode == "cross_lingual":
            voice_clone_service.cross_lingual_clone(
                text=text,
                reference_audio_path=reference_audio_path,
                output_path=output_path
            )
        elif mode == "vc":
            # VC模式需要源音频，这里简化处理
            source_audio_path = reference_audio_path  # 实际应该从请求中获取
            voice_clone_service.voice_conversion(
                source_audio_path=source_audio_path,
                reference_audio_path=reference_audio_path,
                output_path=output_path
            )
        elif mode == "sft":
            speaker_id = task_data.get("speaker_id", "中文女")
            voice_clone_service.sft_inference(
                text=text,
                speaker_id=speaker_id,
                output_path=output_path
            )
        else:
            raise ValueError(f"不支持的模式: {mode}")
        
        # 更新任务状态
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["output_audio_path"] = str(output_path)
        tasks[task_id]["output_audio_url"] = f"/outputs/voice_clone/{output_filename}"
        tasks[task_id]["updated_at"] = datetime.now()
        
        logger.info(f"语音克隆任务完成: {task_id}")
    except Exception as e:
        logger.error(f"语音克隆任务失败 {task_id}: {e}")
        tasks[task_id]["status"] = "failed"
        tasks[task_id]["error_message"] = str(e)
        tasks[task_id]["updated_at"] = datetime.now()


@router.post("/clone", response_model=VoiceCloneResponse)
async def create_clone_task(
    request: CloneTaskRequest,
    background_tasks: BackgroundTasks
):
    """
    创建语音克隆任务
    
    支持的模式:
    - zero_shot: 零样本克隆（需要text和prompt_text）
    - cross_lingual: 跨语言克隆（需要text，支持语言标记）
    - vc: 语音转换（需要源音频和参考音频）
    - sft: SFT模式（使用预训练说话人，需要speaker_id）
    """
    try:
        # 验证参考音频是否存在
        reference_audio_path = settings.UPLOAD_AUDIO_DIR / request.reference_audio_id
        if not reference_audio_path.exists():
            raise HTTPException(status_code=404, detail="参考音频文件不存在")
        
        # 创建任务
        task_id = uuid.uuid4().hex[:16]
        task_data = {
            "task_id": task_id,
            "text": request.text,
            "prompt_text": request.prompt_text,
            "reference_audio_id": request.reference_audio_id,
            "mode": request.mode,
            "speaker_id": request.speaker_id,
            "status": "pending",
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }
        
        tasks[task_id] = task_data
        
        # 后台处理任务
        background_tasks.add_task(process_voice_clone_task, task_id, task_data)
        
        return VoiceCloneResponse(
            task_id=task_id,
            status="pending",
            created_at=task_data["created_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建语音克隆任务失败: {e}")
        raise HTTPException(status_code=500, detail=f"创建任务失败: {str(e)}")


@router.get("/task/{task_id}", response_model=VoiceCloneResponse)
async def get_clone_task(task_id: str):
    """获取语音克隆任务状态"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = tasks[task_id]
    return VoiceCloneResponse(
        task_id=task["task_id"],
        status=task["status"],
        output_audio_url=task.get("output_audio_url"),
        message=task.get("error_message"),
        created_at=task["created_at"]
    )


@router.get("/speakers")
async def get_available_speakers():
    """获取可用说话人列表（SFT模式）"""
    try:
        speakers = voice_clone_service.get_available_speakers()
        return {
            "success": True,
            "speakers": speakers
        }
    except Exception as e:
        logger.error(f"获取说话人列表失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取失败: {str(e)}")


@router.get("/tasks")
async def list_clone_tasks(limit: int = 20, offset: int = 0):
    """获取语音克隆任务列表"""
    task_list = list(tasks.values())
    task_list.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "success": True,
        "total": len(task_list),
        "tasks": task_list[offset:offset+limit]
    }

