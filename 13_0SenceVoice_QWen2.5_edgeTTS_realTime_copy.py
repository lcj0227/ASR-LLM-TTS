import cv2
import pyaudio
import wave
import threading
import numpy as np
import time
from queue import Queue
import webrtcvad
import os
import threading
from transformers import Qwen2VLForConditionalGeneration, AutoTokenizer, AutoProcessor
from transformers import AutoModelForCausalLM, AutoTokenizer
from qwen_vl_utils import process_vision_info
import torch
from funasr import AutoModel
import pygame
import edge_tts
import asyncio
from time import sleep
import langid
from langdetect import detect
import argparse
from wav2lip_utils import Wav2LipProcessor
import subprocess

# --- 配置huggingFace国内镜像 ---
import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'

# 参数设置
AUDIO_RATE = 16000        # 音频采样率
AUDIO_CHANNELS = 1        # 单声道
CHUNK = 1024              # 音频块大小
VAD_MODE = 3              # VAD 模式 (0-3, 数字越大越敏感)
OUTPUT_DIR = "./output"   # 输出目录
NO_SPEECH_THRESHOLD = 1   # 无效语音阈值，单位：秒
folder_path = "./Test_QWen2_VL/"
audio_file_count = 0

# 初始化Wav2Lip处理器
wav2lip_processor = None
face_image_path = None

# 确保输出目录存在
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(folder_path, exist_ok=True)
os.makedirs("./wav2lip_output", exist_ok=True)

# 队列用于音频和视频同步缓存
audio_queue = Queue()
video_queue = Queue()

# 全局变量
last_active_time = time.time()
recording_active = True
segments_to_save = []
saved_intervals = []
last_vad_end_time = 0  # 上次保存的 VAD 有效段结束时间

# 初始化 WebRTC VAD
vad = webrtcvad.Vad()
vad.set_mode(VAD_MODE)

# 解析命令行参数
def parse_args():
    parser = argparse.ArgumentParser(description='ASR-LLM-TTS系统，支持Wav2Lip唇形同步')
    parser.add_argument('--face_image', type=str, help='用于唇形同步的人脸图像路径')
    parser.add_argument('--wav2lip_model', type=str, default='wav2lip_model/wav2lip_gan.pth', 
                        help='Wav2Lip预训练模型路径')
    return parser.parse_args()

# 音频录制线程
def audio_recorder():
    global audio_queue, recording_active, last_active_time, segments_to_save, last_vad_end_time
    
    p = pyaudio.PyAudio()
    # 增加缓冲区大小，降低溢出风险
    stream = p.open(format=pyaudio.paInt16,
                    channels=AUDIO_CHANNELS,
                    rate=AUDIO_RATE,
                    input=True,
                    frames_per_buffer=CHUNK)  # 移除不支持的参数
    
    audio_buffer = []
    print("音频录制已开始")
    
    while recording_active:
        try:
            data = stream.read(CHUNK, exception_on_overflow=False)  # 添加错误处理，不在溢出时抛出异常
            audio_buffer.append(data)
            
            # 每 0.5 秒检测一次 VAD
            if len(audio_buffer) * CHUNK / AUDIO_RATE >= 0.5:
                # 拼接音频数据并检测 VAD
                raw_audio = b''.join(audio_buffer)
                vad_result = check_vad_activity(raw_audio)
                
                if vad_result:
                    print("检测到语音活动")
                    last_active_time = time.time()
                    segments_to_save.append((raw_audio, time.time()))
                else:
                    print("静音中...")
                
                audio_buffer = []  # 清空缓冲区
            
            # 检查无效语音时间
            if time.time() - last_active_time > NO_SPEECH_THRESHOLD:
                # 检查是否需要保存
                if segments_to_save and segments_to_save[-1][1] > last_vad_end_time:
                    save_audio_video()
                    last_active_time = time.time()
                else:
                    pass
                    # print("无新增语音段，跳过保存")
                
            # 增加短暂休眠，减轻处理负担
            time.sleep(0.01)
            
        except OSError as e:
            print(f"音频录制错误: {e}, 尝试重新配置...")
            # 尝试关闭并重新打开流
            stream.stop_stream()
            stream.close()
            time.sleep(0.5)  # 等待一会再重试
            try:
                stream = p.open(format=pyaudio.paInt16,
                               channels=AUDIO_CHANNELS,
                               rate=AUDIO_RATE,
                               input=True,
                               frames_per_buffer=CHUNK)
            except Exception as e2:
                print(f"无法重新开启音频流: {e2}")
                break
        except Exception as e:
            print(f"未知错误: {e}")
            break
    
    try:
        stream.stop_stream()
        stream.close()
        p.terminate()
    except:
        pass  # 忽略关闭时的错误

