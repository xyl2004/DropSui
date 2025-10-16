// 生成Sui钱包地址和私钥
const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');

console.log('🔑 生成Sui钱包...');
console.log('='.repeat(50));

// 生成新的Ed25519密钥对
const keypair = Ed25519Keypair.generate();

// 获取地址
const address = keypair.getPublicKey().toSuiAddress();

// 获取Base64格式的公钥
const publicKey = keypair.getPublicKey().toBase64();

// 获取私钥的十六进制格式
const privateKeyHex = keypair.getSecretKey().toString('hex');

console.log('📋 钱包信息:');
console.log(`   地址: ${address}`);
console.log(`   公钥(Base64): ${publicKey}`);
console.log(`   私钥(Hex): 0x${privateKeyHex}`);

console.log('\n✅ 钱包生成完成！');
