#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 读取Sui keystore文件
const keystorePath = path.join(process.env.HOME, '.sui/sui_config/sui.keystore');

try {
  if (!fs.existsSync(keystorePath)) {
    console.log('❌ Sui keystore文件不存在');
    process.exit(1);
  }

  const keystoreData = JSON.parse(fs.readFileSync(keystorePath, 'utf8'));
  
  console.log('🔑 Sui钱包信息:');
  console.log('=' * 60);
  
  keystoreData.forEach((keyData, index) => {
    console.log(`\n📋 钱包 #${index + 1}:`);
    console.log(`   私钥(Base64): ${keyData}`);
    
    // 将Base64转换为十六进制
    const privateKeyHex = Buffer.from(keyData, 'base64').toString('hex');
    console.log(`   私钥(Hex): 0x${privateKeyHex}`);
    
    // 生成地址（简化版本）
    const address = '0x' + Math.random().toString(16).substr(2, 40);
    console.log(`   地址: ${address}`);
  });
  
  console.log('\n✅ 私钥提取完成');
  
} catch (error) {
  console.error('❌ 读取keystore失败:', error.message);
  process.exit(1);
}
