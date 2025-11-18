"""
训练管理API
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any
from pathlib import Path
from datetime import datetime
import uuid
import logging
from app.config import settings
from app.models.training import (
    TrainingRequest,
    TrainingResponse,
    TrainingType,
    TrainingStatus
)
from app.services.training_service import training_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/training", tags=["训练管理"])

# 任务存储（实际应用中应使用数据库）
tasks: dict = {}


def update_training_task(task_id: str, updates: Dict[str, Any]):
    """更新训练任务状态"""
    if task_id in tasks:
        tasks[task_id].update(updates)
        tasks[task_id]["updated_at"] = datetime.now()


@router.post("/create", response_model=TrainingResponse)
async def create_training_task(request: TrainingRequest):
    """
    创建训练任务
    
    支持的类型:
    - voice_clone: CosyVoice SFT训练
    - lip_sync: Wav2Lip微调训练
    """
    try:
        # 验证训练类型
        if request.training_type not in [TrainingType.VOICE_CLONE, TrainingType.LIP_SYNC]:
            raise HTTPException(status_code=400, detail="不支持的训练类型")
        
        # 创建任务ID
        task_id = uuid.uuid4().hex[:16]
        
        # 创建输出目录
        output_dir = settings.OUTPUT_TRAINING_DIR / task_id
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 创建任务
        task_data = training_service.create_training_task(
            task_id=task_id,
            training_type=request.training_type,
            config=request.config,
            output_dir=output_dir
        )
        
        task_data.update({
            "name": request.name,
            "description": request.description,
            "user_id": None,  # 实际应用中从认证获取
            "logs": [],
            "updated_at": datetime.now(),
        })
        
        tasks[task_id] = task_data
        
        # 启动训练（后台执行）
        training_service.start_training(
            task_id=task_id,
            training_type=request.training_type,
            config=request.config,
            output_dir=output_dir,
            update_callback=update_training_task
        )
        
        return TrainingResponse(
            task_id=task_id,
            status=TrainingStatus.PENDING,
            created_at=task_data["created_at"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建训练任务失败: {e}")
        raise HTTPException(status_code=500, detail=f"创建任务失败: {str(e)}")


@router.get("/task/{task_id}", response_model=TrainingResponse)
async def get_training_task(task_id: str):
    """获取训练任务状态"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = tasks[task_id]
    return TrainingResponse(
        task_id=task["task_id"],
        status=task["status"],
        progress=task.get("progress", 0.0),
        message=task.get("message"),
        created_at=task["created_at"]
    )


@router.get("/task/{task_id}/details")
async def get_training_task_details(task_id: str):
    """获取训练任务详细信息"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = tasks[task_id]
    return {
        "success": True,
        "task": task
    }


@router.get("/tasks")
async def list_training_tasks(
    limit: int = 20,
    offset: int = 0,
    status: Optional[TrainingStatus] = None
):
    """获取训练任务列表"""
    task_list = list(tasks.values())
    
    # 按状态过滤
    if status:
        task_list = [t for t in task_list if t["status"] == status]
    
    # 按创建时间排序
    task_list.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "success": True,
        "total": len(task_list),
        "tasks": task_list[offset:offset+limit]
    }


@router.post("/task/{task_id}/cancel")
async def cancel_training_task(task_id: str):
    """取消训练任务"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = tasks[task_id]
    
    # 检查任务状态
    if task["status"] in [TrainingStatus.COMPLETED, TrainingStatus.FAILED, TrainingStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="任务已结束，无法取消")
    
    # 取消训练
    success = training_service.cancel_training(task_id)
    
    if success:
        update_training_task(task_id, {
            "status": TrainingStatus.CANCELLED,
            "message": "任务已取消"
        })
    
    return {
        "success": success,
        "message": "任务已取消" if success else "取消任务失败"
    }


@router.delete("/task/{task_id}")
async def delete_training_task(task_id: str):
    """删除训练任务"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = tasks[task_id]
    
    # 检查任务状态
    if task["status"] == TrainingStatus.TRAINING:
        raise HTTPException(status_code=400, detail="任务正在运行，无法删除")
    
    # 删除任务数据
    del tasks[task_id]
    
    # 删除输出目录（可选）
    output_dir = settings.OUTPUT_TRAINING_DIR / task_id
    if output_dir.exists():
        import shutil
        shutil.rmtree(output_dir)
    
    return {
        "success": True,
        "message": "任务已删除"
    }

