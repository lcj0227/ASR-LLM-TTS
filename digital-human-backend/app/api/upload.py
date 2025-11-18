"""
文件上传API
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from typing import List
from pathlib import Path
from app.config import settings
from app.utils.file_utils import save_upload_file, get_file_info, delete_file
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/upload", tags=["文件上传"])


@router.post("/audio")
async def upload_audio(file: UploadFile = File(...)):
    """
    上传音频文件
    
    支持的格式: wav, mp3, m4a, flac, ogg
    最大大小: 100MB
    """
    try:
        file_path, filename = await save_upload_file(
            file=file,
            directory=settings.UPLOAD_AUDIO_DIR,
            max_size_mb=settings.MAX_AUDIO_SIZE,
            allowed_extensions=settings.ALLOWED_AUDIO_EXTENSIONS
        )
        
        file_info = get_file_info(file_path)
        
        return {
            "success": True,
            "file_id": filename,
            "filename": filename,
            "url": f"/uploads/audio/{filename}",
            "info": file_info
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传音频文件失败: {e}")
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.post("/video")
async def upload_video(file: UploadFile = File(...)):
    """
    上传视频文件
    
    支持的格式: mp4, avi, mov, mkv, webm
    最大大小: 500MB
    """
    try:
        file_path, filename = await save_upload_file(
            file=file,
            directory=settings.UPLOAD_VIDEO_DIR,
            max_size_mb=settings.MAX_VIDEO_SIZE,
            allowed_extensions=settings.ALLOWED_VIDEO_EXTENSIONS
        )
        
        file_info = get_file_info(file_path)
        
        return {
            "success": True,
            "file_id": filename,
            "filename": filename,
            "url": f"/uploads/video/{filename}",
            "info": file_info
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传视频文件失败: {e}")
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    """
    上传图片文件
    
    支持的格式: jpg, jpeg, png, bmp
    最大大小: 50MB
    """
    try:
        file_path, filename = await save_upload_file(
            file=file,
            directory=settings.UPLOAD_DIR,  # 图片可以放在主上传目录
            max_size_mb=50,
            allowed_extensions=settings.ALLOWED_IMAGE_EXTENSIONS
        )
        
        file_info = get_file_info(file_path)
        
        return {
            "success": True,
            "file_id": filename,
            "filename": filename,
            "url": f"/uploads/{filename}",
            "info": file_info
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"上传图片文件失败: {e}")
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")


@router.post("/batch")
async def upload_batch(files: List[UploadFile] = File(...)):
    """
    批量上传文件
    
    自动识别文件类型并保存到对应目录
    """
    results = []
    
    for file in files:
        try:
            # 根据文件扩展名判断类型
            ext = Path(file.filename).suffix.lower()
            
            if ext in settings.ALLOWED_AUDIO_EXTENSIONS:
                file_path, filename = await save_upload_file(
                    file=file,
                    directory=settings.UPLOAD_AUDIO_DIR,
                    max_size_mb=settings.MAX_AUDIO_SIZE,
                    allowed_extensions=settings.ALLOWED_AUDIO_EXTENSIONS
                )
                file_type = "audio"
                url = f"/uploads/audio/{filename}"
            elif ext in settings.ALLOWED_VIDEO_EXTENSIONS:
                file_path, filename = await save_upload_file(
                    file=file,
                    directory=settings.UPLOAD_VIDEO_DIR,
                    max_size_mb=settings.MAX_VIDEO_SIZE,
                    allowed_extensions=settings.ALLOWED_VIDEO_EXTENSIONS
                )
                file_type = "video"
                url = f"/uploads/video/{filename}"
            elif ext in settings.ALLOWED_IMAGE_EXTENSIONS:
                file_path, filename = await save_upload_file(
                    file=file,
                    directory=settings.UPLOAD_DIR,
                    max_size_mb=50,
                    allowed_extensions=settings.ALLOWED_IMAGE_EXTENSIONS
                )
                file_type = "image"
                url = f"/uploads/{filename}"
            else:
                results.append({
                    "success": False,
                    "filename": file.filename,
                    "error": "不支持的文件类型"
                })
                continue
            
            file_info = get_file_info(file_path)
            
            results.append({
                "success": True,
                "file_id": filename,
                "filename": filename,
                "type": file_type,
                "url": url,
                "info": file_info
            })
        except Exception as e:
            logger.error(f"批量上传文件失败 {file.filename}: {e}")
            results.append({
                "success": False,
                "filename": file.filename,
                "error": str(e)
            })
    
    return {
        "success": True,
        "results": results,
        "total": len(files),
        "success_count": sum(1 for r in results if r.get("success", False))
    }


@router.get("/file/{file_id}")
async def get_file(file_id: str):
    """获取文件信息"""
    # 尝试在不同目录查找文件
    possible_paths = [
        settings.UPLOAD_AUDIO_DIR / file_id,
        settings.UPLOAD_VIDEO_DIR / file_id,
        settings.UPLOAD_DIR / file_id,
    ]
    
    for file_path in possible_paths:
        if file_path.exists():
            file_info = get_file_info(file_path)
            if file_info:
                # 确定URL
                if "audio" in str(file_path):
                    url = f"/uploads/audio/{file_id}"
                elif "video" in str(file_path):
                    url = f"/uploads/video/{file_id}"
                else:
                    url = f"/uploads/{file_id}"
                
                return {
                    "success": True,
                    "file_id": file_id,
                    "url": url,
                    "info": file_info
                }
    
    raise HTTPException(status_code=404, detail="文件不存在")


@router.delete("/file/{file_id}")
async def delete_uploaded_file(file_id: str):
    """删除上传的文件"""
    # 尝试在不同目录查找并删除文件
    possible_paths = [
        settings.UPLOAD_AUDIO_DIR / file_id,
        settings.UPLOAD_VIDEO_DIR / file_id,
        settings.UPLOAD_DIR / file_id,
    ]
    
    for file_path in possible_paths:
        if file_path.exists():
            if delete_file(file_path):
                return {
                    "success": True,
                    "message": "文件已删除",
                    "file_id": file_id
                }
    
    raise HTTPException(status_code=404, detail="文件不存在")

