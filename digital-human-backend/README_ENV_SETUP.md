# Conda环境设置指南

## 问题解决

如果遇到权限错误（Permission denied），请尝试以下方法：

### 方法1: 清理缓存后重试

```bash
# 清理conda缓存
conda clean --all -y

# 重新创建环境
conda env create -f environment.yml
```

### 方法2: 使用简化脚本（推荐）

**Windows:**
```cmd
create_env_simple.bat
```

**Linux/Mac:**
```bash
chmod +x create_env_simple.sh
./create_env_simple.sh
```

### 方法3: 手动创建（最稳定）

```bash
# 1. 创建基础环境
conda create -n digital-human python=3.10 -y

# 2. 激活环境
conda activate digital-human

# 3. 安装PyTorch（根据你的CUDA版本选择）
# GPU版本（CUDA 11.8）:
conda install -c pytorch -y pytorch torchvision torchaudio pytorch-cuda=11.8

# CPU版本:
conda install -c pytorch -y pytorch torchvision torchaudio cpuonly

# 4. 安装其他conda包
conda install -c conda-forge -y numpy scipy pillow opencv librosa pynini=2.1.5

# 5. 安装pip包
pip install -r requirements.txt
```

### 方法4: 如果只有CPU或CUDA版本不匹配

修改 `environment.yml`，删除或注释掉 `cudatoolkit=11.8` 这一行，然后：

```bash
conda env create -f environment.yml
```

## 验证安装

```bash
conda activate digital-human
python --version  # 应该显示 Python 3.10.x
python -c "import torch; print('PyTorch:', torch.__version__)"
python -c "import fastapi; print('FastAPI:', fastapi.__version__)"
python -c "import cv2; print('OpenCV:', cv2.__version__)"
```

## 常见问题

1. **权限错误**: 关闭所有使用conda的程序，以管理员身份运行
2. **CUDA版本不匹配**: 检查你的CUDA版本，调整environment.yml中的cudatoolkit版本
3. **pynini安装失败**: 尝试 `conda install -c conda-forge pynini=2.1.5`
4. **网络问题**: 使用国内镜像源

## 使用国内镜像源（可选）

```bash
# 配置conda使用清华镜像
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/main
conda config --add channels https://mirrors.tuna.tsinghua.edu.cn/anaconda/pkgs/free
conda config --set show_channel_urls yes
```

