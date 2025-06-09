#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
场景语音对话后端服务
提供WebSocket服务，接收前端音频和视频数据，模拟返回响应
同时提供RESTful API接口，处理前端的录音和对话请求
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
import base64
import time
import os
import tempfile
import random
import logging
import threading
import wave
import json
import uuid
from collections import deque
import numpy as np
import eventlet
import requests
from pathlib import Path
from flask_cors import CORS
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch
import asyncio
try:
    from funasr import AutoModel
    HAS_FUNASR = True
except ImportError:
    HAS_FUNASR = False
    logger.warning("未安装FunASR，将无法使用语音识别功能")

try:
    import edge_tts
    HAS_EDGE_TTS = True
except ImportError:
    HAS_EDGE_TTS = False
    logger.warning("未安装edge_tts，将无法使用语音合成功能")

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'scene_voice_secret!'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
CORS(app)  # 启用CORS支持REST API

# 创建临时音频文件夹
TEMP_DIR = Path("./temp_audio")
TEMP_DIR.mkdir(exist_ok=True)

# 临时存储音频和图像 - 使用线程安全的数据结构
client_data = {}
active_clients = set()
processing_lock = threading.RLock()

# REST API会话存储
rest_sessions = {}

# 服务器配置
SERVER_PORT = 8080
AUDIO_BUFFER_SIZE = 1024 * 1024  # 1MB 音频缓冲区大小
MAX_FRAMES = 5  # 每个客户端最多保存5帧
SIMULATE_PROCESSING_DELAY = 1.0  # 模拟处理延迟（秒）
SAMPLE_RATE = 16000  # 默认音频采样率

# 加载LLM模型
try:
    MODEL_PATH = "./QWen/Qwen2.5-0.5B-Instruct"  # 根据实际模型路径调整
    llm_model = AutoModelForCausalLM.from_pretrained(
        MODEL_PATH,
        torch_dtype="auto",
        device_map="auto"
    )
    llm_tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
    logger.info(f"LLM模型加载成功: {MODEL_PATH}")
    USE_LLM = True
except Exception as e:
    logger.error(f"LLM模型加载失败: {str(e)}")
    USE_LLM = False

# 加载ASR语音识别模型
try:
    if HAS_FUNASR:
        ASR_MODEL_PATH = "./QWen/pretrained_models/SenseVoiceSmall"  # 根据实际模型路径调整
        asr_model = AutoModel(
            model=ASR_MODEL_PATH,
            trust_remote_code=True,
        )
        logger.info(f"ASR模型加载成功: {ASR_MODEL_PATH}")
        USE_ASR = True
    else:
        USE_ASR = False
except Exception as e:
    logger.error(f"ASR模型加载失败: {str(e)}")
    USE_ASR = False

# 定义LLM调用函数
def call_llm(prompt, system_prompt="You are a helpful assistant.", max_tokens=512):
    """调用LLM进行推理"""
    if not USE_LLM:
        logger.warning("LLM模型未加载，使用模拟回复")
        return random.choice(SAMPLE_RESPONSES)
    
    try:
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ]
        
        text = llm_tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        
        model_inputs = llm_tokenizer([text], return_tensors="pt").to(llm_model.device)
        
        generated_ids = llm_model.generate(
            **model_inputs,
            max_new_tokens=max_tokens,
        )
        
        generated_ids = [
            output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
        ]
        
        response = llm_tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]
        
        logger.info(f"LLM响应: {response[:100]}...")
        return response
    except Exception as e:
        logger.error(f"LLM调用失败: {str(e)}")
        return "抱歉，我现在无法回答这个问题。" + random.choice(SAMPLE_RESPONSES)

# 定义图像处理函数
def process_image(image_data):
    """处理图像数据，提取特征或描述"""
    # 这里可以集成图像识别或多模态模型
    # 简单返回图像描述
    return "图像已接收，但当前版本未实现图像处理功能"

# 模拟回复
SAMPLE_RESPONSES = [
    "我看到你在一个室内环境中。需要我帮你做什么吗？",
    "根据视频内容，这似乎是一个办公区域。我能为你提供什么帮助？",
    "看起来你正在使用电脑。有什么我可以协助的吗？",
    "我注意到你的环境。有什么特定的信息你想了解的吗？",
    "基于你的视频，我可以提供相关的建议或信息。请问你需要什么？"
]

# 语音合成选项
TTS_VOICES = {
    "zh-CN": ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural", "zh-CN-XiaoyiNeural"],
    "en-US": ["en-US-AriaNeural", "en-US-GuyNeural", "en-US-JennyNeural"]
}

