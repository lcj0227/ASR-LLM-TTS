@echo off
REM 启动数字人前端服务

echo 正在启动数字人前端服务...
echo.

REM 检查Node.js
node --version
echo.

REM 安装依赖（如果需要）
if not exist node_modules (
    echo 正在安装依赖...
    call npm install
)

REM 启动开发服务器
npm start

