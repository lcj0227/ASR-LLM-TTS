import os
import argparse
from wav2lip_utils import Wav2LipProcessor

def parse_args():
    parser = argparse.ArgumentParser(description='测试Wav2Lip唇形同步功能')
    parser.add_argument('--face_image', type=str, required=True, 
                        help='人脸图像路径')
    parser.add_argument('--audio', type=str, required=True,
                        help='音频文件路径（支持mp3, wav格式）')
    parser.add_argument('--output', type=str, default='output_video.mp4',
                        help='输出视频路径')
    parser.add_argument('--model', type=str, default='wav2lip_model/wav2lip_gan.pth',
                        help='Wav2Lip预训练模型路径')
    return parser.parse_args()

def main():
    args = parse_args()
    
    # 检查文件是否存在
    if not os.path.exists(args.face_image):
        print(f"错误：人脸图像文件不存在: {args.face_image}")
        return
    
    if not os.path.exists(args.audio):
        print(f"错误：音频文件不存在: {args.audio}")
        return
    
    # 确保输出目录存在
    output_dir = os.path.dirname(args.output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # 初始化Wav2Lip处理器
    processor = Wav2LipProcessor(checkpoint_path=args.model)
    
    # 如果音频是mp3格式，转换为wav格式
    audio_path = args.audio
    if audio_path.endswith('.mp3'):
        import subprocess
        wav_path = 'temp_audio.wav'
        try:
            cmd = [
                "ffmpeg", "-y", "-i", audio_path, 
                "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", 
                wav_path
            ]
            subprocess.run(cmd, check=True)
            audio_path = wav_path
            print(f"已将MP3转换为WAV: {wav_path}")
        except Exception as e:
            print(f"转换音频格式失败: {e}")
            return
    
    # 处理视频
    try:
        processor.process_video(
            face_image_path=args.face_image,
            audio_path=audio_path,
            output_path=args.output
        )
        print(f"唇形同步视频生成完成: {args.output}")
        
        # 如果有临时文件，删除
        if audio_path != args.audio and os.path.exists(audio_path):
            os.remove(audio_path)
    except Exception as e:
        print(f"处理失败: {e}")

if __name__ == "__main__":
    main() 