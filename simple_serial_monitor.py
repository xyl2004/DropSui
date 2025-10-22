#!/usr/bin/env python3
"""
ESP32串口监视器 - 触发定投执行
读取串口数据，每次检测到物体时：
1. 向sensor_counts表插入计数1
2. 为所有运行中的定投计划累加执行计数
"""

import serial
import serial.tools.list_ports
import time
import re
import requests
import json
from datetime import datetime
import sys
import os
from dotenv import load_dotenv

# 加载.env文件
load_dotenv()

# Supabase配置 - 从环境变量读取
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_API_KEY = os.getenv('SUPABASE_API_KEY')

# 后端API配置
BACKEND_API_URL = os.getenv('BACKEND_API_URL', 'http://localhost:5001/api')

# 检查配置
if not SUPABASE_URL or not SUPABASE_API_KEY:
    print("❌ 错误: 未找到Supabase配置")
    print("💡 请确保在项目根目录创建.env文件，包含以下内容:")
    print("   SUPABASE_URL=https://your-project.supabase.co")
    print("   SUPABASE_API_KEY=your_anon_key_here")
    sys.exit(1)

def get_active_dca_plans():
    """获取所有运行中的定投计划"""
    try:
        # 先查询所有计划，看看数据情况
        all_url = f"{SUPABASE_URL}/rest/v1/dca_plans?select=id,plan_name,user_id,is_active"
        headers = {
            'apikey': SUPABASE_API_KEY,
            'Authorization': f'Bearer {SUPABASE_API_KEY}'
        }
        
        print(f"🔍 查询所有DCA计划: {all_url}")
        all_response = requests.get(all_url, headers=headers, timeout=5)
        
        if all_response.status_code == 200:
            all_plans = all_response.json()
            print(f"📊 数据库中的所有计划: {len(all_plans)} 个")
            for plan in all_plans:
                print(f"📋 计划: {plan.get('plan_name')} (ID: {plan.get('id')}), 用户: {plan.get('user_id')}, 状态: {plan.get('is_active')} (类型: {type(plan.get('is_active'))})")
        else:
            print(f"❌ 查询所有计划失败: {all_response.status_code}")
        
        # 然后查询活跃计划
        active_url = f"{SUPABASE_URL}/rest/v1/dca_plans?is_active=eq.true&select=id,plan_name,user_id,is_active"
        print(f"🔍 查询活跃DCA计划: {active_url}")
        response = requests.get(active_url, headers=headers, timeout=5)
        
        if response.status_code == 200:
            plans = response.json()
            print(f"📊 找到 {len(plans)} 个活跃DCA计划")
            for plan in plans:
                print(f"🟢 活跃计划: {plan.get('plan_name')} (ID: {plan.get('id')}), 用户: {plan.get('user_id')}, 状态: {plan.get('is_active')}")
            return plans
        else:
            print(f"❌ 获取定投计划失败: {response.status_code}")
            print(f"响应内容: {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ 获取定投计划异常: {e}")
        return []

