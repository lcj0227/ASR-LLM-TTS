@echo off
REM 使用uvicorn启动后端服务（推荐）

echo 正在启动数字人后端服务（使用uvicorn）...
echo.

REM 检查是否在conda环境中
python --version
echo.

REM 使用uvicorn启动
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause

