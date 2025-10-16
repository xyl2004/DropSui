#!/bin/bash

# ESP32传感器监控前端启动脚本

echo "🚀 启动ESP32传感器监控前端..."

# 检查是否在项目根目录
if [ ! -f "package.json" ] || [ ! -d "fronted" ]; then
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
        echo "💡 请手动创建.env文件，包含以下内容:"
        echo "   SUPABASE_URL=https://your-project.supabase.co"
        echo "   SUPABASE_API_KEY=your_anon_key_here"
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

# 启动开发服务器
echo "🌐 启动开发服务器..."
echo "前端将在 http://localhost:3000 运行"
echo "按 Ctrl+C 停止服务器"
echo ""

cd fronted
npm run dev
