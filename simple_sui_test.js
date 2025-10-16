const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function testSuiTransfer() {
  try {
    console.log('🚀 开始Sui转账测试...');
    console.log('='.repeat(50));
    
    const privateKey = 'suiprivkey1qqej9ck6jranpg2wpgmv6e726lmyn446x5mn7pr2rj4yskxxzjwtw3y5tpy';
    const recipient = '0x34efb4b67b5f2f11e0eef76c5a94356bab10c71a1c6ef81a90d2689d060f77dd';
    const amount = '100000000'; // 0.1 SUI = 100,000,000 mist
    
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
    
    // 3. 使用简化的转账命令
    console.log(`\n💰 执行转账...`);
    console.log(`   接收地址: ${recipient}`);
    console.log(`   转账金额: ${amount} mist (0.1 SUI)`);
    
    // 使用sui client pay命令，这个命令更简单
    const payCommand = `sui client pay --input-coins ${keyData.suiAddress} --recipients ${recipient} --amounts ${amount} --gas-budget 10000000 --json`;
    
    try {
      const { stdout: payResult } = await execAsync(payCommand);
      const txResult = JSON.parse(payResult);
      
      console.log('\n✅ 转账成功:');
      console.log(`   交易哈希: ${txResult.digest}`);
      console.log(`   状态: ${txResult.effects?.status?.status || 'pending'}`);
      
      if (txResult.effects?.gasUsed) {
        console.log(`   消耗Gas: ${txResult.effects.gasUsed.computationCost}`);
      }
      
    } catch (payError) {
      console.log('\n⚠️  pay命令失败，尝试transfer-sui命令...');
      
      // 如果pay命令失败，尝试获取coin objects然后使用transfer-sui
      const gasCommand = `sui client gas ${keyData.suiAddress} --json`;
      const { stdout: gasResult } = await execAsync(gasCommand);
      const gasCoins = JSON.parse(gasResult);
      
      if (gasCoins && gasCoins.length > 0) {
        const suiCoinId = gasCoins[0].coinObjectId;
        console.log(`   使用SUI coin: ${suiCoinId}`);
        
        const transferCommand = `sui client transfer-sui --to ${recipient} --sui-coin-object-id ${suiCoinId} --amount ${amount} --gas-budget 10000000 --json`;
        const { stdout: transferResult } = await execAsync(transferCommand);
        const txResult = JSON.parse(transferResult);
        
        console.log('\n✅ 转账成功:');
        console.log(`   交易哈希: ${txResult.digest}`);
        console.log(`   状态: ${txResult.effects?.status?.status || 'pending'}`);
      } else {
        throw new Error('没有找到可用的SUI coin objects');
      }
    }
    
    // 4. 清理临时密钥
    try {
      await execAsync(`sui keytool delete ${alias}`);
      console.log('\n🧹 临时密钥清理完成');
    } catch (cleanupError) {
      console.warn('\n⚠️  清理临时密钥失败（这是正常的）:', cleanupError.message);
    }
    
    console.log('\n🎉 转账测试完成！');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('\n💥 测试失败:', error.message);
    console.error('详细错误:', error);
  }
}

// 运行测试
testSuiTransfer();