# 初始化客户端数据结构
def init_client_data(sid):
    """初始化客户端数据结构"""
    with processing_lock:
        if sid not in client_data:
            client_data[sid] = {
                'audio_chunks': [],
                'audio_buffer_size': 0,
                'video_frames': deque(maxlen=MAX_FRAMES),
                'last_activity': time.time(),
                'is_processing': False,
                'device_info': {
                    'sample_rate': SAMPLE_RATE,
                    'channels': 1
                },
                'text_inputs': [],  # 存储文本输入
                'tts_enabled': True  # 默认启用TTS
            }
            active_clients.add(sid)
            logger.info(f"客户端 {sid} 初始化完成")

# 清理客户端数据
def cleanup_client_data(sid):
    """清理客户端数据"""
    with processing_lock:
        if sid in client_data:
            del client_data[sid]
        if sid in active_clients:
            active_clients.remove(sid)
        logger.info(f"客户端 {sid} 数据已清理")

def save_audio_to_file(audio_data, filename=None, sample_rate=16000, channels=1):
    """将音频数据保存为WAV文件"""
    if filename is None:
        filename = TEMP_DIR / f"audio_{uuid.uuid4().hex}.wav"
    
    try:
        with wave.open(str(filename), 'wb') as wf:
            wf.setnchannels(channels)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(sample_rate)
            wf.writeframes(audio_data)
        return filename
    except Exception as e:
        logger.error(f"保存音频文件失败: {str(e)}")
        return None

def text_to_speech(text, language="zh-CN"):
    """文本转语音服务，返回音频文件URL"""
    try:
        # 选择一个语音模型
        voice = random.choice(TTS_VOICES.get(language, TTS_VOICES["zh-CN"]))
        
        # 生成唯一的文件名
        filename = f"tts_{uuid.uuid4().hex}.mp3"
        filepath = TEMP_DIR / filename
        
        # 检查是否可以使用Edge TTS
        if not HAS_EDGE_TTS:
            logger.warning("未安装edge_tts，使用模拟TTS")
            # 创建一个空的MP3文件作为模拟
            with open(filepath, "wb") as f:
                f.write(b"dummy audio data")
            return f"/audio/{filename}"
        
        logger.info(f"使用EdgeTTS处理: {text[:30]}... 使用语音: {voice}")
        
        # 使用Edge TTS进行语音合成
        async def run_tts():
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(str(filepath))
        
        # 运行异步函数
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(run_tts())
        finally:
            loop.close()
        
        # 返回相对URL路径
        return f"/audio/{filename}"
    except Exception as e:
        logger.error(f"文本转语音出错: {str(e)}")
        # 错误处理 - 创建一个空文件，避免客户端错误
        try:
            with open(filepath, "wb") as f:
                f.write(b"error in tts")
            return f"/audio/{filename}"
        except:
            return None

def detect_language(text):
    """简单的语言检测，返回语言代码"""
    # 在实际应用中应该使用更复杂的语言检测
    # 这里简单判断：包含中文字符则为中文，否则为英文
    if any('\u4e00' <= char <= '\u9fff' for char in text):
        return "zh-CN"
    return "en-US"

# 定义ASR语音识别函数
def speech_to_text(audio_file_path):
    """语音识别，将音频转为文本"""
    if not USE_ASR:
        logger.warning("ASR模型未加载，使用模拟文本")
        return "请帮我回答一个问题，谢谢。", 0.8
    
    try:
        logger.info(f"开始进行语音识别: {audio_file_path}")
        
        # 调用FunASR模型
        res = asr_model.generate(
            input=str(audio_file_path),
            cache={},
            language="auto",  # 自动识别语言
            use_itn=False,
        )
        
        # 提取识别文本
        text = res[0]['text'].split(">")[-1] if ">" in res[0]['text'] else res[0]['text']
        confidence = res[0].get('score', 0.9)  # 获取置信度
        
        logger.info(f"语音识别结果: {text}")
        return text, confidence
    except Exception as e:
        logger.error(f"语音识别失败: {str(e)}")
        return "语音识别失败，请重试。", 0.1

@app.route('/')
def index():
    """服务器状态页面"""
    return jsonify({
        'status': 'running',
        'uptime': time.time(),
        'active_clients': len(active_clients),
        'active_sessions': len(rest_sessions),
        'version': '1.0.0'
    })

@app.route('/audio/<filename>')
def serve_audio(filename):
    """提供音频文件的访问"""
    return send_from_directory(TEMP_DIR, filename)

# ===================== RESTful API 接口 =====================

@app.route('/api/audio/<filename>')
def serve_api_audio(filename):
    """REST API: 提供音频文件的访问"""
    return send_from_directory(TEMP_DIR, filename)

@app.route('/api/recording/start', methods=['POST'])
def start_recording():
    """REST API: 开始新的录音会话"""
    try:
        # 创建新的会话ID
        session_id = str(uuid.uuid4())
        
        # 初始化会话数据
        rest_sessions[session_id] = {
            'created_at': time.time(),
            'last_activity': time.time(),
            'audio_files': [],
            'recognized_texts': []
        }
        
        logger.info(f"创建新的REST录音会话: {session_id}")
        
        return jsonify({
            'success': True,
            'sessionId': session_id,
            'message': '录音会话已创建'
        })
    except Exception as e:
        logger.error(f"创建REST录音会话失败: {str(e)}")
        return jsonify({
            'success': False,
            'error': '创建录音会话失败'
        }), 500

@app.route('/api/recording/stop', methods=['POST'])
def stop_recording():
    """REST API: 停止录音并保存"""
    try:
        # 检查是否有音频文件
        if 'audio' not in request.files:
            return jsonify({
                'success': False,
                'error': '没有找到音频文件'
            }), 400
        
        audio_file = request.files['audio']
        
        # 生成音频文件ID和路径
        audio_id = str(uuid.uuid4())
        filename = f"recording_{audio_id}.wav"
        filepath = TEMP_DIR / filename
        
        # 保存音频文件
        audio_file.save(filepath)
        
        logger.info(f"保存REST录音文件: {filepath}")
        
        # 从请求表单中获取session_id
        session_id = request.form.get('sessionId')
        if session_id and session_id in rest_sessions:
            rest_sessions[session_id]['audio_files'].append(audio_id)
            rest_sessions[session_id]['last_activity'] = time.time()
        
        return jsonify({
            'success': True,
            'audioId': audio_id,
            'message': '录音已保存'
        })
    except Exception as e:
        logger.error(f"保存REST录音失败: {str(e)}")
        return jsonify({
            'success': False,
            'error': '保存录音失败'
        }), 500

@app.route('/api/chat/process', methods=['POST'])
def process_audio():
    """REST API: 处理音频并返回对话结果"""
    try:
        data = request.get_json()
        
        # 验证请求数据
        if not data or 'audioId' not in data:
            return jsonify({
                'success': False,
                'error': '请求数据无效'
            }), 400
        
        audio_id = data['audioId']
        
        # 获取音频文件路径
        audio_path = TEMP_DIR / f"recording_{audio_id}.wav"
        
        # 如果前端直接提供了文本，则优先使用文本
        if 'text' in data and data['text']:
            recognized_text = data['text']
            confidence = 1.0
            logger.info(f"使用前端提供的文本: {recognized_text}")
        else:
            # 调用ASR服务进行语音识别
            recognized_text, confidence = speech_to_text(audio_path)
        
        # 如果有上下文，可以加入到提示中
        context = data.get('context', '')
        prompt = recognized_text
        if context:
            prompt = f"上下文：{context}\n用户问题：{prompt}"
        
        # 调用LLM生成回复
        response_text = call_llm(prompt)
        
        # 检测语言并生成语音
        language = detect_language(response_text)
        audio_response = text_to_speech(response_text, language)
        
        logger.info(f"处理REST音频完成: {audio_id}")
        
        return jsonify({
            'success': True,
            'recognized': recognized_text,
            'confidence': confidence,
            'response': response_text,
            'audioResponse': audio_response,
            'language': language
        })
    except Exception as e:
        logger.error(f"处理REST音频失败: {str(e)}")
        return jsonify({
            'success': False,
            'error': '处理音频失败'
        }), 500

# ===================== WebSocket 接口 =====================

@socketio.on('connect')
def handle_connect():
    """处理WebSocket连接"""
    sid = request.sid
    logger.info(f"客户端 {sid} 已连接")
    init_client_data(sid)
    
    # 发送服务器配置信息给客户端
    emit('server_info', {
        'server_version': '1.0.0',
        'max_audio_buffer': AUDIO_BUFFER_SIZE,
        'max_frames': MAX_FRAMES,
        'supported_formats': ['audio/wav', 'audio/webm', 'image/jpeg', 'image/png'],
        'supported_languages': list(TTS_VOICES.keys()),
        'tts_enabled': True
    })

