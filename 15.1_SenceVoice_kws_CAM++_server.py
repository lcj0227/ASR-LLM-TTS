from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import tempfile
import time
import threading
import wave
import json
import numpy as np
import base64
import logging
import argparse
from pypinyin import pinyin, Style
import re

# 解析命令行参数
parser = argparse.ArgumentParser(description='小千语音助手服务器')
parser.add_argument('--port', type=int, default=5000, help='服务器端口 (默认: 5000)')
args = parser.parse_args()

# 设置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 创建Flask应用
app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 全局变量声明
global set_KWS, flag_KWS_used, flag_sv_used, thred_sv
set_KWS = "le di le di"  # 默认唤醒词
flag_KWS_used = 0        # 启用唤醒词
flag_sv_used = 0         # 禁用声纹识别
thred_sv = 0.35          # 声纹识别阈值

# 导入15.1_SenceVoice_kws_CAM++.py中的关键功能
try:
    from funasr import AutoModel
    from modelscope.pipelines import pipeline
    import edge_tts
    import asyncio
    import webrtcvad
    from transformers import AutoModelForCausalLM, AutoTokenizer
    import langid
    
    # 导入音频处理库
    try:
        from pydub import AudioSegment
        PYDUB_AVAILABLE = True
    except ImportError:
        logger.warning("未安装pydub库，无法进行音频格式转换。建议运行: pip install pydub")
        PYDUB_AVAILABLE = False
    
    # --- 配置路径 ---
    OUTPUT_DIR = "./output"
    SV_ENROLL_DIR = './SpeakerVerification_DIR/enroll_wav/'
    TMP_AUDIO_DIR = "./tmp_audio"
    
    # 确保输出目录存在
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(SV_ENROLL_DIR, exist_ok=True)
    os.makedirs(TMP_AUDIO_DIR, exist_ok=True)

    # --- 参数设置 ---
    AUDIO_RATE = 16000        # 音频采样率
    AUDIO_CHANNELS = 1        # 单声道
    VAD_MODE = 3              # VAD 模式 (0-3, 数字越大越敏感)
    
    # 初始化 WebRTC VAD
    vad = webrtcvad.Vad()
    vad.set_mode(VAD_MODE)
    
    # 加载模型
    logger.info("正在加载模型...")
    
    # SenceVoice 语音识别模型
    model_dir = "iic/SenseVoiceSmall"
    model_senceVoice = AutoModel(model=model_dir, trust_remote_code=True)
    
    # CAM++声纹识别模型
    sv_pipeline = pipeline(
        task='speaker-verification',
        model='damo/speech_campplus_sv_zh-cn_16k-common',
        model_revision='v1.0.0'
    )
    
    # QWen2.5大语言模型
    model_name = "Qwen/Qwen2.5-1.5B-Instruct"
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype="auto",
        device_map="auto"
    )
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    
    # 初始化聊天记忆
    class ChatMemory:
        def __init__(self, max_length=2048):
            self.history = []
            self.max_length = max_length  # 最大输入长度

        def add_to_history(self, user_input, model_response):
            self.history.append(f"User: {user_input}")
            self.history.append(f"system: {model_response}")

        def get_context(self):
            context = "\n".join(self.history)
            if len(context) > self.max_length:
                context = context[-self.max_length :]
            return context
            
        def clear(self):
            self.history = []
    
    memory = ChatMemory(max_length=512)
    
    # 语音种类映射表
    language_speaker = {
        "ja" : "ja-JP-NanamiNeural",
        "fr" : "fr-FR-DeniseNeural",
        "es" : "ca-ES-JoanaNeural",
        "de" : "de-DE-KatjaNeural",
        "zh" : "zh-CN-XiaoyiNeural",
        "en" : "en-US-AnaNeural",
    }
    
    # 提取中文并转换为拼音
    def extract_chinese_and_convert_to_pinyin(input_string):
        # 使用正则表达式提取所有汉字
        chinese_characters = re.findall(r'[\u4e00-\u9fa5]', input_string)
        # 将汉字列表合并为字符串
        chinese_text = ''.join(chinese_characters)
        
        # 转换为拼音
        pinyin_result = pinyin(chinese_text, style=Style.NORMAL)
        # 将拼音列表拼接为字符串
        pinyin_text = ' '.join([item[0] for item in pinyin_result])
        
        return pinyin_text
    
    # TTS转换并保存为MP3
    async def text_to_speech(TEXT, VOICE, OUTPUT_FILE):
        communicate = edge_tts.Communicate(TEXT, VOICE)
        await communicate.save(OUTPUT_FILE)
    
    # 检查声纹注册状态
    def check_enrollment_status():
        if os.path.exists(f"{SV_ENROLL_DIR}/enroll_0.wav"):
            return True
        return False
    
    # 检测是否为空文件夹
    def is_folder_empty(folder_path):
        entries = os.listdir(folder_path)
        for entry in entries:
            full_path = os.path.join(folder_path, entry)
            if os.path.isfile(full_path):
                return False
        return True
    
    # 转换音频格式为WAV
    def convert_to_wav(input_file, output_file):
        """
        将任何格式的音频文件转换为16kHz采样率的单声道WAV文件
        """
        if not PYDUB_AVAILABLE:
            raise ImportError("未安装pydub库，无法进行音频格式转换")
        
        try:
            # 尝试直接读取
            audio = AudioSegment.from_file(input_file)
            # 转换为16kHz采样率和单声道
            audio = audio.set_frame_rate(16000).set_channels(1)
            # 导出为WAV格式
            audio.export(output_file, format="wav")
            logger.info(f"成功转换音频格式: {input_file} -> {output_file}")
            return True
        except Exception as e:
            logger.error(f"音频格式转换失败: {str(e)}")
            return False
    
    # 进行推理
    def inference(audio_file, use_kws=True, use_sv=True, kws_text=None):
        result = {
            "status": "",
            "message": "",
            "audio_url": None,
            "user_message": None
        }
        
        # 检查声纹注册状态
        if use_sv and is_folder_empty(SV_ENROLL_DIR):
            result["status"] = "sv_enroll_required"
            result["message"] = "无声纹注册文件！请先注册声纹，需大于三秒哦~"
            return result
        
        # SenceVoice 语音识别
        res = model_senceVoice.generate(
            input=audio_file,
            cache={},
            language="auto",
            use_itn=False,
        )
        
        # 获取用户输入文本
        prompt = res[0]['text'].split(">")[-1]
        result["user_message"] = prompt
        
        # 如果启用唤醒词检测
        if use_kws:
            prompt_pinyin = extract_chinese_and_convert_to_pinyin(prompt)
            logger.info(f"用户输入: {prompt}, 拼音: {prompt_pinyin}")
            
            # 检查唤醒词
            global set_KWS
            if kws_text and kws_text != set_KWS:
                set_KWS = kws_text
            
            # 将唤醒词转换为拼音
            kws_pinyin = extract_chinese_and_convert_to_pinyin(set_KWS)
            
            # 判断是否包含唤醒词
            if kws_pinyin not in prompt_pinyin:
                result["status"] = "kws_failed"
                result["message"] = "很抱歉，唤醒词错误，请说出正确的唤醒词哦"
                logger.info(f"唤醒词验证失败: 预期唤醒词拼音={kws_pinyin}, 实际拼音={prompt_pinyin}")
                return result
        
        # 如果启用声纹识别
        if use_sv and not is_folder_empty(SV_ENROLL_DIR):
            sv_score = sv_pipeline([os.path.join(SV_ENROLL_DIR, "enroll_0.wav"), audio_file], thr=thred_sv)
            logger.info(f"声纹验证结果: {sv_score}")
            
            sv_result = sv_score['text']
            if sv_result != "yes":
                result["status"] = "sv_failed"
                result["message"] = "很抱歉，声纹验证失败，我无法为您服务"
                return result
        
        # 处理通过了唤醒词和声纹验证的情况
        
        # 读取历史对话
        context = memory.get_context()
        prompt_tmp = prompt
        prompt_full = f"{context}\nUser:{prompt_tmp}\n"
        
        logger.info(f"历史记录: {context}")
        logger.info(f"完整提示: {prompt_full}")
        
        # 大模型推理
        messages = [
            {"role": "system", "content": "你叫小千，是一个18岁的女大学生，性格活泼开朗，说话俏皮简洁，回答问题不会超过50字。"},
            {"role": "user", "content": prompt_full},
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
        logger.info(f"模型回复: {output_text}")
        
        # 更新记忆库
        memory.add_to_history(prompt_tmp, output_text)
        
        # 语种识别
        language, confidence = langid.classify(output_text)
        
        # 选择适当的语音
        if language not in language_speaker.keys():
            used_speaker = "zh-CN-XiaoyiNeural"
        else:
            used_speaker = language_speaker[language]
            logger.info(f"检测到语种: {language}, 使用音色: {used_speaker}")
        
        # 生成TTS音频
        audio_filename = f"response_{int(time.time())}.mp3"
        audio_path = os.path.join(TMP_AUDIO_DIR, audio_filename)
        
        asyncio.run(text_to_speech(output_text, used_speaker, audio_path))
        
        # 返回成功结果
        result["status"] = "success"
        result["message"] = output_text
        result["audio_url"] = f"/audio/{audio_filename}"
        
        return result
        
    logger.info("模型加载完成")
    MODELS_LOADED = True
    
except Exception as e:
    logger.error(f"模型加载失败: {str(e)}")
    MODELS_LOADED = False


# API路由
@app.route('/process_audio', methods=['POST'])
def process_audio():
    if not MODELS_LOADED:
        return jsonify({
            "status": "error",
            "message": "模型尚未加载完成，请稍后重试"
        }), 503
    
    try:
        # 获取参数
        kws_enabled = request.form.get('kws_enabled', '1') == '1'
        sv_enabled = request.form.get('sv_enabled', '0') == '1'  # 默认禁用声纹验证
        kws_text = request.form.get('kws_text', set_KWS)
        
        # 保存音频文件
        audio_file = request.files.get('audio')
        if not audio_file:
            return jsonify({
                "status": "error",
                "message": "未接收到音频文件"
            }), 400
        
        # 时间戳，用于生成唯一文件名
        timestamp = int(time.time())
        
        # 保存到临时文件
        temp_input_path = os.path.join(TMP_AUDIO_DIR, f"input_raw_{timestamp}")
        wav_path = os.path.join(TMP_AUDIO_DIR, f"input_{timestamp}.wav")
        
        try:
            # 直接保存上传的文件
            audio_file.save(temp_input_path)
            
            # 验证文件是否为有效的WAV文件
            is_valid_wav = False
            try:
                with wave.open(temp_input_path, 'rb') as wav_file:
                    # 检查是否符合要求 (16kHz, 单声道)
                    channels = wav_file.getnchannels()
                    sample_rate = wav_file.getframerate()
                    logger.info(f"音频文件信息: 声道数={channels}, 采样率={sample_rate}")
                    
                    # 如果采样率不是16kHz或不是单声道，需要转换
                    if sample_rate != 16000 or channels != 1:
                        logger.info(f"音频格式不符合要求，尝试转换: 采样率={sample_rate}Hz, 声道数={channels}")
                        if PYDUB_AVAILABLE:
                            convert_to_wav(temp_input_path, wav_path)
                        else:
                            return jsonify({
                                "status": "error",
                                "message": f"音频格式不符合要求 (需要16kHz采样率，单声道WAV)，且系统未安装pydub无法转换"
                            }), 400
                    else:
                        # 格式正确，只需要重命名
                        import shutil
                        shutil.copy(temp_input_path, wav_path)
                    is_valid_wav = True
            except Exception as wave_error:
                logger.warning(f"非WAV格式或无效的WAV文件: {str(wave_error)}")
                
                # 尝试使用pydub转换
                if PYDUB_AVAILABLE:
                    logger.info("尝试使用pydub转换音频格式")
                    if convert_to_wav(temp_input_path, wav_path):
                        is_valid_wav = True
                    else:
                        return jsonify({
                            "status": "error",
                            "message": f"无法识别的音频格式或损坏的音频文件"
                        }), 400
                else:
                    return jsonify({
                        "status": "error",
                        "message": f"无效的音频格式，请上传WAV格式文件，或安装pydub以支持其他格式"
                    }), 400
            
            if not is_valid_wav:
                return jsonify({
                    "status": "error",
                    "message": "处理音频文件失败，无法识别的格式"
                }), 400
                
            # 进行推理
            result = inference(wav_path, use_kws=kws_enabled, use_sv=sv_enabled, kws_text=kws_text)
            return jsonify(result)
            
        except Exception as file_error:
            logger.error(f"保存或处理音频文件失败: {str(file_error)}")
            return jsonify({
                "status": "error",
                "message": f"保存或处理音频文件失败: {str(file_error)}"
            }), 500
        finally:
            # 清理临时文件
            try:
                if os.path.exists(temp_input_path):
                    os.remove(temp_input_path)
            except:
                pass
    
    except Exception as e:
        logger.error(f"处理音频请求失败: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"处理请求失败: {str(e)}"
        }), 500


