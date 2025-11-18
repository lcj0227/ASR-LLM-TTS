@echo off
REM 使用uvicorn启动后端服务（推荐）

echo ========================================
echo 数字人后端服务启动脚本
echo ========================================
echo.

REM 激活conda环境
call conda activate digital-human
if errorlevel 1 (
    echo [错误] 无法激活conda环境 digital-human
    echo 请先创建环境: conda env create -f environment.yml
    pause
    exit /b 1
)

echo [信息] Conda环境已激活: digital-human
echo.

REM 检查Python和uvicorn
python --version
echo.
python -c "import uvicorn; print('[信息] uvicorn已安装')" 2>nul
if errorlevel 1 (
    echo [错误] uvicorn未安装，正在安装...
    pip install uvicorn[standard]
)

echo.
echo [信息] 正在启动服务...
echo [信息] 服务地址: http://localhost:8000
echo [信息] API文档: http://localhost:8000/docs
echo [信息] 按 Ctrl+C 停止服务
echo.
echo ========================================
echo.

REM 使用uvicorn启动
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause

