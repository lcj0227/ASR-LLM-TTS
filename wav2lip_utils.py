import cv2
import numpy as np
import torch
import os
import librosa
import tempfile
import subprocess
from tqdm import tqdm
import shutil
import sys

class Wav2LipProcessor:
    def __init__(self, checkpoint_path='Wav2Lip/checkpoints/wav2lip_gan.pth', device='cpu'):
        """
        初始化Wav2Lip处理器
        
        Args:
            checkpoint_path: 预训练模型路径
            device: 运行设备
        """
        self.checkpoint_path = checkpoint_path
        self.device = device
        self.model = None
        self.temp_dir = tempfile.mkdtemp()
        
        # 检查FFmpeg是否可用
        try:
            subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            self.ffmpeg_available = True
        except (subprocess.SubprocessError, FileNotFoundError):
            self.ffmpeg_available = False
            print("警告: FFmpeg不可用，某些功能可能无法使用")
        
        # 检查Wav2Lip目录
        if not os.path.exists("Wav2Lip"):
            print("警告: Wav2Lip目录不存在，唇形同步功能将不可用")
        elif not os.path.exists("Wav2Lip/inference.py"):
            print("警告: Wav2Lip/inference.py不存在，唇形同步功能将不可用")
        
        # 如果没有预训练模型，打印下载指南
        if not os.path.exists(checkpoint_path):
            print(f"需要下载Wav2Lip预训练模型并放置在 {checkpoint_path} 路径")
            print("您可以从 https://github.com/Rudrabha/Wav2Lip#getting-the-weights 下载")
            print("1. 访问 https://iiitaphyd-my.sharepoint.com/:u:/g/personal/radrabha_m_research_iiit_ac_in/EdjI7bZlgApMqsVoEUUXpLsBxqXMd1VmKIJWxo1QsXDtRQ?download=1")
            print("2. 下载文件并将其放置在", checkpoint_path)
    
    def __del__(self):
        """析构函数，清理临时目录"""
        try:
            if hasattr(self, 'temp_dir') and os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir)
        except Exception as e:
            print(f"清理临时目录失败: {e}")
    
    def process_video(self, face_image_path, audio_path, output_path, 
                     fps=25, pads=(0, 0, 0, 0), face_det_batch_size=16, 
                     wav2lip_batch_size=128, resize_factor=1, crop=[0, -1, 0, -1]):
        """
        处理视频，将音频与人脸图像同步
        
        Args:
            face_image_path: 人脸图片路径
            audio_path: 音频文件路径
            output_path: 输出视频路径
            fps: 帧率
            pads: 填充，格式为(top, bottom, left, right)
            face_det_batch_size: 人脸检测批次大小
            wav2lip_batch_size: Wav2Lip批次大小
            resize_factor: 调整大小因子
            crop: 裁剪参数
        """
        # 检查文件是否存在
        if not os.path.isfile(face_image_path):
            raise FileNotFoundError(f"人脸图像文件未找到: {face_image_path}")
        if not os.path.isfile(audio_path):
            raise FileNotFoundError(f"音频文件未找到: {audio_path}")
            
        print("准备生成唇形同步视频...")
        
        # 1. 从图像创建静态视频
        temp_video = os.path.join(self.temp_dir, "temp_video.mp4")
        self._create_video_from_image(face_image_path, temp_video, fps=fps, duration=5)
        
        # 2. 获取音频时长
        try:
            audio_duration = librosa.get_duration(path=audio_path)
        except Exception as e:
            print(f"获取音频时长失败: {e}")
            print("使用默认时长: 5秒")
            audio_duration = 5
        
        # 3. 如果需要较长视频，调整静态视频时长
        if audio_duration > 5:
            self._create_video_from_image(face_image_path, temp_video, fps=fps, duration=audio_duration+1)
        
        # 4. 检查是否可以直接调用Wav2Lip进行处理
        wav2lip_available = os.path.exists("Wav2Lip/inference.py")
        
        if wav2lip_available and os.path.exists(self.checkpoint_path):
            print("使用Wav2Lip进行唇形同步处理...")
            success = self._run_wav2lip_inference(temp_video, audio_path, output_path)
        else:
            print("Wav2Lip不可用或模型文件缺失，使用简单的视频音频合并...")
            success = False
            
        if not success and self.ffmpeg_available:
            print("使用FFmpeg合并视频和音频...")
            self._merge_video_audio(temp_video, audio_path, output_path)
        
        print(f"唇形同步视频生成完成: {output_path}")
        
        # 清理临时文件
        if os.path.exists(temp_video):
            try:
                os.remove(temp_video)
            except Exception as e:
                print(f"删除临时文件失败: {e}")
    
    def _run_wav2lip_inference(self, video_path, audio_path, output_path):
        """直接运行Wav2Lip的inference.py进行处理"""
        try:
            # 准备运行环境
            original_path = os.getcwd()
            wav2lip_dir = os.path.join(original_path, "Wav2Lip")
            
            # 创建相对路径
            rel_video_path = os.path.relpath(video_path, wav2lip_dir)
            rel_audio_path = os.path.relpath(audio_path, wav2lip_dir)
            rel_output_path = os.path.relpath(output_path, wav2lip_dir)
            rel_checkpoint_path = os.path.relpath(self.checkpoint_path, wav2lip_dir)
            
            # 进入Wav2Lip目录
            os.chdir(wav2lip_dir)
            
            # 添加当前目录到Python路径
            if wav2lip_dir not in sys.path:
                sys.path.append(wav2lip_dir)
            
            # 导入并运行inference
            try:
                # 使用命令行方式调用inference.py
                cmd = [
                    "python", "inference.py",
                    "--checkpoint_path", rel_checkpoint_path,
                    "--face", rel_video_path,
                    "--audio", rel_audio_path,
                    "--outfile", rel_output_path,
                    "--static", "1"
                ]
                print(f"执行命令: {' '.join(cmd)}")
                subprocess.run(cmd, check=True)
                
                # 检查输出文件
                if os.path.exists(os.path.join(wav2lip_dir, rel_output_path)):
                    # 返回原始目录
                    os.chdir(original_path)
                    return True
                else:
                    print(f"未找到输出文件: {rel_output_path}")
            except Exception as e:
                print(f"执行Wav2Lip推理时出错: {e}")
            
            # 返回原始目录
            os.chdir(original_path)
            return False
        except Exception as e:
            print(f"运行Wav2Lip inference失败: {e}")
            return False
    
    def _create_video_from_image(self, image_path, output_video_path, fps=25, duration=5):
        """从单一图像创建视频"""
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"无法读取图像: {image_path}")
            
        # 调整图像大小以确保宽高为偶数（FFMPEG要求）
        height, width = img.shape[:2]
        if height % 2 != 0:
            height -= 1
        if width % 2 != 0:
            width -= 1
        img = cv2.resize(img, (width, height))
        
        # 如果FFmpeg可用，使用FFmpeg创建视频
        if self.ffmpeg_available:
            # 先保存一帧图像
            temp_img_path = os.path.join(self.temp_dir, "temp_frame.jpg")
            cv2.imwrite(temp_img_path, img)
            
            cmd = [
                "ffmpeg", "-y",
                "-loop", "1",
                "-i", temp_img_path,
                "-c:v", "libx264",
                "-t", str(duration),
                "-pix_fmt", "yuv420p",
                "-vf", f"scale={width}:{height}",
                output_video_path
            ]
            
            try:
                subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if os.path.exists(temp_img_path):
                    os.remove(temp_img_path)
                return output_video_path
            except subprocess.SubprocessError:
                print("使用FFmpeg创建视频失败，将使用OpenCV")
        
        # 使用OpenCV创建视频
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # MP4编码
        video_writer = cv2.VideoWriter(
            output_video_path, fourcc, fps, (width, height)
        )
        
        # 写入图像帧
        num_frames = int(fps * duration)
        for _ in range(num_frames):
            video_writer.write(img)
            
        # 释放资源
        video_writer.release()
        
        return output_video_path
    
    def _merge_video_audio(self, video_path, audio_path, output_path):
        """合并视频和音频（当Wav2Lip不可用时的简单替代方案）"""
        if not self.ffmpeg_available:
            print("FFmpeg不可用，无法合并视频和音频")
            return False
            
        try:
            # 使用FFmpeg合并视频和音频
            cmd = [
                "ffmpeg", "-y",
                "-i", video_path,
                "-i", audio_path,
                "-c:v", "copy",
                "-c:a", "aac",
                "-strict", "experimental",
                "-shortest",
                output_path
            ]
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            # 检查输出文件
            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                return True
            else:
                print(f"合并后的文件不存在或大小为零: {output_path}")
                return False
                
        except subprocess.SubprocessError as e:
            print(f"合并视频和音频失败: {e}")
            return False
        except Exception as e:
            print(f"合并过程中发生错误: {e}")
            return False

# 示例用法
if __name__ == "__main__":
    processor = Wav2LipProcessor()
    processor.process_video(
        face_image_path="face.jpg",
        audio_path="audio.wav",
        output_path="output_video.mp4"
    ) 