"""
文件处理工具函数
"""
import os
import uuid
from pathlib import Path
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException
from app.config import settings


def generate_unique_filename(original_filename: str, prefix: str = "") -> str:
    """生成唯一文件名"""
    ext = Path(original_filename).suffix
    unique_id = uuid.uuid4().hex[:8]
    if prefix:
        return f"{prefix}_{unique_id}{ext}"
    return f"{unique_id}{ext}"


def validate_file_type(filename: str, allowed_extensions: set) -> bool:
    """验证文件类型"""
    ext = Path(filename).suffix.lower()
    return ext in allowed_extensions


def validate_file_size(file_size: int, max_size_mb: int) -> bool:
    """验证文件大小"""
    max_size_bytes = max_size_mb * 1024 * 1024
    return file_size <= max_size_bytes


async def save_upload_file(
    file: UploadFile,
    directory: Path,
    max_size_mb: int = settings.MAX_FILE_SIZE,
    allowed_extensions: Optional[set] = None
) -> Tuple[Path, str]:
    """
    保存上传的文件
    
    Args:
        file: 上传的文件
        directory: 保存目录
        max_size_mb: 最大文件大小(MB)
        allowed_extensions: 允许的文件扩展名集合
    
    Returns:
        (文件路径, 文件名) 元组
    """
    # 验证文件类型
    if allowed_extensions:
        if not validate_file_type(file.filename, allowed_extensions):
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件类型。允许的类型: {', '.join(allowed_extensions)}"
            )
    
    # 验证文件大小
    file_content = await file.read()
    file_size = len(file_content)
    if not validate_file_size(file_size, max_size_mb):
        raise HTTPException(
            status_code=400,
            detail=f"文件大小超过限制。最大大小: {max_size_mb}MB"
        )
    
    # 生成唯一文件名
    filename = generate_unique_filename(file.filename)
    file_path = directory / filename
    
    # 保存文件
    with open(file_path, "wb") as f:
        f.write(file_content)
    
    return file_path, filename


def get_file_info(file_path: Path) -> dict:
    """获取文件信息"""
    if not file_path.exists():
        return None
    
    stat = file_path.stat()
    return {
        "path": str(file_path),
        "filename": file_path.name,
        "size": stat.st_size,
        "size_mb": round(stat.st_size / (1024 * 1024), 2),
        "created_at": stat.st_ctime,
        "modified_at": stat.st_mtime,
    }


def delete_file(file_path: Path) -> bool:
    """删除文件"""
    try:
        if file_path.exists():
            file_path.unlink()
            return True
        return False
    except Exception as e:
        print(f"删除文件失败: {e}")
        return False

