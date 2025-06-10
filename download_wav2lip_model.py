import os
import requests
import argparse
from tqdm import tqdm

# 首先安装依赖
try:
    import gdown
except ImportError:
    print("安装所需依赖...")
    os.system("pip install gdown tqdm requests")
    import gdown

def download_file(url, destination):
    """从URL下载文件到指定目标路径"""
    response = requests.get(url, stream=True)
    total_size = int(response.headers.get('content-length', 0))
    block_size = 1024  # 1 Kibibyte
    
    with open(destination, 'wb') as f:
        with tqdm(total=total_size, unit='iB', unit_scale=True) as t:
            for data in response.iter_content(block_size):
                t.update(len(data))
                f.write(data)
    
    if total_size != 0 and t.n != total_size:
        print("下载可能不完整")
    else:
        print(f"下载完成: {destination}")

def download_from_gdrive(id, destination):
    """从Google Drive下载文件"""
    url = f'https://drive.google.com/uc?id={id}'
    gdown.download(url, destination, quiet=False)

def main():
    parser = argparse.ArgumentParser(description='下载Wav2Lip预训练模型')
    parser.add_argument('--output_dir', type=str, default='wav2lip_model', 
                        help='保存模型的目录')
    args = parser.parse_args()
    
    # 创建输出目录
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Wav2Lip预训练模型的Google Drive ID
    model_id = '1bgkMWy6xwmvGkAVekWiKlMXZTrqllrok'  # 这是wav2lip_gan.pth的ID
    
    # 下载模型
    destination = os.path.join(args.output_dir, 'wav2lip_gan.pth')
    if os.path.exists(destination):
        print(f"模型已存在: {destination}")
    else:
        print(f"开始下载Wav2Lip预训练模型...")
        try:
            download_from_gdrive(model_id, destination)
        except Exception as e:
            print(f"从Google Drive下载失败: {e}")
            print("请尝试手动下载模型，地址: https://github.com/Rudrabha/Wav2Lip#getting-the-weights")
            print(f"下载后请将模型放置在 {destination} 路径")

if __name__ == "__main__":
    main() 