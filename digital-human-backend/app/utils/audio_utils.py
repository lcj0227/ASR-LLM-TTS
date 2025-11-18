"""
音频处理工具函数
"""
import wave
import numpy as np
from pathlib import Path
from typing import Optional, Tuple


def get_audio_info(audio_path: Path) -> dict:
    """获取音频文件信息"""
    try:
        with wave.open(str(audio_path), 'rb') as wf:
            return {
                "channels": wf.getnchannels(),
                "sample_width": wf.getsampwidth(),
                "framerate": wf.getframerate(),
                "nframes": wf.getnframes(),
                "duration": wf.getnframes() / wf.getframerate(),
            }
    except Exception as e:
        print(f"读取音频信息失败: {e}")
        return None


def convert_audio_format(
    input_path: Path,
    output_path: Path,
    target_sample_rate: int = 16000,
    target_channels: int = 1
) -> bool:
    """
    转换音频格式（需要ffmpeg）
    
    Args:
        input_path: 输入音频路径
        output_path: 输出音频路径
        target_sample_rate: 目标采样率
        target_channels: 目标声道数
    
    Returns:
        是否成功
    """
    try:
        import subprocess
        cmd = [
            "ffmpeg", "-y", "-i", str(input_path),
            "-ar", str(target_sample_rate),
            "-ac", str(target_channels),
            "-acodec", "pcm_s16le",
            str(output_path)
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        return True
    except Exception as e:
        print(f"音频格式转换失败: {e}")
        return False

