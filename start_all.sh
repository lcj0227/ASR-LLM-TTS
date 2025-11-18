#!/bin/bash
# 一键启动数字人Web端项目（后端+前端）

echo "========================================"
echo "启动数字人Web端项目"
echo "========================================"
echo ""

# 检查conda
if ! command -v conda &> /dev/null; then
    echo "错误: 未找到conda，请先安装Anaconda或Miniconda"
    exit 1
fi

echo "[1/3] 启动后端服务..."
cd digital-human-backend
source $(conda info --base)/etc/profile.d/conda.sh
conda activate digital-human
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

echo "[2/3] 等待后端启动（5秒）..."
sleep 5

echo "[3/3] 启动前端服务..."
cd digital-human-frontend
npm start &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================"
echo "启动完成！"
echo "========================================"
echo "后端服务: http://localhost:8000"
echo "前端应用: http://localhost:3000"
echo "API文档:  http://localhost:8000/docs"
echo ""
echo "提示: 按Ctrl+C停止所有服务"
echo "========================================"

# 等待中断信号
trap "echo ''; echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait

