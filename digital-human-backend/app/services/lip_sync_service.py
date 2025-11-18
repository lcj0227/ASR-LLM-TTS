"""
唇形同步服务
"""
import os
import sys
import cv2
import subprocess
import platform
from pathlib import Path
from typing import Optional
import logging

# 添加Wav2Lip到路径
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / "Wav2Lip"))

from app.config import settings

logger = logging.getLogger(__name__)


class LipSyncService:
    """唇形同步服务类"""
    
    def __init__(self):
        self.checkpoint_path: Optional[str] = None
        self.model_loaded = False
    
    def load_model(self, checkpoint_path: Optional[str] = None):
        """加载Wav2Lip模型"""
        if self.model_loaded:
            return
        
        try:
            self.checkpoint_path = checkpoint_path or settings.WAV2LIP_CHECKPOINT_PATH
            if not self.checkpoint_path:
                # 尝试默认路径
                default_path = Path(__file__).parent.parent.parent.parent / "Wav2Lip" / "checkpoints" / "wav2lip_gan.pth"
                if default_path.exists():
                    self.checkpoint_path = str(default_path)
                else:
                    raise FileNotFoundError("Wav2Lip模型文件不存在，请设置WAV2LIP_CHECKPOINT_PATH环境变量")
            
            if not Path(self.checkpoint_path).exists():
                raise FileNotFoundError(f"Wav2Lip模型文件不存在: {self.checkpoint_path}")
            
            self.model_loaded = True
            logger.info(f"Wav2Lip模型路径已设置: {self.checkpoint_path}")
        except Exception as e:
            logger.error(f"加载Wav2Lip模型失败: {e}")
            raise
    
    def process_lip_sync(
        self,
        face_path: Path,
        audio_path: Path,
        output_path: Path,
        static: bool = False,
        fps: float = 25.0,
        pads: tuple = (0, 10, 0, 0),
        resize_factor: int = 1
    ) -> Path:
        """
        处理唇形同步
        
        Args:
            face_path: 人脸图片或视频路径
            audio_path: 音频路径
            output_path: 输出视频路径
            static: 是否使用静态图片
            fps: 视频帧率（静态图片时使用）
            pads: 填充 (top, bottom, left, right)
            resize_factor: 缩放因子
        
        Returns:
            输出视频路径
        """
        if not self.model_loaded:
            self.load_model()
        
        try:
            # 确保输出目录存在
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 检查输入文件
            if not face_path.exists():
                raise FileNotFoundError(f"人脸文件不存在: {face_path}")
            if not audio_path.exists():
                raise FileNotFoundError(f"音频文件不存在: {audio_path}")
            
            # 如果是图片，需要转换为视频（如果是静态模式）
            if static and face_path.suffix.lower() in {'.jpg', '.jpeg', '.png', '.bmp'}:
                temp_video = settings.TEMP_DIR / f"temp_face_{face_path.stem}.mp4"
                self._create_video_from_image(face_path, temp_video, fps, duration=10)
                face_path = temp_video
            
            # 确保音频是WAV格式
            audio_wav = audio_path
            if audio_path.suffix.lower() != '.wav':
                audio_wav = settings.TEMP_DIR / f"temp_audio_{audio_path.stem}.wav"
                self._convert_audio_to_wav(audio_path, audio_wav)
            
            # 调用Wav2Lip推理
            logger.info(f"开始唇形同步处理: {face_path} + {audio_wav}")
            self._run_wav2lip_inference(
                face_path=face_path,
                audio_path=audio_wav,
                output_path=output_path,
                static=static,
                fps=fps,
                pads=pads,
                resize_factor=resize_factor
            )
            
            logger.info(f"唇形同步处理完成: {output_path}")
            return output_path
        except Exception as e:
            logger.error(f"唇形同步处理失败: {e}")
            raise
    
    def _create_video_from_image(self, image_path: Path, video_path: Path, fps: float, duration: float):
        """从图片创建视频"""
        try:
            img = cv2.imread(str(image_path))
            if img is None:
                raise ValueError(f"无法读取图片: {image_path}")
            
            height, width = img.shape[:2]
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(str(video_path), fourcc, fps, (width, height))
            
            frame_count = int(fps * duration)
            for _ in range(frame_count):
                out.write(img)
            
            out.release()
            logger.info(f"从图片创建视频: {video_path}")
        except Exception as e:
            logger.error(f"创建视频失败: {e}")
            raise
    
    def _convert_audio_to_wav(self, input_path: Path, output_path: Path, sample_rate: int = 16000):
        """转换音频为WAV格式"""
        try:
            cmd = [
                "ffmpeg", "-y", "-i", str(input_path),
                "-ar", str(sample_rate),
                "-ac", "1",
                "-acodec", "pcm_s16le",
                str(output_path)
            ]
            result = subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                text=True
            )
            logger.info(f"音频转换完成: {output_path}")
        except subprocess.CalledProcessError as e:
            logger.error(f"音频转换失败: {e.stderr}")
            raise
        except FileNotFoundError:
            raise RuntimeError("ffmpeg未安装或不在PATH中")
    
    def _run_wav2lip_inference(
        self,
        face_path: Path,
        audio_path: Path,
        output_path: Path,
        static: bool = False,
        fps: float = 25.0,
        pads: tuple = (0, 10, 0, 0),
        resize_factor: int = 1
    ):
        """运行Wav2Lip推理"""
        try:
            # 导入Wav2Lip推理模块
            from Wav2Lip import inference as wav2lip_inference
            import argparse
            
            # 创建临时目录
            temp_dir = settings.TEMP_DIR
            temp_dir.mkdir(parents=True, exist_ok=True)
            
            # 准备参数
            class Args:
                checkpoint_path = self.checkpoint_path
                face = str(face_path)
                audio = str(audio_path)
                outfile = str(output_path)
                static = static
                fps = fps
                pads = list(pads)
                face_det_batch_size = 16
                wav2lip_batch_size = 128
                resize_factor = resize_factor
                crop = [0, -1, 0, -1]
                rotate = False
                nosmooth = False
                box = [-1, -1, -1, -1]
            
            args = Args()
            
            # 由于Wav2Lip的inference.py是脚本形式，我们需要直接调用其函数
            # 这里简化处理，使用命令行调用
            # 实际应用中可以重构Wav2Lip代码为可导入的模块
            
            # 使用subprocess调用Wav2Lip（需要修改inference.py支持命令行参数）
            # 或者直接导入并调用函数
            
            # 简化方案：使用wav2lip_utils（如果存在）
            try:
                from wav2lip_utils import Wav2LipProcessor
                processor = Wav2LipProcessor(checkpoint_path=self.checkpoint_path)
                processor.process_video(
                    face_image_path=face_path if static else None,
                    face_video_path=None if static else face_path,
                    audio_path=audio_path,
                    output_path=output_path,
                    fps=fps,
                    pads=pads
                )
            except ImportError:
                # 如果wav2lip_utils不存在，使用命令行方式
                logger.warning("wav2lip_utils不可用，尝试使用命令行方式")
                # 这里可以添加命令行调用逻辑
                raise NotImplementedError("需要实现Wav2Lip推理调用")
            
        except Exception as e:
            logger.error(f"Wav2Lip推理失败: {e}")
            raise


# 创建全局服务实例
lip_sync_service = LipSyncService()

