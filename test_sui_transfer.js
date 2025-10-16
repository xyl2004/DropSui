const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// 使用Sui CLI构建和发送交易
async function buildAndSendTransferTx(privateKey, recipient, amount = '100000000') {
  try {
    // 1. 创建临时密钥别名
    const alias = `test-${Date.now()}`;
    
    console.log('🔑 导入私钥到Sui CLI...');
    
    // 2. 导入私钥到Sui CLI
    const importCommand = `sui keytool import "${privateKey}" ed25519 --alias ${alias} --json`;
    const { stdout: importResult } = await execAsync(importCommand);
    const keyData = JSON.parse(importResult);
    
    console.log('✅ 导入密钥成功:');
    console.log(`   地址: ${keyData.suiAddress}`);
    console.log(`   公钥: ${keyData.publicBase64Key}`);
    
    // 3. 获取SUI coin objects
    console.log(`\n💰 获取SUI coin objects...`);
    const coinsCommand = `sui client gas ${keyData.suiAddress} --json`;
    const { stdout: coinsResult } = await execAsync(coinsCommand);
    const coins = JSON.parse(coinsResult);
    
    if (!coins || coins.length === 0) {
      throw new Error('没有找到可用的SUI coin objects');
    }
    
    const suiCoinId = coins[0].coinObjectId;
    console.log(`   使用SUI coin: ${suiCoinId}`);
    
    // 4. 构建转账交易
    console.log(`\n💰 构建转账交易...`);
    console.log(`   接收地址: ${recipient}`);
    console.log(`   转账金额: ${amount} mist (${parseInt(amount) / 1000000000} SUI)`);
    
    const transferCommand = `sui client transfer-sui --to ${recipient} --sui-coin-object-id ${suiCoinId} --amount ${amount} --gas-budget 10000000 --json`;
    const { stdout: transferResult } = await execAsync(transferCommand);
    const txResult = JSON.parse(transferResult);
    
    console.log('\n✅ 交易发送成功:');
    console.log(`   交易哈希: ${txResult.digest}`);
    console.log(`   状态: ${txResult.effects?.status?.status || 'pending'}`);
    
    if (txResult.effects?.gasUsed) {
      console.log(`   消耗Gas: ${txResult.effects.gasUsed.computationCost}`);
    }
    
    // 5. 清理临时密钥
    try {
      await execAsync(`sui keytool delete ${alias}`);
      console.log('\n🧹 临时密钥清理完成');
    } catch (cleanupError) {
      console.warn('\n⚠️  清理临时密钥失败（这是正常的）:', cleanupError.message);
    }
    
    return {
      digest: txResult.digest,
      effects: txResult.effects,
      address: keyData.suiAddress
    };
    
  } catch (error) {
    console.error('\n❌ Sui CLI交易失败:', error);
    throw error;
  }
}

// 主函数
async function main() {
  try {
    console.log('🚀 开始Sui转账测试...');
    console.log('='.repeat(50));
    
    const privateKey = 'suiprivkey1qqej9ck6jranpg2wpgmv6e726lmyn446x5mn7pr2rj4yskxxzjwtw3y5tpy';
    const recipient = '0x34efb4b67b5f2f11e0eef76c5a94356bab10c71a1c6ef81a90d2689d060f77dd';
    const amount = '100000000'; // 0.1 SUI = 100,000,000 mist
    
    const result = await buildAndSendTransferTx(privateKey, recipient, amount);
    
    console.log('\n🎉 转账测试完成！');
    console.log('='.repeat(50));
    console.log(`发送方地址: ${result.address}`);
    console.log(`接收方地址: ${recipient}`);
    console.log(`转账金额: 0.1 SUI`);
    console.log(`交易哈希: ${result.digest}`);
    
  } catch (error) {
    console.error('\n💥 测试失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main();
}

module.exports = { buildAndSendTransferTx };