def increment_dca_execution_count(dca_plan_id, plan_name):
    """为指定定投计划累加执行计数"""
    try:
        # 首先尝试获取现有记录
        get_url = f"{SUPABASE_URL}/rest/v1/dca_execution_counts?dca_plan_id=eq.{dca_plan_id}&select=*"
        headers = {
            'apikey': SUPABASE_API_KEY,
            'Authorization': f'Bearer {SUPABASE_API_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        }
        
        response = requests.get(get_url, headers=headers, timeout=5)
        existing = response.json() if response.status_code == 200 else []
        
        if existing and len(existing) > 0:
            # 更新现有记录
            current_count = existing[0].get('execution_count', 0)
            new_count = current_count + 1
            
            update_url = f"{SUPABASE_URL}/rest/v1/dca_execution_counts?dca_plan_id=eq.{dca_plan_id}"
            update_data = {
                'execution_count': new_count,
                'last_executed_at': datetime.now().isoformat()
            }
            
            response = requests.patch(update_url, headers=headers, json=update_data, timeout=5)
            
            if response.status_code in [200, 204]:
                print(f"  ✓ {plan_name}: {current_count} → {new_count}")
                return True
            else:
                print(f"  ✗ 更新失败: {response.status_code}")
                return False
        else:
            # 创建新记录
            insert_url = f"{SUPABASE_URL}/rest/v1/dca_execution_counts"
            insert_data = {
                'dca_plan_id': dca_plan_id,
                'execution_count': 1,
                'last_executed_at': datetime.now().isoformat()
            }
            
            response = requests.post(insert_url, headers=headers, json=insert_data, timeout=5)
            
            if response.status_code in [200, 201]:
                print(f"  ✓ {plan_name}: 新建 → 1")
                return True
            else:
                print(f"  ✗ 创建失败: {response.status_code}")
                return False
                
    except Exception as e:
        print(f"  ✗ 异常: {e}")
        return False

def trigger_dca_execution(timestamp_ms):
    """触发定投执行：插入sensor_counts记录并累加所有运行中定投的计数"""
    try:
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        # 1. 插入sensor_counts记录（计数固定为1）
        sensor_url = f"{SUPABASE_URL}/rest/v1/sensor_counts"
        sensor_headers = {
            'apikey': SUPABASE_API_KEY,
            'Authorization': f'Bearer {SUPABASE_API_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
        }
        
        sensor_data = {
            'count': 1,  # 固定为1，不累加
            'timestamp': datetime.now().timestamp()  # Unix时间戳（秒）
        }
        
        response = requests.post(sensor_url, headers=sensor_headers, json=sensor_data, timeout=5)
        
        if response.status_code in [200, 201]:
            print(f"[{timestamp}] ✅ 传感器触发记录已插入")
        else:
            print(f"[{timestamp}] ❌ 插入失败: {response.status_code}")
            return False
        
        # 2. 获取所有运行中的定投计划
        active_plans = get_active_dca_plans()
        
        if not active_plans or len(active_plans) == 0:
            print(f"[{timestamp}] ℹ️  没有运行中的定投计划")
            return True
        
        print(f"[{timestamp}] 📋 找到 {len(active_plans)} 个运行中的定投计划")
        
        # 3. 为每个运行中的定投计划累加执行计数
        print(f"[{timestamp}] 📊 更新定投执行计数:")
        success_count = 0
        for plan in active_plans:
            if increment_dca_execution_count(plan['id'], plan['plan_name']):
                success_count += 1
        
        print(f"[{timestamp}] ✅ 成功更新 {success_count}/{len(active_plans)} 个定投计划")
        return True
            
    except Exception as e:
        print(f"❌ 触发定投执行异常: {e}")
        return False

def monitor_serial(port="/dev/cu.usbserial-10", baudrate=115200):
    """监视串口输出"""
    print("🎯 ESP32-S3 TCRT5000 定投触发监视器")
    print("=" * 60)
    print(f"✅ 串口: {port}")
    print(f"📡 波特率: {baudrate}")
    print("")
    print("📡 工作模式:")
    print("  1. 每次检测到物体 → 插入sensor_counts记录（count=1）")
    print("  2. 为所有运行中的定投计划累加执行计数")
    print("  3. 每个定投计划独立计数，互不干扰")
    print("")
    print("🎯 在TCRT5000传感器前移动物体进行测试")
    print("按 Ctrl+C 退出")
    print("=" * 60)
    print("")
    
    try:
        # 打开串口
        ser = serial.Serial(port, baudrate, timeout=1)
        print("✅ 串口连接成功")
        print("🔄 等待ESP32输出...")
        print("")
        
        count = 0
        buffer = ""
        
        while True:
            try:
                # 读取数据
                data = ser.readline().decode('utf-8', errors='ignore').strip()
                
                if data:
                    timestamp = datetime.now().strftime("%H:%M:%S")
                    print(f"[{timestamp}] {data}")
                    
                    # 检查计数信息
                    if "Count:" in data:
                        # 提取计数值和时间
                        count_match = re.search(r'Count:\s*(\d+),\s*Time:\s*(\d+)\s*ms', data)
                        if count_match:
                            count_num = int(count_match.group(1))
                            time_ms = int(count_match.group(2))
                            
                            print(f"[{timestamp}] 🎉 检测到物体: #{count_num}")
                            print(f"[{timestamp}] ⏰ 时间: {time_ms}ms")
                            
                            # 触发定投执行
                            print(f"[{timestamp}] 📤 触发定投执行...")
                            trigger_dca_execution(time_ms)
                            print("")
                    
                    # 检查启动信息
                    elif "TCRT5000 Counter Ready" in data:
                        print(f"[{timestamp}] 🚀 计数器已准备就绪！")
                        print("")
                    elif "TCRT5000 Counter Starting" in data:
                        print(f"[{timestamp}] 🔄 计数器正在启动...")
                
            except serial.SerialTimeoutException:
                # 超时，继续等待
                continue
            except UnicodeDecodeError:
                # 忽略解码错误
                continue
                
    except serial.SerialException as e:
        print(f"❌ 串口错误: {e}")
        print("💡 请检查:")
        print("   1. ESP32是否正确连接")
        print("   2. 串口是否被其他程序占用")
        print("   3. 串口权限是否正确")
    except KeyboardInterrupt:
        print("\n")
        print("🛑 监视器已停止")
    except Exception as e:
        print(f"❌ 发生错误: {e}")
    finally:
        if 'ser' in locals() and ser.is_open:
            ser.close()
            print("✅ 串口已关闭")

def auto_detect_esp32_port():
    """自动检测ESP32串口"""
    ports = serial.tools.list_ports.comports()
    
    # 优先查找 cu.usbserial 设备（macOS推荐）
    for port in ports:
        if 'usbserial' in port.device or 'USB' in port.device:
            return port.device
    
    # 如果没找到，返回None
    return None

if __name__ == "__main__":
    # 检查命令行参数
    if len(sys.argv) > 1:
        port = sys.argv[1]
    else:
        # 自动检测串口
        port = auto_detect_esp32_port()
        if not port:
            print("❌ 未检测到ESP32设备")
            print("💡 请检查:")
            print("   1. ESP32是否通过USB连接到电脑")
            print("   2. USB驱动是否已安装")
            print("")
            print("🔍 可用的串口设备:")
            ports = serial.tools.list_ports.comports()
            if ports:
                for p in ports:
                    print(f"   - {p.device}: {p.description}")
            else:
                print("   (未发现任何串口设备)")
            print("")
            print("💡 也可以手动指定串口:")
            print("   python3 simple_serial_monitor.py /dev/cu.usbserial-10")
            sys.exit(1)
        
        print(f"✅ 自动检测到ESP32设备: {port}")
        print("")
    
    monitor_serial(port)