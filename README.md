# DropSui - ESP32传感器监控与Sui区块链集成系统

一个创新的物联网+区块链项目，将ESP32传感器数据采集与Sui区块链生态完美结合，提供智能化的资产管理服务。集成Sui钱包管理、定投计划和Bucket Protocol理财功能。

## 🎯 功能特性

### 🔢 传感器监控
- 📡 ESP32-S3 TCRT5000传感器数据采集
- 📤 自动上传到Supabase数据库
- 🔄 实时数据同步和监控
- 📊 数据可视化展示

### 💰 Sui区块链集成
- 🔑 **钱包管理**: 创建、导入、管理Sui钱包
- 🔐 **安全存储**: 私钥加密存储和JWT认证
- 📈 **智能定投**: 支持传统转账和理财策略的定投计划
- 🏦 **DeFi理财**: 集成Bucket Protocol储蓄池理财功能
- 💸 **提币功能**: 支持从储蓄池提取资金

### 🎨 前端功能
- 🔄 每秒自动刷新传感器数据
- 👤 用户注册和登录系统
- 📱 响应式设计，支持移动端
- 🎨 现代化UI界面
- 🔌 基于Supabase的实时数据订阅
- ✅ 成功消息内联显示（非弹窗）

### ⚙️ 后端功能
- 🔐 JWT用户认证
- 🛡️ 密码加密存储
- 📊 用户数据管理
- 🚀 RESTful API接口
- ⚡ 速率限制保护
- 🔄 DCA执行监控和自动交易

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

-- 创建钱包表
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(255) UNIQUE NOT NULL,
    private_key TEXT NOT NULL,
    public_key TEXT NOT NULL,
    wallet_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT false,
    blockchain VARCHAR(20) DEFAULT 'sui',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建定投计划表
CREATE TABLE IF NOT EXISTS dca_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_name VARCHAR(100) NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    amount DECIMAL(18,6) NOT NULL,
    target_address VARCHAR(255) NOT NULL,
    bucket_strategy VARCHAR(50) DEFAULT 'NONE',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建交易记录表
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    dca_plan_id INTEGER REFERENCES dca_plans(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    wallet_address VARCHAR(255) NOT NULL,
    recipient_address VARCHAR(255) NOT NULL,
    amount DECIMAL(18,6) NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    tx_hash VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    block_number INTEGER,
    gas_used INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建DCA执行计数表
CREATE TABLE IF NOT EXISTS dca_execution_counts (
    id SERIAL PRIMARY KEY,
    dca_plan_id INTEGER REFERENCES dca_plans(id) ON DELETE CASCADE,
    execution_count INTEGER DEFAULT 0,
    last_execution_at TIMESTAMP WITH TIME ZONE,
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
JWT_SECRET=your_jwt_secret_here
SUI_NETWORK=mainnet
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
DropSui/
├── fronted/                           # 前端React应用
│   ├── src/
│   │   ├── App.jsx                   # 主应用组件
│   │   ├── App.css                   # 样式文件
│   │   ├── main.jsx                  # 应用入口
│   │   └── supabase.js               # Supabase客户端配置
│   └── package.json                  # 前端依赖
├── backend/                           # 后端Node.js API
│   ├── server.js                     # 服务器主文件
│   ├── bucket_protocol_service.js    # Bucket Protocol集成服务
│   ├── generate_sui_wallet.js        # Sui钱包生成工具
│   ├── package.json                  # 后端依赖
│   └── *.sql                         # 数据库表创建脚本
├── main/                              # ESP32固件代码
│   ├── hello_world_tcrt5000.c        # TCRT5000传感器代码
│   └── CMakeLists.txt                # ESP32项目配置
├── simple_serial_monitor.py          # Python串口监视器
├── sync_env.js                       # 环境变量同步脚本
├── start_all.sh                      # 一键启动脚本
├── start_frontend.sh                 # 前端启动脚本
├── setup_env.sh                      # 环境设置脚本
└── .env                              # 主配置文件
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

### 钱包管理

#### 创建钱包
```http
POST /api/wallets
Authorization: Bearer <token>
Content-Type: application/json

{
  "walletName": "钱包名称"
}
```

#### 导入钱包
```http
POST /api/wallets/import
Authorization: Bearer <token>
Content-Type: application/json

{
  "walletName": "钱包名称",
  "privateKey": "suiprivkey1..."
}
```

#### 获取钱包列表
```http
GET /api/wallets
Authorization: Bearer <token>
```

### 定投计划

#### 创建定投计划
```http
POST /api/dca-plans
Authorization: Bearer <token>
Content-Type: application/json

{
  "planName": "计划名称",
  "tokenSymbol": "USDB",
  "amount": 0.1,
  "targetAddress": "0x...",
  "bucketStrategy": "SAVING_POOL"
}
```

#### 获取定投计划
```http
GET /api/dca-plans
Authorization: Bearer <token>
```

#### 执行定投
```http
POST /api/dca-plans/{id}/execute
Authorization: Bearer <token>
```

### Bucket Protocol

#### 获取APR信息
```http
GET /api/bucket/apr
Authorization: Bearer <token>
```

#### 获取用户储蓄
```http
GET /api/bucket/savings
Authorization: Bearer <token>
```

#### 提币操作
```http
POST /api/dca-plans/{id}/withdraw
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 0.1,
  "planId": 1
}
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

## 🏆 项目特色

### 🌟 创新亮点
- **物联网+区块链**: 首次将ESP32传感器与Sui区块链生态结合
- **智能资产管理**: 基于传感器数据的自动化投资决策
- **DeFi集成**: 深度集成Bucket Protocol储蓄池理财
- **安全可靠**: 私钥加密存储，JWT认证，完整的错误处理

### 🎯 技术优势
- **全栈开发**: React + Node.js + Python + C
- **实时监控**: 传感器数据实时采集和区块链交易执行
- **用户体验**: 现代化UI，响应式设计，内联消息提示
- **扩展性**: 模块化设计，易于扩展新的区块链协议

### 🚀 应用场景
- **智能家居**: 基于环境数据的自动化投资
- **工业监控**: 设备状态监控与资产管理
- **DeFi应用**: 为用户提供便捷的区块链理财服务
- **教育研究**: 物联网与区块链技术结合的典型案例

## 🎉 完成！

现在您有了一个完整的DropSui系统：
- 🔢 ESP32传感器实时监控
- 💰 Sui钱包管理和交易
- 📈 智能定投计划
- 🏦 Bucket Protocol理财集成
- 🔐 安全的用户认证系统
- 🎨 现代化的Web界面

开始体验物联网+区块链的创新应用吧！🚀

## 📞 支持与贡献

- **GitHub**: [https://github.com/xyl2004/DropSui](https://github.com/xyl2004/DropSui)
- **Sui Hackathon**: 参与Sui中文2025黑客马拉松
- **技术栈**: React, Node.js, Sui SDK, Bucket Protocol, ESP32

欢迎提交Issue和Pull Request！🌟
