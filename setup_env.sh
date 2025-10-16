#!/bin/bash
# ESP-IDF 环境设置脚本
# 使用方法: source setup_env.sh

echo "🚀 设置ESP-IDF环境..."

# 检查ESP-IDF是否已安装
if [ ! -d "/Users/xiangyonglin/esp/v5.5.1/esp-idf" ]; then
    echo "❌ ESP-IDF未找到，请先安装ESP-IDF"
    exit 1
fi

# 设置ESP-IDF环境
source /Users/xiangyonglin/esp/v5.5.1/esp-idf/export.sh

echo "✅ ESP-IDF环境设置完成！"
echo "📋 可用命令："
echo "  idf.py build     - 构建项目"
echo "  idf.py flash     - 烧录程序"
echo "  idf.py monitor   - 监控串口输出"
echo "  idf.py menuconfig - 配置项目"
echo ""
echo "🎯 当前项目：ESP32-S3 红外传感器监控系统"
