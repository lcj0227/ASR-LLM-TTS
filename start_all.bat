@echo off
REM 一键启动数字人Web端项目（后端+前端）

echo ========================================
echo 启动数字人Web端项目
echo ========================================
echo.

REM 检查conda环境
where conda >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到conda，请先安装Anaconda或Miniconda
    pause
    exit /b 1
)

echo [1/3] 启动后端服务...
start "数字人后端服务" cmd /k "cd digital-human-backend && conda activate digital-human && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/3] 等待后端启动（5秒）...
timeout /t 5 /nobreak >nul

echo [3/3] 启动前端服务...
start "数字人前端服务" cmd /k "cd digital-human-frontend && npm start"

echo.
echo ========================================
echo 启动完成！
echo ========================================
echo 后端服务: http://localhost:8000
echo 前端应用: http://localhost:3000
echo API文档:  http://localhost:8000/docs
echo.
echo 提示: 关闭窗口即可停止对应服务
echo ========================================
pause