@socketio.on('disconnect')
def handle_disconnect():
    """处理WebSocket断开连接"""
    sid = request.sid
    logger.info(f"客户端 {sid} 已断开连接")
    cleanup_client_data(sid)

@socketio.on('error')
def handle_error(error):
    """处理WebSocket错误"""
    sid = request.sid
    logger.error(f"客户端 {sid} 发生错误: {error}")
    emit('server_error', {'message': '服务器内部错误'})

@socketio.on('audio_data')
def handle_audio(data):
    """处理接收到的音频数据"""
    sid = request.sid
    try:
        if sid not in client_data:
            init_client_data(sid)
        
        # 更新最后活动时间
        client_data[sid]['last_activity'] = time.time()
        
        # 获取音频数据
        audio = data.get('audio')
        if not audio:
            logger.warning(f"客户端 {sid} 发送了空的音频数据")
            return
        
        # 处理ArrayBuffer数据
        if isinstance(audio, dict) and 'data' in audio:
            audio_bytes = base64.b64decode(audio['data'])
        else:
            # 直接使用二进制数据
            audio_bytes = audio
        
        # 更新设备信息
        if 'device_info' in data:
            client_data[sid]['device_info'].update(data['device_info'])
        
        # 累积音频数据
        with processing_lock:
            client_data[sid]['audio_chunks'].append(audio_bytes)
            client_data[sid]['audio_buffer_size'] += len(audio_bytes)
            
            # 如果积累了足够的音频数据，开始处理
            if (client_data[sid]['audio_buffer_size'] >= AUDIO_BUFFER_SIZE or 
                len(client_data[sid]['audio_chunks']) > 10) and not client_data[sid]['is_processing']:
                client_data[sid]['is_processing'] = True
                threading.Thread(target=process_client_data, args=(sid,)).start()
                
    except Exception as e:
        logger.error(f"处理音频数据出错: {str(e)}")
        emit('server_error', {'message': f'处理音频数据出错: {str(e)}'})

@socketio.on('video_frame')
def handle_video_frame(data):
    """处理接收到的视频帧"""
    sid = request.sid
    try:
        if sid not in client_data:
            init_client_data(sid)
        
        # 更新最后活动时间
        client_data[sid]['last_activity'] = time.time()
        
        # 获取视频帧数据
        frame = data.get('frame')
        timestamp = data.get('timestamp', time.time() * 1000)
        resolution = data.get('resolution', {'width': 640, 'height': 480})
        
        if not frame:
            logger.warning(f"客户端 {sid} 发送了空的视频帧")
            return
        
        # 存储视频帧信息
        with processing_lock:
            client_data[sid]['video_frames'].append({
                'dataUrl': frame,
                'timestamp': timestamp,
                'resolution': resolution
            })
            
    except Exception as e:
        logger.error(f"处理视频帧出错: {str(e)}")
        emit('server_error', {'message': f'处理视频帧出错: {str(e)}'})

@socketio.on('text_input')
def handle_text_input(data):
    """处理客户端文本输入"""
    sid = request.sid
    try:
        if sid not in client_data:
            init_client_data(sid)
        
        # 更新最后活动时间
        client_data[sid]['last_activity'] = time.time()
        
        # 获取文本数据
        text = data.get('text')
        if not text:
            logger.warning(f"客户端 {sid} 发送了空的文本")
            return
        
        logger.info(f"收到客户端 {sid} 文本输入: {text}")
        
        # 存储文本输入
        with processing_lock:
            client_data[sid]['text_inputs'].append({
                'text': text,
                'timestamp': data.get('timestamp', time.time() * 1000)
            })
            
            # 直接处理文本输入
            if not client_data[sid]['is_processing']:
                client_data[sid]['is_processing'] = True
                threading.Thread(target=process_text_input, args=(sid, text)).start()
            
    except Exception as e:
        logger.error(f"处理文本输入出错: {str(e)}")
        emit('server_error', {'message': f'处理文本输入出错: {str(e)}'})

@socketio.on('tts_settings')
def handle_tts_settings(data):
    """处理TTS设置更新"""
    sid = request.sid
    try:
        if sid not in client_data:
            init_client_data(sid)
        
        # 更新TTS设置
        enabled = data.get('enabled')
        if enabled is not None:
            client_data[sid]['tts_enabled'] = enabled
            logger.info(f"客户端 {sid} 设置TTS状态: {enabled}")
        
    except Exception as e:
        logger.error(f"处理TTS设置出错: {str(e)}")
        emit('server_error', {'message': f'处理TTS设置出错: {str(e)}'})