# 视频录制线程
def video_recorder():
    global video_queue, recording_active
    
    cap = cv2.VideoCapture(0)  # 使用默认摄像头
    print("视频录制已开始")
    
    while recording_active:
        ret, frame = cap.read()
        if ret:
            video_queue.put((frame, time.time()))
            
            # 实时显示摄像头画面
            cv2.imshow("Real Camera", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):  # 按 Q 键退出
                break
        else:
            print("无法获取摄像头画面")
    
    cap.release()
    cv2.destroyAllWindows()

# 检测 VAD 活动
def check_vad_activity(audio_data):
    # 将音频数据分块检测
    num, rate = 0, 0.4
    step = int(AUDIO_RATE * 0.02)  # 20ms 块大小
    flag_rate = round(rate * len(audio_data) // step)

    for i in range(0, len(audio_data), step):
        chunk = audio_data[i:i + step]
        if len(chunk) == step:
            if vad.is_speech(chunk, sample_rate=AUDIO_RATE):
                num += 1

    if num > flag_rate:
        return True
    return False

# 保存音频和视频
def save_audio_video():
    pygame.mixer.init()

    global segments_to_save, video_queue, last_vad_end_time, saved_intervals

    # 全局变量，用于保存音频文件名计数
    global audio_file_count
    audio_file_count += 1
    audio_output_path = f"{OUTPUT_DIR}/audio_{audio_file_count}.wav"
    # audio_output_path = f"{OUTPUT_DIR}/audio_0.wav"

    if not segments_to_save:
        return
    
    # 停止当前播放的音频
    if pygame.mixer.music.get_busy():
        pygame.mixer.music.stop()
        print("检测到新的有效音，已停止当前音频播放")
        
    # 获取有效段的时间范围
    start_time = segments_to_save[0][1]
    end_time = segments_to_save[-1][1]
    
    # 检查是否与之前的片段重叠
    if saved_intervals and saved_intervals[-1][1] >= start_time:
        print("当前片段与之前片段重叠，跳过保存")
        segments_to_save.clear()
        return
    
    # 保存音频
    audio_frames = [seg[0] for seg in segments_to_save]
    
    wf = wave.open(audio_output_path, 'wb')
    wf.setnchannels(AUDIO_CHANNELS)
    wf.setsampwidth(2)  # 16-bit PCM
    wf.setframerate(AUDIO_RATE)
    wf.writeframes(b''.join(audio_frames))
    wf.close()
    print(f"音频保存至 {audio_output_path}")
    
    # 使用线程执行推理
    try:
        inference_thread = threading.Thread(target=Inference, args=(audio_output_path,))
        inference_thread.start()
    except Exception as e:
        print(f"启动推理线程失败: {e}")
        
    # 记录保存的区间
    saved_intervals.append((start_time, end_time))
    
    # 清空缓冲区
    segments_to_save.clear()

# --- 播放音频 -
def play_audio(file_path):
    try:
        pygame.mixer.init()
        pygame.mixer.music.load(file_path)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            time.sleep(0.1)  # 缩短检查间隔，减少阻塞
        print("播放完成！")
    except Exception as e:
        print(f"播放失败: {e}")
    finally:
        pygame.mixer.quit()

async def amain(TEXT, VOICE, OUTPUT_FILE) -> None:
    """Main function"""
    try:
        communicate = edge_tts.Communicate(TEXT, VOICE)
        await communicate.save(OUTPUT_FILE)
    except Exception as e:
        print(f"语音合成失败: {e}")


# -------- SenceVoice 语音识别 --模型加载-----
model_dir = "iic/SenseVoiceSmall"  # 使用modelscope模型名称
model_senceVoice = AutoModel(model=model_dir, trust_remote_code=True)

# --- QWen2.5大语言模型 ---
# model_name = "Qwen/Qwen2.5-0.5B-Instruct"
model_name = "Qwen/Qwen2.5-1.5B-Instruct"
# model_name = "Qwen/Qwen2.5-7B-Instruct-GPTQ-Int4"
model = AutoModelForCausalLM.from_pretrained(
    model_name,
    torch_dtype="auto",
    device_map="auto"
)
tokenizer = AutoTokenizer.from_pretrained(model_name)

def Inference(TEMP_AUDIO_FILE=f"{OUTPUT_DIR}/audio_0.wav"):
    global face_image_path, wav2lip_processor
    
    try:
        # -------- SenceVoice 推理 ---------
        input_file = (TEMP_AUDIO_FILE)
        res = model_senceVoice.generate(
            input=input_file,
            cache={},
            language="auto", # "zn", "en", "yue", "ja", "ko", "nospeech"
            use_itn=False,
        )
        # prompt = res[0]['text'].split(">")[-1]
        prompt = res[0]['text'].split(">")[-1] + "，回答简短一些，保持50字以内！"
        print("ASR OUT:", prompt)
        # ---------SenceVoice --end----------
        # -------- 模型推理阶段，将语音识别结果作为大模型Prompt ------
        messages = [
            {"role": "system", "content": "你叫千问，是一个18岁的女大学生，性格活泼开朗，说话俏皮"},
            {"role": "user", "content": prompt},
        ]
        text = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        model_inputs = tokenizer([text], return_tensors="pt").to(model.device)

        generated_ids = model.generate(
            **model_inputs,
            max_new_tokens=512,
        )
        generated_ids = [
            output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
        ]

        output_text = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]

        print("answer", output_text)

        # 输入文本
        text = output_text
        # 语种识别 -- langid
        language, confidence = langid.classify(text)
        # 语种识别 -- langdetect 
        # language = detect(text).split("-")[0]

        language_speaker = {
        "ja" : "ja-JP-NanamiNeural",            # ok
        "fr" : "fr-FR-DeniseNeural",            # ok
        "es" : "ca-ES-JoanaNeural",             # ok
        "de" : "de-DE-KatjaNeural",             # ok
        "zh" : "zh-CN-XiaoyiNeural",            # ok
        "en" : "en-US-AnaNeural",               # ok
        }

        if language not in language_speaker.keys():
            used_speaker = "zh-CN-XiaoyiNeural"
        else:
            used_speaker = language_speaker[language]
            print("检测到语种：", language, "使用音色：", language_speaker[language])

        global audio_file_count
        tts_output = os.path.join(folder_path, f"sft_{audio_file_count}.mp3")
        asyncio.run(amain(text, used_speaker, tts_output))
        
        # 生成唇形同步视频（如果提供了人脸图像）
        if face_image_path and wav2lip_processor:
            try:
                wav2lip_output = f"./wav2lip_output/video_{audio_file_count}.mp4"
                print(f"开始生成唇形同步视频: {wav2lip_output}")
                
                # 转换mp3到wav格式（wav2lip需要wav格式）
                wav_for_lip = f"{OUTPUT_DIR}/temp_for_lip_{audio_file_count}.wav"
                convert_cmd = [
                    "ffmpeg", "-y", "-i", tts_output, "-acodec", "pcm_s16le", 
                    "-ar", "16000", "-ac", "1", wav_for_lip
                ]
                subprocess.run(convert_cmd, check=True)
                
                # 使用wav2lip处理器生成视频
                wav2lip_processor.process_video(
                    face_image_path=face_image_path,
                    audio_path=wav_for_lip,
                    output_path=wav2lip_output
                )
                
                # 播放生成的视频
                print(f"播放唇形同步视频: {wav2lip_output}")
                play_video_thread = threading.Thread(target=play_video, args=(wav2lip_output,))
                play_video_thread.start()
                
                # 清理临时文件
                if os.path.exists(wav_for_lip):
                    os.remove(wav_for_lip)
                
            except Exception as e:
                print(f"生成唇形同步视频失败: {e}")
                # 失败时退回到普通音频播放
                play_audio(tts_output)
        else:
            # 没有人脸图像时，直接播放音频
            play_audio(tts_output)
            
    except Exception as e:
        print(f"推理过程发生错误: {e}")

