from transformers import AutoModelForCausalLM, AutoTokenizer
import asyncio
import edge_tts
import os
import pygame
import time

# 确保输出目录存在
output_dir = "./test_output"
os.makedirs(output_dir, exist_ok=True)

async def text_to_speech(text, voice, output_file):
    """使用edge-tts将文本转换为语音"""
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_file)

def play_audio(file_path):
    """播放音频文件"""
    try:
        pygame.mixer.init()
        pygame.mixer.music.load(file_path)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            time.sleep(1)  # 等待音频播放结束
        print("播放完成！")
    except Exception as e:
        print(f"播放失败: {e}")
    finally:
        pygame.mixer.quit()

def main():
    # 初始化QWen2.5模型
    print("正在加载QWen2.5模型...")
    model_name = "Qwen/Qwen2.5-1.5B-Instruct"
    
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype="auto",
        device_map="auto"
    )
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    print("模型加载完成！")
    
    # 使用模型进行推理
    user_input = "请介绍一下自己，字数不超过50字"
    
    messages = [
        {"role": "system", "content": "你叫千问，是一个18岁的女大学生，性格活泼开朗，说话俏皮"},
        {"role": "user", "content": user_input},
    ]
    
    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    model_inputs = tokenizer([text], return_tensors="pt").to(model.device)

    print("正在生成回答...")
    generated_ids = model.generate(
        **model_inputs,
        max_new_tokens=512,
    )
    generated_ids = [
        output_ids[len(input_ids):] for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
    ]

    response = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]

    print("用户问题:", user_input)
    print("模型回答:", response)

    # 使用edge-tts生成语音
    output_file = os.path.join(output_dir, "response.mp3")
    print("正在生成语音...")
    asyncio.run(text_to_speech(response, "zh-CN-XiaoyiNeural", output_file))
    
    # 播放语音
    print("播放语音...")
    play_audio(output_file)

if __name__ == "__main__":
    main() 