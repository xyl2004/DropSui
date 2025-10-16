# ESP32传感器实时监控前端

这是一个React前端应用，用于实时显示ESP32-S3 TCRT5000传感器的计数数据。

## 功能特性

- 🔄 实时显示传感器计数数据
- ⏰ 显示最新计数的时间戳
- 📱 响应式设计，支持移动端
- 🎨 现代化的UI界面
- 🔌 基于Supabase的实时数据订阅

## 安装和运行

### 1. 安装依赖

```bash
cd fronted
npm install
```

### 2. 配置Supabase

复制环境变量模板文件：
```bash
cp env.example .env
```

编辑 `.env` 文件，填入您的Supabase配置：
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:3000 运行

### 4. 构建生产版本

```bash
npm run build
```

构建文件将输出到 `dist` 目录

## 项目结构

```
fronted/
├── src/
│   ├── App.jsx          # 主应用组件
│   ├── App.css          # 样式文件
│   ├── main.jsx         # 应用入口
│   └── supabase.js      # Supabase客户端配置
├── index.html           # HTML模板
├── vite.config.js       # Vite配置
└── package.json         # 项目依赖
```

## 数据库表结构

应用使用 `sensor_counts` 表，包含以下字段：
- `id`: 主键
- `count`: 传感器计数
- `timestamp`: 计数时间戳
- `created_at`: 记录创建时间

## 实时数据订阅

应用使用Supabase的实时订阅功能监听 `sensor_counts` 表的 `INSERT` 事件，当有新数据插入时自动更新界面。

## 注意事项

1. 确保Supabase项目已正确配置
2. 确保 `sensor_counts` 表已创建
3. 确保Supabase的实时功能已启用
4. 检查网络连接以确保实时订阅正常工作

## 故障排除

如果遇到连接问题：
1. 检查Supabase URL和API密钥是否正确
2. 确认数据库表是否存在
3. 检查浏览器控制台是否有错误信息
4. 确认Supabase项目的实时功能是否已启用