def play_video(video_path):
    """播放视频"""
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"无法打开视频: {video_path}")
            return
            
        # 获取视频属性
        fps = cap.get(cv2.CAP_PROP_FPS)
        delay = int(1000/fps)
        
        # 创建窗口
        cv2.namedWindow("Wav2Lip Output", cv2.WINDOW_NORMAL)
        
        # 播放视频
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            cv2.imshow("Wav2Lip Output", frame)
            
            # 按q键退出
            if cv2.waitKey(delay) & 0xFF == ord('q'):
                break
                
        cap.release()
        cv2.destroyWindow("Wav2Lip Output")
    except Exception as e:
        print(f"播放视频失败: {e}")

# 主函数
if __name__ == "__main__":
    args = parse_args()
    
    # 如果提供了人脸图像路径，初始化Wav2Lip处理器
    if args.face_image:
        face_image_path = args.face_image
        if os.path.exists(face_image_path):
            print(f"使用人脸图像: {face_image_path}")
            wav2lip_processor = Wav2LipProcessor(checkpoint_path=args.wav2lip_model)
        else:
            print(f"人脸图像文件不存在: {face_image_path}")
            face_image_path = None

    try:
        # 启动音视频录制线程
        audio_thread = threading.Thread(target=audio_recorder)
        # 如果需要实时视频，取消下面的注释
        # video_thread = threading.Thread(target=video_recorder)
        audio_thread.start()
        # video_thread.start()
        
        print("按 Ctrl+C 停止录制")
        print("当前模式: " + ("带唇形同步" if face_image_path else "仅语音"))
        while True:
            time.sleep(0.5)  # 减少主线程CPU占用
    
    except KeyboardInterrupt:
        print("录制停止中...")
        recording_active = False
        audio_thread.join(timeout=2)  # 设置超时，防止无限等待
        # video_thread.join()
        print("录制已停止")
