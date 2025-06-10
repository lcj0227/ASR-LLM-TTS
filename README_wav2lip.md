# ASR-LLM-TTS系统 + Wav2Lip唇形同步功能

本项目在原有ASR-LLM-TTS系统基础上，增加了Wav2Lip唇形同步功能，可以根据人脸图像和合成语音生成唇形同步的视频。

## 功能介绍

1. **ASR（语音识别）**: 使用SenceVoice模型将语音转换为文本
2. **LLM（大语言模型）**: 使用QWen2.5模型处理文本，生成回复
3. **TTS（语音合成）**: 使用Edge TTS将回复转换为语音
4. **Wav2Lip（唇形同步）**: 将合成的语音与给定的人脸图像结合，生成唇形同步的视频

## 安装依赖

```bash
# 安装基础依赖
pip install librosa opencv-python ffmpeg-python
pip install gdown tqdm requests

# 下载Wav2Lip预训练模型
python download_wav2lip_model.py
```

确保系统已安装FFmpeg，这对于视频处理是必需的。

## 使用方法

### 1. 仅使用ASR-LLM-TTS功能

```bash
python 13_0SenceVoice_QWen2.5_edgeTTS_realTime_copy.py
```

### 2. 使用带唇形同步的功能

```bash
python 13_0SenceVoice_QWen2.5_edgeTTS_realTime_copy.py --face_image path/to/your/face.jpg
```

可选参数:
- `--face_image`: 人脸图像路径（必须是包含清晰人脸的图像）
- `--wav2lip_model`: Wav2Lip预训练模型路径（默认为'wav2lip_model/wav2lip_gan.pth'）

### 3. 单独测试Wav2Lip功能

我们提供了两个测试脚本来单独测试唇形同步功能：

#### 完整的Wav2Lip测试（需要预训练模型）

```bash
python test_wav2lip.py --face_image path/to/face.jpg --audio path/to/audio.mp3 --output output.mp4
```

#### 简单的音视频合成测试（只需要FFmpeg）

```bash
python simple_test_wav2lip.py --face_image path/to/face.jpg --audio path/to/audio.mp3 --output simple_output.mp4
```

这个简单的测试脚本不需要Wav2Lip预训练模型，它只是将静态图像和音频合成为视频，不会实现实际的唇形同步，但可以用来快速测试基本功能。

## 文件说明

- `13_0SenceVoice_QWen2.5_edgeTTS_realTime_copy.py`: 主程序文件
- `wav2lip_utils.py`: Wav2Lip处理工具
- `download_wav2lip_model.py`: 下载Wav2Lip预训练模型的脚本
- `test_wav2lip.py`: 测试Wav2Lip功能的脚本
- `simple_test_wav2lip.py`: 简单的音视频合成测试脚本

## 使用流程

1. 程序启动后，会开始录制音频
2. 检测到有效语音后，会通过ASR转换为文本
3. 文本送入LLM生成回复
4. 回复通过TTS转换为语音
5. 如果提供了人脸图像，会使用Wav2Lip生成唇形同步视频并播放
6. 如果未提供人脸图像或Wav2Lip处理失败，会直接播放合成的语音

## 注意事项

1. 确保提供的人脸图像清晰且包含完整的脸部
2. 第一次运行时需要下载预训练模型，可能需要较长时间
3. 生成的唇形同步视频保存在`./wav2lip_output`目录中
4. 合成的语音保存在`./Test_QWen2_VL`目录中
5. 录制的原始音频保存在`./output`目录中
6. 如果无法下载Wav2Lip预训练模型，系统会退化为简单的音视频合成

## 故障排除

1. 如果遇到"No module named 'gdown'"错误，请手动安装gdown: `pip install gdown`
2. 如果下载预训练模型失败，您可以从[Wav2Lip项目](https://github.com/Rudrabha/Wav2Lip#getting-the-weights)手动下载
3. 如果遇到FFmpeg相关错误，请确保您已正确安装FFmpeg并添加到系统路径
4. 对于Mac用户，可以使用Homebrew安装FFmpeg: `brew install ffmpeg`

## 示例

```bash
# 下载预训练模型
python download_wav2lip_model.py

# 使用唇形同步功能（使用自己的人脸图片）
python 13_0SenceVoice_QWen2.5_edgeTTS_realTime_copy.py --face_image my_face.jpg

# 简单测试FFmpeg音视频合成
python simple_test_wav2lip.py --face_image my_face.jpg --audio Test_QWen2_VL/sft_1.mp3
```

按`Ctrl+C`可以停止程序运行。 