@app.route('/enroll_speaker', methods=['POST'])
def enroll_speaker():
    if not MODELS_LOADED:
        return jsonify({
            "status": "error",
            "message": "模型尚未加载完成，请稍后重试"
        }), 503
    
    try:
        # 获取音频文件
        audio_file = request.files.get('audio')
        if not audio_file:
            return jsonify({
                "status": "error",
                "message": "未接收到音频文件"
            }), 400
        
        # 时间戳，用于生成唯一文件名
        timestamp = int(time.time())
        
        # 保存到临时文件先进行验证
        temp_input_path = os.path.join(TMP_AUDIO_DIR, f"enroll_raw_{timestamp}")
        temp_wav_path = os.path.join(TMP_AUDIO_DIR, f"enroll_temp_{timestamp}.wav")
        final_wav_path = os.path.join(SV_ENROLL_DIR, "enroll_0.wav")
        
        try:
            # 保存上传的文件
            audio_file.save(temp_input_path)
            
            # 验证文件是否为有效的WAV文件
            is_valid_wav = False
            try:
                with wave.open(temp_input_path, 'rb') as wav_file:
                    # 检查是否符合要求 (16kHz, 单声道)
                    channels = wav_file.getnchannels()
                    sample_rate = wav_file.getframerate()
                    logger.info(f"声纹注册音频文件信息: 声道数={channels}, 采样率={sample_rate}")
                    
                    # 检查时长是否大于3秒
                    frames = wav_file.getnframes()
                    duration = frames / float(sample_rate)
                    if duration < 3.0:
                        return jsonify({
                            "status": "error",
                            "message": f"声纹注册音频时长需大于3秒，当前时长: {duration:.2f}秒"
                        }), 400
                    
                    # 如果采样率不是16kHz或不是单声道，需要转换
                    if sample_rate != 16000 or channels != 1:
                        logger.info(f"音频格式不符合要求，尝试转换: 采样率={sample_rate}Hz, 声道数={channels}")
                        if PYDUB_AVAILABLE:
                            convert_to_wav(temp_input_path, temp_wav_path)
                        else:
                            return jsonify({
                                "status": "error",
                                "message": f"音频格式不符合要求 (需要16kHz采样率，单声道WAV)，且系统未安装pydub无法转换"
                            }), 400
                    else:
                        # 格式正确，只需要重命名
                        import shutil
                        shutil.copy(temp_input_path, temp_wav_path)
                    is_valid_wav = True
            except Exception as wave_error:
                logger.warning(f"非WAV格式或无效的WAV文件: {str(wave_error)}")
                
                # 尝试使用pydub转换
                if PYDUB_AVAILABLE:
                    logger.info("尝试使用pydub转换音频格式")
                    if convert_to_wav(temp_input_path, temp_wav_path):
                        is_valid_wav = True
                        
                        # 需要再次检查时长
                        with wave.open(temp_wav_path, 'rb') as wav_file:
                            frames = wav_file.getnframes()
                            sample_rate = wav_file.getframerate()
                            duration = frames / float(sample_rate)
                            if duration < 3.0:
                                return jsonify({
                                    "status": "error",
                                    "message": f"声纹注册音频时长需大于3秒，当前时长: {duration:.2f}秒"
                                }), 400
                    else:
                        return jsonify({
                            "status": "error",
                            "message": f"无法识别的音频格式或损坏的音频文件"
                        }), 400
                else:
                    return jsonify({
                        "status": "error",
                        "message": f"无效的音频格式，请上传WAV格式文件，或安装pydub以支持其他格式"
                    }), 400
            
            if not is_valid_wav:
                return jsonify({
                    "status": "error",
                    "message": "处理音频文件失败，无法识别的格式"
                }), 400
                
            # 验证通过，保存到声纹注册目录
            os.makedirs(SV_ENROLL_DIR, exist_ok=True)
            import shutil
            shutil.copy(temp_wav_path, final_wav_path)
            
            return jsonify({
                "status": "success",
                "message": "声纹注册成功",
                "enrolled": True
            })
        
        except Exception as file_error:
            logger.error(f"声纹注册失败: 保存或处理音频文件失败: {str(file_error)}")
            return jsonify({
                "status": "error",
                "message": f"保存或处理音频文件失败: {str(file_error)}"
            }), 500
            
        finally:
            # 清理临时文件
            for path in [temp_input_path, temp_wav_path]:
                if os.path.exists(path):
                    try:
                        os.remove(path)
                    except:
                        pass
    
    except Exception as e:
        logger.error(f"声纹注册失败: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"声纹注册失败: {str(e)}"
        }), 500


