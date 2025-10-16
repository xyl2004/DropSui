# ESP32传感器监控系统

一个完整的ESP32传感器监控系统，包含用户认证、实时数据监控和现代化Web界面。

## 🎯 功能特性

### 前端功能
- 🔄 每秒自动刷新传感器数据
- 👤 用户注册和登录系统
- 📱 响应式设计，支持移动端
- 🎨 现代化UI界面
- 🔌 基于Supabase的实时数据订阅

### 后端功能
- 🔐 JWT用户认证
- 🛡️ 密码加密存储
- 📊 用户数据管理
- 🚀 RESTful API接口
- ⚡ 速率限制保护

### 传感器功能
- 📡 ESP32-S3 TCRT5000传感器数据采集
- 📤 自动上传到Supabase数据库
- 🔄 实时数据同步

## 🚀 快速开始

### 1. 环境准备

确保已安装以下依赖：
```bash
# Python依赖
pip3 install python-dotenv pyserial requests

# Node.js依赖（会自动安装）
```

### 2. 数据库设置

在Supabase中执行以下SQL脚本：
```sql
-- 创建传感器计数表
CREATE TABLE IF NOT EXISTS sensor_counts (
    id SERIAL PRIMARY KEY,
    count INTEGER NOT NULL,
    timestamp REAL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. 配置系统

系统已预配置Supabase连接信息，无需额外配置。

如需修改，编辑根目录的 `.env` 文件：
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_API_KEY=your_anon_key_here
```

### 4. 启动系统

#### 方法一：一键启动（推荐）
```bash
./start_all.sh
```

#### 方法二：分别启动
```bash
# 启动后端
cd backend
npm start

# 启动前端（新终端）
cd fronted
npm run dev

# 启动传感器监控（新终端）
python3 simple_serial_monitor.py
```

## 📁 项目结构

```
hello_world/
├── fronted/                    # 前端React应用
│   ├── src/
│   │   ├── App.jsx            # 主应用组件
│   │   ├── App.css            # 样式文件
│   │   ├── main.jsx           # 应用入口
│   │   └── supabase.js        # Supabase客户端配置
│   └── package.json           # 前端依赖
├── backend/                    # 后端Node.js API
│   ├── server.js              # 服务器主文件
│   ├── package.json           # 后端依赖
│   └── create_users_table.sql # 用户表创建脚本
├── simple_serial_monitor.py   # Python串口监视器
├── sync_env.js               # 环境变量同步脚本
├── start_all.sh              # 一键启动脚本
└── .env                      # 主配置文件
```

## 🔧 API接口

### 用户认证

#### 用户注册
```http
POST /api/register
Content-Type: application/json

{
  "username": "用户名",
  "email": "邮箱",
  "password": "密码"
}
```

#### 用户登录
```http
POST /api/login
Content-Type: application/json

{
  "username": "用户名或邮箱",
  "password": "密码"
}
```

#### 获取用户信息
```http
GET /api/profile
Authorization: Bearer <token>
```

### 健康检查
```http
GET /api/health
```

## 🛠️ 开发说明

### 修改前端
编辑 `fronted/src/` 目录下的文件

### 修改后端
编辑 `backend/server.js` 文件

### 修改传感器监控
编辑 `simple_serial_monitor.py` 文件

### 构建生产版本
```bash
# 构建前端
npm run frontend:build

# 构建文件将输出到 fronted/dist 目录
```

## 🔍 故障排除

### 常见问题

**Q: 前端无法连接后端API**
- 确保后端服务器运行在 http://localhost:5000
- 检查防火墙设置
- 查看浏览器控制台错误信息

**Q: 用户注册/登录失败**
- 检查Supabase数据库连接
- 确认用户表已创建
- 查看后端服务器日志

**Q: 传感器数据不更新**
- 检查ESP32设备连接
- 确认串口设备路径
- 查看Python脚本输出

**Q: 数据库连接失败**
- 检查Supabase URL和API密钥
- 确认网络连接
- 查看Supabase项目状态

### 调试步骤

1. 检查服务状态：
   ```bash
   # 检查后端
   curl http://localhost:5000/api/health
   
   # 检查前端
   curl http://localhost:3000
   ```

2. 查看日志：
   - 后端日志在终端输出
   - 前端错误在浏览器控制台
   - Python脚本输出在终端

3. 验证配置：
   ```bash
   # 检查环境变量
   cat .env
   cat fronted/.env
   cat backend/.env
   ```

## 📞 支持

如果遇到问题：
1. 查看本文档的故障排除部分
2. 检查所有服务是否正常运行
3. 查看相关日志输出
4. 确认数据库配置正确

## 🎉 完成！

现在您有了一个完整的ESP32传感器监控系统：
- 用户认证和管理
- 实时数据监控
- 现代化Web界面
- 自动化部署流程

开始监控您的传感器数据吧！🚀
