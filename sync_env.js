#!/usr/bin/env node

/**
 * 环境变量同步脚本
 * 将根目录的.env文件中的环境变量同步到前端
 */

const fs = require('fs');
const path = require('path');

// 检查根目录的.env文件
const envPath = path.join(__dirname, '.env');
const frontendEnvPath = path.join(__dirname, 'fronted', '.env');

if (!fs.existsSync(envPath)) {
    console.log('⚠️  未找到根目录的.env文件');
    process.exit(0);
}

// 读取根目录的.env文件
const envContent = fs.readFileSync(envPath, 'utf8');
const lines = envContent.split('\n');

// 解析环境变量
const envVars = {};
lines.forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
            const value = valueParts.join('=');
            envVars[key.trim()] = value.trim();
        }
    }
});

// 生成前端环境变量文件内容
let frontendEnvContent = '# 前端环境变量文件\n';
frontendEnvContent += '# 此文件由sync_env.js自动生成，请勿手动修改\n\n';

// 同步关键的环境变量到前端
const syncVars = {
    'SUPABASE_URL': 'VITE_SUPABASE_URL',
    'SUPABASE_API_KEY': 'VITE_SUPABASE_ANON_KEY',
    'SUI_NETWORK': 'VITE_SUI_NETWORK'
};

Object.keys(syncVars).forEach(originalKey => {
    const viteKey = syncVars[originalKey];
    if (envVars[originalKey]) {
        frontendEnvContent += `${viteKey}=${envVars[originalKey]}\n`;
    } else {
        // 设置默认值
        switch (originalKey) {
            case 'SUI_NETWORK':
                frontendEnvContent += `${viteKey}=mainnet\n`;
                break;
            default:
                frontendEnvContent += `# ${viteKey}=未设置\n`;
        }
    }
});

// 写入前端.env文件
fs.writeFileSync(frontendEnvPath, frontendEnvContent);

console.log('✅ 环境变量已同步到前端');
console.log(`📁 前端环境文件: ${frontendEnvPath}`);
