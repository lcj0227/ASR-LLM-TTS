@echo off
REM Conda环境设置脚本 (Windows)

echo 正在创建conda环境: digital-human

REM 创建conda环境
conda env create -f environment.yml

REM 激活环境提示
echo.
echo 环境创建完成！
echo 请运行以下命令激活环境：
echo   conda activate digital-human
echo.
echo 或者使用以下命令直接激活并安装额外依赖：
echo   conda activate digital-human
echo   pip install -r requirements.txt

pause

