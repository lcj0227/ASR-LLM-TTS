"""
实时对话WebSocket处理器
"""
import json
import base64
import wave
import uuid
from pathlib import Path
from typing import Dict, Optional
from datetime import datetime
import logging
from fastapi import WebSocket, WebSocketDisconnect
from app.config import settings
from app.services.asr_service import asr_service
from app.services.llm_service import llm_service
from app.services.tts_service import tts_service

logger = logging.getLogger(__name__)


class ChatConnectionManager:
    """WebSocket连接管理器"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.client_data: Dict[str, dict] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        """接受WebSocket连接"""
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.client_data[client_id] = {
            "connected_at": datetime.now(),
            "audio_chunks": [],
            "last_activity": datetime.now(),
        }
        logger.info(f"客户端 {client_id} 已连接")
    
    def disconnect(self, client_id: str):
        """断开WebSocket连接"""
        if client_id in self.active_connections:
            del self.active_connections[client_id]
        if client_id in self.client_data:
            del self.client_data[client_id]
        logger.info(f"客户端 {client_id} 已断开")
    
    async def send_message(self, client_id: str, message: dict):
        """发送消息给客户端"""
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(message)
            except Exception as e:
                logger.error(f"发送消息失败 {client_id}: {e}")
    
    async def broadcast(self, message: dict):
        """广播消息给所有客户端"""
        for client_id in list(self.active_connections.keys()):
            await self.send_message(client_id, message)


# 创建全局连接管理器
manager = ChatConnectionManager()


async def handle_audio_chunk(client_id: str, audio_data: bytes):
    """处理音频数据块"""
    try:
        # 保存音频块
        if client_id not in manager.client_data:
            return
        
        manager.client_data[client_id]["audio_chunks"].append(audio_data)
        manager.client_data[client_id]["last_activity"] = datetime.now()
        
        # 当积累足够音频时进行处理（例如每2秒处理一次）
        # 这里简化处理，实际应该根据时间或数据量触发
        
    except Exception as e:
        logger.error(f"处理音频块失败 {client_id}: {e}")


async def process_audio_and_respond(client_id: str):
    """处理音频并生成响应"""
    try:
        if client_id not in manager.client_data:
            return
        
        data = manager.client_data[client_id]
        audio_chunks = data.get("audio_chunks", [])
        
        if not audio_chunks:
            return
        
        # 合并音频数据
        merged_audio = b''.join(audio_chunks)
        
        # 保存为临时文件
        temp_audio_path = settings.TEMP_DIR / f"audio_{client_id}_{uuid.uuid4().hex[:8]}.wav"
        temp_audio_path.parent.mkdir(parents=True, exist_ok=True)
        
        with wave.open(str(temp_audio_path), 'wb') as wf:
            wf.setnchannels(1)  # 单声道
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(16000)  # 16kHz
            wf.writeframes(merged_audio)
        
        # 清空音频块
        data["audio_chunks"] = []
        
        # ASR识别
        recognized_text, confidence = asr_service.recognize(temp_audio_path)
        
        # 发送ASR结果
        await manager.send_message(client_id, {
            "type": "asr_result",
            "text": recognized_text,
            "confidence": confidence
        })
        
        # LLM生成回复
        response_text = llm_service.generate(
            prompt=recognized_text,
            system_prompt="你是一个友好的数字人助手，名字叫小千。"
        )
        
        # TTS生成语音
        tts_output_path = tts_service.text_to_speech(response_text)
        tts_url = f"/outputs/{tts_output_path.name}"
        
        # 发送LLM回复
        await manager.send_message(client_id, {
            "type": "llm_response",
            "text": response_text,
            "audio_url": tts_url
        })
        
        # 清理临时文件
        if temp_audio_path.exists():
            temp_audio_path.unlink()
        
    except Exception as e:
        logger.error(f"处理音频并响应失败 {client_id}: {e}")
        await manager.send_message(client_id, {
            "type": "error",
            "message": f"处理失败: {str(e)}"
        })


async def websocket_chat_endpoint(websocket: WebSocket):
    """WebSocket聊天端点"""
    client_id = uuid.uuid4().hex[:16]
    
    try:
        await manager.connect(websocket, client_id)
        
        # 发送连接成功消息
        await manager.send_message(client_id, {
            "type": "connected",
            "client_id": client_id,
            "message": "连接成功"
        })
        
        while True:
            # 接收消息
            data = await websocket.receive()
            
            if "text" in data:
                # 文本消息
                try:
                    message = json.loads(data["text"])
                    message_type = message.get("type")
                    
                    if message_type == "audio":
                        # 音频数据（base64编码）
                        audio_base64 = message.get("data")
                        if audio_base64:
                            audio_bytes = base64.b64decode(audio_base64)
                            await handle_audio_chunk(client_id, audio_bytes)
                    
                    elif message_type == "process":
                        # 请求处理音频
                        await process_audio_and_respond(client_id)
                    
                    elif message_type == "text":
                        # 文本输入
                        text = message.get("text", "")
                        if text:
                            # 直接使用文本生成回复
                            response_text = llm_service.generate(
                                prompt=text,
                                system_prompt="你是一个友好的数字人助手，名字叫小千。"
                            )
                            tts_output_path = tts_service.text_to_speech(response_text)
                            tts_url = f"/outputs/{tts_output_path.name}"
                            
                            await manager.send_message(client_id, {
                                "type": "llm_response",
                                "text": response_text,
                                "audio_url": tts_url
                            })
                    
                except json.JSONDecodeError:
                    await manager.send_message(client_id, {
                        "type": "error",
                        "message": "无效的JSON格式"
                    })
            
            elif "bytes" in data:
                # 二进制音频数据
                audio_bytes = data["bytes"]
                await handle_audio_chunk(client_id, audio_bytes)
    
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"客户端 {client_id} 断开连接")
    except Exception as e:
        logger.error(f"WebSocket错误 {client_id}: {e}")
        manager.disconnect(client_id)