def process_text_input(sid, text):
    """处理文本输入并生成响应"""
    try:
        logger.info(f"开始处理客户端 {sid} 文本输入: {text}")
        
        # 获取视频帧数据作为上下文（如果有）
        context = ""
        with processing_lock:
            if sid in client_data and client_data[sid]['video_frames']:
                context = "用户环境：有视频画面，请根据用户问题进行回答"
        
        # 构建提示词
        prompt = text
        if context:
            prompt = f"{context}\n用户问题：{text}"
        
        # 调用LLM生成回复
        response_text = call_llm(prompt)
        
        # 检测语言
        language = detect_language(response_text)
        
        # 生成TTS音频
        audio_url = None
        with processing_lock:
            if sid in client_data and client_data[sid]['tts_enabled']:
                audio_url = text_to_speech(response_text, language)
        
        # 获取当前视频帧数量
        frame_count = 0
        with processing_lock:
            if sid in client_data:
                frame_count = len(client_data[sid]['video_frames'])
        
        # 发送LLM响应
        socketio.emit('llm_response', {
            'text': response_text,
            'audioUrl': audio_url,
            'processed_frames': frame_count,
            'timestamp': time.time() * 1000,
            'language': language
        }, room=sid)
        
        logger.info(f"客户端 {sid} 文本输入处理完成")
        
        with processing_lock:
            if sid in client_data:
                client_data[sid]['is_processing'] = False
        
    except Exception as e:
        logger.error(f"处理文本输入出错: {str(e)}")
        socketio.emit('server_error', {'message': f'处理文本输入出错: {str(e)}'}, room=sid)
        
        with processing_lock:
            if sid in client_data:
                client_data[sid]['is_processing'] = False

def process_client_data(sid):
    """处理客户端数据并生成响应"""
    try:
        logger.info(f"开始处理客户端 {sid} 音频数据")
        
        with processing_lock:
            if sid not in client_data:
                logger.warning(f"客户端 {sid} 数据不存在，可能已断开连接")
                return
            
            # 合并音频块
            audio_chunks = client_data[sid]['audio_chunks']
            if not audio_chunks:
                logger.warning(f"客户端 {sid} 没有音频数据")
                return
            
            merged_audio = b''.join(audio_chunks)
            
            # 清空已处理的音频数据
            client_data[sid]['audio_chunks'] = []
            client_data[sid]['audio_buffer_size'] = 0
            
            # 获取视频帧数量
            frame_count = len(client_data[sid]['video_frames'])
            
            # 获取设备信息
            device_info = client_data[sid]['device_info']
            
            # 获取TTS设置
            tts_enabled = client_data[sid].get('tts_enabled', True)
            
            # 标记处理中
            client_data[sid]['is_processing'] = True
        
        # 保存音频为临时文件
        audio_file = save_audio_to_file(
            merged_audio, 
            sample_rate=device_info.get('sample_rate', SAMPLE_RATE),
            channels=device_info.get('channels', 1)
        )
        
        # 调用ASR进行语音识别
        if audio_file:
            asr_text, confidence = speech_to_text(audio_file)
        else:
            # 如果音频保存失败，使用默认文本
            asr_text = "请帮我分析一下当前的环境，我需要知道周围有什么。"
            confidence = 0.5
        
        # 发送ASR结果给客户端
        socketio.emit('asr_result', {
            'text': asr_text,
            'confidence': confidence,
            'audio_duration': len(merged_audio) / (device_info.get('sample_rate', SAMPLE_RATE) * 2)  # 假设16位音频
        }, room=sid)
        
        # 构建提示词，加入视频信息作为上下文
        context = ""
        if frame_count > 0:
            context = "用户环境：有视频画面，请根据用户问题进行回答"
        
        prompt = asr_text
        if context:
            prompt = f"{context}\n用户问题：{asr_text}"
        
        # 调用LLM生成回复
        response_text = call_llm(prompt)
        
        # 生成TTS音频
        audio_url = None
        if tts_enabled:
            language = detect_language(response_text)
            audio_url = text_to_speech(response_text, language)
        
        # 发送LLM响应
        socketio.emit('llm_response', {
            'text': response_text,
            'audioUrl': audio_url,
            'processed_frames': frame_count,
            'timestamp': time.time() * 1000,
            'language': detect_language(response_text)
        }, room=sid)
        
        logger.info(f"客户端 {sid} 数据处理完成")
        
        with processing_lock:
            if sid in client_data:
                client_data[sid]['is_processing'] = False
        
    except Exception as e:
        logger.error(f"处理客户端数据出错: {str(e)}")
        socketio.emit('server_error', {'message': f'处理客户端数据出错: {str(e)}'}, room=sid)
        
        with processing_lock:
            if sid in client_data:
                client_data[sid]['is_processing'] = False

