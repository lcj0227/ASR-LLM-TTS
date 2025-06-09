#!/usr/bin/env python3
"""
文本转语音API服务
基于EdgeTTS提供文本转语音功能
"""

import os
import asyncio
import base64
import json
import logging
import tempfile
from typing import Dict, Any
from functools import wraps

import edge_tts
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})  # 明确指定允许所有来源访问/api/路径下的资源

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 支持的语音列表
AVAILABLE_VOICES = [
    { "id": "zh-CN-XiaoxiaoNeural", "name": "中文 - 晓晓 (女声)", "language": "中文" },
    { "id": "zh-CN-YunxiNeural", "name": "中文 - 云希 (男声)", "language": "中文" },
    { "id": "zh-CN-YunjianNeural", "name": "中文 - 云健 (男声)", "language": "中文" },
    { "id": "zh-HK-HiuGaaiNeural", "name": "粤语 - 晓佳 (女声)", "language": "粤语" },
    { "id": "en-US-AriaNeural", "name": "英语 - Aria (女声)", "language": "英语" },
    { "id": "en-US-GuyNeural", "name": "英语 - Guy (男声)", "language": "英语" },
    { "id": "ja-JP-NanamiNeural", "name": "日语 - Nanami (女声)", "language": "日语" },
    { "id": "ko-KR-SunHiNeural", "name": "韩语 - SunHi (女声)", "language": "韩语" }
]

# 创建一个事件循环
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)

# 获取可用的所有EdgeTTS语音
async def get_available_edge_tts_voices():
    try:
        return await edge_tts.list_voices()
    except Exception as e:
        logger.error(f"获取EdgeTTS语音列表失败: {e}")
        return []

# 初始化时验证语音列表
def validate_voices():
    try:
        voices = loop.run_until_complete(get_available_edge_tts_voices())
        if voices:
            valid_voice_ids = [voice["ShortName"] for voice in voices]
            logger.info(f"有效的EdgeTTS语音IDs: {valid_voice_ids[:5]}... (共{len(valid_voice_ids)}个)")
            # 检查我们配置的语音是否都有效
            for voice in AVAILABLE_VOICES:
                if voice["id"] not in valid_voice_ids:
                    logger.warning(f"警告: 配置的语音ID '{voice['id']}' 在EdgeTTS中不可用")
    except Exception as e:
        logger.error(f"验证语音列表失败: {e}")

# 应用启动时验证语音
validate_voices()

def async_route(f):
    """装饰器：将异步函数包装为Flask可处理的同步函数"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        # 使用已有的事件循环而不是创建新的
        return loop.run_until_complete(f(*args, **kwargs))
    return wrapper

@app.route('/api/voices', methods=['GET'])
def get_voices():
    """获取支持的语音列表"""
    response = jsonify({
        'success': True,
        'voices': AVAILABLE_VOICES
    })
    # 显式添加CORS头，以确保跨域请求成功
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@app.route('/api/tts', methods=['POST'])
@async_route
async def text_to_speech():
    """文本转语音API"""
    temp_filename = None
    try:
        data = request.json
        text = data.get('text', '')
        voice = data.get('voice', 'zh-CN-XiaoxiaoNeural')
        speed = data.get('speed', 1.0)
        pitch = data.get('pitch', 1.0)
        
        if not text:
            return jsonify({
                'success': False,
                'error': '文本不能为空'
            }), 400
        
        # 调整速度和音高 - 修复格式问题
        if speed == 1.0:
            # 如果速度是默认值1.0，则不设置rate参数
            rate = None
        else:
            # 确保rate不是0%
            percentage = int((speed - 1) * 100)
            if percentage == 0:
                percentage = 1 if speed > 1 else -1  # 避免0%
            rate = f"+{percentage}%" if percentage > 0 else f"{percentage}%"
        
        if pitch == 1.0:
            # 如果音高是默认值1.0，则不设置pitch参数
            pitch_adjustment = None
        else:
            # 音高调整，避免0Hz
            pitch_value = int((pitch - 1) * 50)
            if pitch_value == 0:
                pitch_value = 1 if pitch > 1 else -1  # 避免0Hz
            pitch_adjustment = f"+{pitch_value}Hz" if pitch_value > 0 else f"{pitch_value}Hz"
        
        logger.info(f"生成语音: 文本='{text[:30]}...', 语音={voice}, 速度={rate or 'default'}, 音高={pitch_adjustment or 'default'}")
        
        # 验证语音是否存在
        voices = await get_available_edge_tts_voices()
        valid_voice_ids = [v["ShortName"] for v in voices]
        if voice not in valid_voice_ids:
            logger.error(f"无效的语音ID: {voice}")
            return jsonify({
                'success': False,
                'error': f'无效的语音ID: {voice}，可用的语音: {valid_voice_ids[:5]}...'
            }), 400
        
        # 创建临时文件
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_file:
            temp_filename = temp_file.name
        
        try:
            # 调用EdgeTTS生成语音，根据参数是否为None决定是否传入
            communicate_kwargs = {"text": text, "voice": voice}
            if rate is not None:
                communicate_kwargs["rate"] = rate
            if pitch_adjustment is not None:
                communicate_kwargs["pitch"] = pitch_adjustment
                
            logger.info(f"EdgeTTS参数: {communicate_kwargs}")
            communicate = edge_tts.Communicate(**communicate_kwargs)
            await communicate.save(temp_filename)
            
            # 检查生成的文件是否存在且大小不为0
            if not os.path.exists(temp_filename) or os.path.getsize(temp_filename) == 0:
                raise Exception("生成的音频文件为空或不存在")
            
            # 读取生成的音频文件并转换为base64
            with open(temp_filename, 'rb') as audio_file:
                audio_data = audio_file.read()
                if len(audio_data) == 0:
                    raise Exception("生成的音频文件内容为空")
                audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            logger.info(f"语音生成成功: 大小={len(audio_data)}字节")
            
            response = jsonify({
                'success': True,
                'audioData': f'data:audio/mp3;base64,{audio_base64}'
            })
            # 显式添加CORS头
            response.headers.add('Access-Control-Allow-Origin', '*')
            return response
        finally:
            # 确保无论成功与否都删除临时文件
            try:
                if temp_filename and os.path.exists(temp_filename):
                    os.remove(temp_filename)
            except Exception as e:
                logger.warning(f"删除临时文件失败: {e}")
    
    except Exception as e:
        logger.error(f"文本转语音出错: {str(e)}", exc_info=True)  # 添加异常详情
        # 确保临时文件被删除
        if temp_filename and os.path.exists(temp_filename):
            try:
                os.remove(temp_filename)
            except:
                pass
                
        response = jsonify({
            'success': False,
            'error': f'处理失败: {str(e)}'
        }), 500
        if isinstance(response, tuple):
            response[0].headers.add('Access-Control-Allow-Origin', '*')
        else:
            response.headers.add('Access-Control-Allow-Origin', '*')
        return response

# 添加OPTIONS请求处理，支持预检请求
@app.route('/api/tts', methods=['OPTIONS'])
@app.route('/api/voices', methods=['OPTIONS'])
def handle_options():
    response = jsonify({})
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return response

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True) 