const { Transaction } = require('@mysten/sui/transactions');
const { getFullnodeUrl, SuiClient } = require('@mysten/sui/client');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');

async function testSuiSDKTransfer() {
  try {
    console.log('🚀 开始使用Sui SDK发送交易...');
    console.log('='.repeat(50));
    
    const privateKey = 'suiprivkey1qqej9ck6jranpg2wpgmv6e726lmyn446x5mn7pr2rj4yskxxzjwtw3y5tpy';
    const recipient = '0x34efb4b67b5f2f11e0eef76c5a94356bab10c71a1c6ef81a90d2689d060f77dd';
    const amount = 100000000; // 0.1 SUI = 100,000,000 mist
    
    // 1. 创建密钥对
    console.log('🔑 创建密钥对...');
    const keypair = Ed25519Keypair.fromSecretKey(privateKey);
    const senderAddress = keypair.getPublicKey().toSuiAddress();
    
    console.log('✅ 密钥对创建成功:');
    console.log(`   发送地址: ${senderAddress}`);
    
    // 2. 创建Sui客户端
    console.log('\n🌐 创建Sui客户端...');
    const client = new SuiClient({ 
      url: getFullnodeUrl('mainnet') 
    });
    console.log('✅ 客户端创建成功，连接到主网');
    
    // 3. 创建交易
    console.log('\n📝 创建交易...');
    const tx = new Transaction();
    
    // 4. 添加交易操作（转账）
    console.log('💰 添加转账操作...');
    console.log(`   接收地址: ${recipient}`);
    console.log(`   转账金额: ${amount} mist (0.1 SUI)`);
    
    // 从gas中分割出指定数量的coin
    const [coin] = tx.splitCoins(tx.gas, [tx.pure('u64', amount)]);
    
    // 将coin转账给接收地址
    tx.transferObjects([coin], tx.pure('address', recipient));
    
    console.log('✅ 交易操作添加完成');
    
    // 5. 签名并执行交易
    console.log('\n✍️  签名并执行交易...');
    
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx
    });
    
    console.log('\n🎉 交易执行成功！');
    console.log('='.repeat(50));
    console.log(`交易哈希: ${result.digest}`);
    console.log(`状态: ${result.effects?.status?.status || 'success'}`);
    
    if (result.effects?.gasUsed) {
      console.log(`消耗Gas: ${result.effects.gasUsed.computationCost}`);
    }
    
    if (result.effects?.status?.status === 'success') {
      console.log('\n✅ 转账成功完成！');
      console.log(`发送方: ${senderAddress}`);
      console.log(`接收方: ${recipient}`);
      console.log(`金额: 0.1 SUI`);
    }
    
  } catch (error) {
    console.error('\n💥 交易失败:', error.message);
    console.error('详细错误:', error);
  }
}

// 运行测试
testSuiSDKTransfer();
