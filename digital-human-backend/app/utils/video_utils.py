"""
视频处理工具函数
"""
import cv2
from pathlib import Path
from typing import Optional, Tuple


def get_video_info(video_path: Path) -> dict:
    """获取视频文件信息"""
    try:
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            return None
        
        info = {
            "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            "fps": cap.get(cv2.CAP_PROP_FPS),
            "frame_count": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
            "duration": 0,
        }
        
        if info["fps"] > 0:
            info["duration"] = info["frame_count"] / info["fps"]
        
        cap.release()
        return info
    except Exception as e:
        print(f"读取视频信息失败: {e}")
        return None


def extract_frame(video_path: Path, frame_index: int = 0, output_path: Optional[Path] = None) -> Optional[Path]:
    """从视频中提取帧"""
    try:
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            return None
        
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            return None
        
        if output_path is None:
            output_path = video_path.parent / f"{video_path.stem}_frame_{frame_index}.jpg"
        
        cv2.imwrite(str(output_path), frame)
        return output_path
    except Exception as e:
        print(f"提取视频帧失败: {e}")
        return None