@app.route('/update_keyword', methods=['POST'])
def update_keyword():
    try:
        # 获取新唤醒词
        keyword = request.form.get('keyword')
        if not keyword:
            return jsonify({
                "status": "error",
                "message": "未提供唤醒词"
            }), 400
        
        # 更新唤醒词
        global set_KWS
        set_KWS = keyword
        
        return jsonify({
            "status": "success",
            "message": "唤醒词更新成功",
            "keyword": set_KWS
        })
    
    except Exception as e:
        logger.error(f"更新唤醒词失败: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"更新唤醒词失败: {str(e)}"
        }), 500


@app.route('/check_enrollment', methods=['GET'])
def check_enrollment():
    try:
        enrolled = check_enrollment_status()
        
        return jsonify({
            "status": "success",
            "enrolled": enrolled
        })
    
    except Exception as e:
        logger.error(f"检查声纹注册状态失败: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"检查声纹注册状态失败: {str(e)}"
        }), 500


@app.route('/system_status', methods=['GET'])
def system_status():
    try:
        return jsonify({
            "status": "success",
            "models_loaded": MODELS_LOADED,
            "kws_enabled": flag_KWS_used == 1,
            "sv_enabled": flag_sv_used == 1,
            "kws_text": set_KWS,
            "sv_enrolled": check_enrollment_status()
        })
    
    except Exception as e:
        logger.error(f"获取系统状态失败: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"获取系统状态失败: {str(e)}"
        }), 500


@app.route('/clear_history', methods=['POST'])
def clear_history():
    try:
        memory.clear()
        
        return jsonify({
            "status": "success",
            "message": "对话历史已清空"
        })
    
    except Exception as e:
        logger.error(f"清空对话历史失败: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"清空对话历史失败: {str(e)}"
        }), 500


@app.route('/audio/<filename>', methods=['GET'])
def serve_audio(filename):
    return send_from_directory(TMP_AUDIO_DIR, filename)


if __name__ == '__main__':
    from flask import send_from_directory
    
    # 启动API服务器
    port = args.port
    logger.info(f"启动API服务器，监听{port}端口")
    app.run(host='0.0.0.0', port=port, debug=True) 