def cleanup_inactive_clients():
    """清理不活跃的客户端"""
    while True:
        try:
            current_time = time.time()
            inactive_sids = []
            
            with processing_lock:
                for sid in list(client_data.keys()):
                    last_activity = client_data[sid]['last_activity']
                    if current_time - last_activity > 60:  # 60秒无活动则视为不活跃
                        inactive_sids.append(sid)
            
            # 清理不活跃的客户端
            for sid in inactive_sids:
                logger.info(f"清理不活跃客户端 {sid}")
                cleanup_client_data(sid)
                
        except Exception as e:
            logger.error(f"清理不活跃客户端出错: {str(e)}")
        
        # 每30秒检查一次
        time.sleep(30)

def cleanup_rest_sessions():
    """定期清理过期REST会话"""
    while True:
        try:
            current_time = time.time()
            expired_sessions = []
            
            for session_id, session_data in list(rest_sessions.items()):
                # 清理超过30分钟未活动的会话
                if current_time - session_data['last_activity'] > 1800:
                    expired_sessions.append(session_id)
            
            # 删除过期会话
            for session_id in expired_sessions:
                del rest_sessions[session_id]
                logger.info(f"清理过期REST会话: {session_id}")
                
        except Exception as e:
            logger.error(f"清理过期REST会话出错: {str(e)}")
        
        # 每5分钟检查一次
        time.sleep(300)

# 清理临时文件
def cleanup_temp_files():
    """定期清理临时文件"""
    while True:
        try:
            current_time = time.time()
            # 清理超过2小时的临时文件
            for file_path in TEMP_DIR.glob("*.*"):
                if file_path.is_file():
                    file_age = current_time - file_path.stat().st_mtime
                    if file_age > 7200:  # 2小时
                        logger.info(f"清理临时文件: {file_path}")
                        file_path.unlink()
        except Exception as e:
            logger.error(f"清理临时文件出错: {str(e)}")
        
        # 每10分钟检查一次
        time.sleep(600)

if __name__ == '__main__':
    import argparse
    
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='场景语音对话后端服务')
    parser.add_argument('--port', type=int, default=SERVER_PORT, help='服务器端口')
    parser.add_argument('--llm-model', type=str, default="./QWen/Qwen2.5-0.5B-Instruct", help='LLM模型路径')
    parser.add_argument('--asr-model', type=str, default="./QWen/pretrained_models/SenseVoiceSmall", help='ASR模型路径')
    parser.add_argument('--no-llm', action='store_true', help='不加载LLM模型')
    parser.add_argument('--no-asr', action='store_true', help='不加载ASR模型')
    parser.add_argument('--no-tts', action='store_true', help='不使用TTS功能')
    parser.add_argument('--debug', action='store_true', help='启用调试模式')
    
    args = parser.parse_args()
    
    # 根据命令行参数更新配置
    SERVER_PORT = args.port
    
    # 如果指定了不加载模型，则覆盖默认设置
    if args.no_llm:
        USE_LLM = False
        logger.info("根据命令行参数，不加载LLM模型")
    
    if args.no_asr:
        USE_ASR = False
        logger.info("根据命令行参数，不加载ASR模型")
    
    if args.no_tts:
        HAS_EDGE_TTS = False
        logger.info("根据命令行参数，禁用TTS功能")
    
    # 启动清理线程
    cleanup_thread = threading.Thread(target=cleanup_inactive_clients)
    cleanup_thread.daemon = True
    cleanup_thread.start()
    
    # 启动REST会话清理线程
    rest_cleanup_thread = threading.Thread(target=cleanup_rest_sessions)
    rest_cleanup_thread.daemon = True
    rest_cleanup_thread.start()
    
    # 启动清理临时文件的线程
    temp_cleanup_thread = threading.Thread(target=cleanup_temp_files)
    temp_cleanup_thread.daemon = True
    temp_cleanup_thread.start()
    
    # 启动服务器
    logger.info(f"启动服务器在端口 {SERVER_PORT}")
    socketio.run(app, host='0.0.0.0', port=SERVER_PORT, debug=args.debug)
