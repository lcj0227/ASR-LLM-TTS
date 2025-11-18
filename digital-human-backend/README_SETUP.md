# 环境设置指南

## 使用Conda创建环境

### 方法1: 使用environment.yml（推荐）

```bash
# 创建环境
conda env create -f environment.yml

# 激活环境
conda activate digital-human

# 安装额外的Python依赖（如果需要）
pip install -r requirements.txt
```

### 方法2: 手动创建环境

```bash
# 创建Python 3.10环境
conda create -n digital-human python=3.10

# 激活环境
conda activate digital-human

# 安装基础依赖
conda install -c conda-forge pytorch torchvision torchaudio pynini=2.1.5
conda install -c conda-forge numpy opencv pillow scipy librosa soundfile

# 安装Python包
pip install -r requirements.txt
```

### 方法3: 使用脚本（Linux/Mac）

```bash
chmod +x setup_conda_env.sh
./setup_conda_env.sh
conda activate digital-human
```

### 方法4: 使用脚本（Windows）

```cmd
setup_conda_env.bat
conda activate digital-human
```

## 验证安装

```bash
# 激活环境
conda activate digital-human

# 验证Python版本
python --version  # 应该显示 Python 3.10.x

# 验证关键库
python -c "import torch; print(torch.__version__)"
python -c "import fastapi; print(fastapi.__version__)"
python -c "import cv2; print(cv2.__version__)"
```

## 注意事项

1. **CUDA支持**: 
   - 如果有NVIDIA GPU，environment.yml中已包含CUDA工具包
   - 如果只有CPU，需要修改environment.yml，删除cudatoolkit行
   - 或者使用CPU版本的PyTorch: `conda install pytorch torchvision torchaudio cpuonly -c pytorch`

2. **pynini安装**:
   - pynini是CosyVoice的必需依赖
   - 如果conda安装失败，可以尝试: `conda install -c conda-forge pynini=2.1.5`

3. **模型文件**:
   - 环境创建后，还需要下载相应的模型文件
   - 参考主README.md中的模型路径配置

## 卸载环境

如果需要删除环境：

```bash
conda deactivate
conda env remove -n digital-human
```

