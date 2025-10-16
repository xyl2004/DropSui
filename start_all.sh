#!/bin/bash

# ESP32传感器监控系统完整启动脚本

echo "🚀 启动ESP32传感器监控系统..."

# 检查是否在项目根目录
if [ ! -f "package.json" ] || [ ! -d "fronted" ] || [ ! -d "backend" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 检查根目录是否有.env文件
if [ ! -f ".env" ]; then
    echo "⚠️  未找到根目录的.env文件，正在创建..."
    if [ -f "env_template.txt" ]; then
        cp env_template.txt .env
        echo "✅ 已从模板创建.env文件"
    else
        echo "❌ 未找到env_template.txt模板文件"
        exit 1
    fi
fi

# 同步环境变量到前端
echo "🔄 同步环境变量到前端..."
node sync_env.js

# 检查前端依赖
if [ ! -d "fronted/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd fronted
    npm install
    cd ..
fi

# 检查后端依赖
if [ ! -d "backend/node_modules" ]; then
    echo "📦 安装后端依赖..."
    cd backend
    npm install
    cd ..
fi

# 复制环境变量到后端
echo "🔄 复制环境变量到后端..."
cp .env backend/.env
echo "JWT_SECRET=esp32-sensor-monitor-super-secret-key-2024" >> backend/.env
echo "PORT=5001" >> backend/.env

echo ""
echo "🌐 启动后端服务器..."
cd backend
npm start &
BACKEND_PID=$!

# 等待后端启动
sleep 3

echo "🌐 启动前端开发服务器..."
cd ../fronted
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 系统启动完成！"
echo "📡 后端API: http://localhost:5001"
echo "🌐 前端界面: http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "echo ''; echo '🛑 正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
