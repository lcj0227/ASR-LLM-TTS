import os
import subprocess
import argparse
import tempfile

def parse_args():
    parser = argparse.ArgumentParser(description='简单的视频音频同步测试')
    parser.add_argument('--face_image', type=str, required=True, help='人脸图像路径')
    parser.add_argument('--audio', type=str, required=True, help='音频文件路径')
    parser.add_argument('--output', type=str, default='simple_output.mp4', help='输出视频路径')
    return parser.parse_args()

def main():
    args = parse_args()
    
    # 检查文件是否存在
    if not os.path.exists(args.face_image):
        print(f"错误：图像文件不存在: {args.face_image}")
        return
    if not os.path.exists(args.audio):
        print(f"错误：音频文件不存在: {args.audio}")
        return
    
    # 创建临时目录
    temp_dir = tempfile.mkdtemp()
    temp_video = os.path.join(temp_dir, "temp_video.mp4")
    
    try:
        # 获取音频时长
        cmd_duration = [
            "ffprobe", 
            "-v", "error", 
            "-show_entries", "format=duration", 
            "-of", "default=noprint_wrappers=1:nokey=1", 
            args.audio
        ]
        result = subprocess.run(cmd_duration, capture_output=True, text=True)
        duration = float(result.stdout.strip())
        print(f"音频时长: {duration}秒")
        
        # 从图像创建视频
        cmd_video = [
            "ffmpeg", "-y",
            "-loop", "1",
            "-i", args.face_image,
            "-c:v", "libx264",
            "-t", str(duration),
            "-pix_fmt", "yuv420p",
            temp_video
        ]
        print("从图像创建视频中...")
        subprocess.run(cmd_video, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        # 合并视频和音频
        cmd_merge = [
            "ffmpeg", "-y",
            "-i", temp_video,
            "-i", args.audio,
            "-c:v", "copy",
            "-c:a", "aac",
            "-shortest",
            args.output
        ]
        print("合并视频和音频中...")
        subprocess.run(cmd_merge, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        print(f"处理完成！输出文件: {args.output}")
        
    except subprocess.SubprocessError as e:
        print(f"处理失败: {e}")
    except Exception as e:
        print(f"发生错误: {e}")
    finally:
        # 清理临时文件
        if os.path.exists(temp_video):
            os.remove(temp_video)
        os.rmdir(temp_dir)

if __name__ == "__main__":
    main() 