const { AggregatorClient, Env } = require("@cetusprotocol/aggregator-sdk");
const { Transaction } = require("@mysten/sui/transactions");
const BN = require("bn.js");
const { SuiClient, getFullnodeUrl } = require("@mysten/sui/client");
const { Ed25519Keypair } = require("@mysten/sui/keypairs/ed25519");

// 代币地址常量
const TOKEN_TYPES = {
  USDB: "0xe14726c336e81b32328e92afc37345d159f5b550b09fa92bd43640cfdd0a0cfd::usdb::USDB",
  SUI: "0x2::sui::SUI",
  USDC: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
};

// 代币小数位数
const TOKEN_DECIMALS = {
  USDB: 6,
  SUI: 9,
  USDC: 6,
};

// Pyth 预言机 URL
const PYTH_URL = "https://hermes.pyth.network";

/**
 * 初始化 Cetus Aggregator 客户端
 */
function initCetusClient(walletAddress) {
  console.log(`🔧 初始化 Cetus 客户端，钱包地址: ${walletAddress}`);
  
  const suiClient = new SuiClient({ url: getFullnodeUrl("mainnet") });
  
  const aggregatorClient = new AggregatorClient({
    env: Env.Mainnet,
    client: suiClient,
    signer: walletAddress,
    pythUrls: [PYTH_URL],
  });

  console.log(`✅ Cetus 客户端初始化完成`);
  return { suiClient, aggregatorClient };
}

/**
 * 查询最优交换路由
 */
async function findBestRoute(
  client,
  fromToken,
  toToken,
  amount,
  fromDecimals
) {
  // 转换输入金额（支持小数）
  const [integer, decimal = ''] = amount.toString().split('.');
  const paddedDecimal = decimal.padEnd(fromDecimals, '0').slice(0, fromDecimals);
  const inputAmount = new BN(integer + paddedDecimal);
  
  console.log(`🔍 正在查找最优路由...`);
  console.log(`   输入: ${amount} (${inputAmount.toString()} 最小单位)`);
  
  // 查找最优路由
  const routers = await client.findRouters({
    from: fromToken,
    target: toToken,
    amount: inputAmount,
    byAmountIn: true,
    depth: 2, // 允许2跳路由（例如：USDB→USDC→SUI）
    splitCount: 10, // 路由分割数量
  });

  if (!routers) {
    throw new Error("❌ 未找到可用路由");
  }
  
  if (routers.insufficientLiquidity) {
    throw new Error("❌ 流动性不足");
  }

  console.log(`✅ 找到最优路由:`);
  console.log(`   预期输出: ${routers.amountOut.toString()} 最小单位`);
  console.log(`   价格偏差: ${(routers.deviationRatio * 100).toFixed(2)}%`);

  return routers;
}

/**
 * 执行代币兑换（Swap）
 * @param {string} privateKey - 用户的私钥
 * @param {string} fromToken - 源代币符号（例如 'USDB'）
 * @param {string} toToken - 目标代币符号（例如 'SUI'）
 * @param {number} amountIn - 源代币数量
 * @param {number} slippageTolerance - 滑点容忍度（默认 0.01 即 1%）
 * @returns {Object} 返回交易结果和实际获得的代币数量
 */
async function swapTokens(
  privateKey,
  fromToken,
  toToken,
  amountIn,
  slippageTolerance = 0.01
) {
  try {
    console.log(`🔄 开始代币兑换: ${fromToken} → ${toToken}`);
    console.log(`   数量: ${amountIn} ${fromToken}`);
    console.log(`   滑点容忍: ${(slippageTolerance * 100).toFixed(2)}%`);
    
    // 获取密钥对
    const keypair = Ed25519Keypair.fromSecretKey(privateKey);
    const walletAddress = keypair.getPublicKey().toSuiAddress();
    console.log(`   钱包地址: ${walletAddress}`);
    
    // 获取代币类型和精度
    const fromTokenType = TOKEN_TYPES[fromToken];
    const toTokenType = TOKEN_TYPES[toToken];
    const fromDecimals = TOKEN_DECIMALS[fromToken];
    const toDecimals = TOKEN_DECIMALS[toToken];
    
    if (!fromTokenType || !toTokenType) {
      throw new Error(`不支持的代币类型: ${fromToken} 或 ${toToken}`);
    }
    
    // 初始化客户端
    const { suiClient, aggregatorClient } = initCetusClient(walletAddress);
    
    // 查找最优路由
    const routers = await findBestRoute(
      aggregatorClient,
      fromTokenType,
      toTokenType,
      amountIn,
      fromDecimals
    );

    // 检查价格偏差
    if (routers.deviationRatio > 0.02) {
      console.warn(`⚠️  价格偏差较高: ${(routers.deviationRatio * 100).toFixed(2)}%`);
    }

    // 计算预期输出
    const expectedOutputDisplay = (
      routers.amountOut.toNumber() / Math.pow(10, toDecimals)
    ).toFixed(toDecimals === 9 ? 4 : 2);

    console.log(`✅ 找到最优路由:`);
    console.log(`   输入: ${amountIn} ${fromToken}`);
    console.log(`   预期输出: ${expectedOutputDisplay} ${toToken}`);
    console.log(`   价格偏差: ${(routers.deviationRatio * 100).toFixed(2)}%`);
    
    // 构建交易
    const txb = new Transaction();
    await aggregatorClient.fastRouterSwap({
      router: routers,
      txb,
      slippage: slippageTolerance,
    });

    // 设置交易参数
    txb.setSender(walletAddress);
    
    console.log(`🔄 正在执行兑换交易...`);
    
    // 执行交易
    const result = await suiClient.signAndExecuteTransaction({
      transaction: txb,
      signer: keypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    // 检查交易状态
    console.log(`📊 交易结果:`, JSON.stringify({
      digest: result.digest,
      status: result.effects?.status?.status,
      error: result.effects?.status?.error
    }, null, 2));
    
    if (result.effects?.status?.status === "success") {
      console.log(`✅ 兑换成功！`);
      console.log(`   交易哈希: ${result.digest}`);
      console.log(`   获得: ${expectedOutputDisplay} ${toToken}`);
      
      return {
        success: true,
        txHash: result.digest,
        digest: result.digest,
        fromToken,
        toToken,
        amountIn,
        amountOut: parseFloat(expectedOutputDisplay),
        expectedOutput: routers.amountOut.toString(),
        deviationRatio: routers.deviationRatio,
        effects: result.effects,
        objectChanges: result.objectChanges
      };
    } else {
      throw new Error(`交易失败: ${result.effects?.status?.error || "未知错误"}`);
    }

  } catch (error) {
    console.error("❌ 代币兑换失败:", error.message);
    console.error("❌ 错误详情:", error.stack);
    
    // 错误处理建议
    if (error.message.includes("Pyth")) {
      console.log("💡 建议: Pyth 预言机服务不可用，请稍后重试");
    } else if (error.message.includes("slippage")) {
      console.log("💡 建议: 增加滑点容忍度或减少交易金额");
    } else if (error.message.includes("insufficient")) {
      console.log("💡 建议: 检查钱包余额是否足够");
    } else if (error.message.includes("未找到可用路由")) {
      console.log("💡 建议: 检查代币地址是否正确，或尝试减少交易金额");
    } else if (error.message.includes("流动性不足")) {
      console.log("💡 建议: 减少交易金额或等待流动性增加");
    }
    
    throw error;
  }
}

/**
 * 执行代币兑换并转账给指定地址
 * @param {string} privateKey - 用户的私钥
 * @param {string} fromToken - 源代币符号（例如 'USDB'）
 * @param {string} toToken - 目标代币符号（例如 'SUI'）
 * @param {number} amountIn - 源代币数量
 * @param {string} recipientAddress - 接收方地址
 * @param {number} slippageTolerance - 滑点容忍度（默认 0.01 即 1%）
 * @returns {Object} 返回交易结果
 */
async function swapAndTransfer(
  privateKey,
  fromToken,
  toToken,
  amountIn,
  recipientAddress,
  slippageTolerance = 0.01
) {
  try {
    console.log(`🔄 执行 Swap + 转账流程`);
    console.log(`   ${fromToken} → ${toToken}, 数量: ${amountIn}`);
    console.log(`   接收方: ${recipientAddress}`);
    
    // 1. 执行 Swap
    const swapResult = await swapTokens(
      privateKey,
      fromToken,
      toToken,
      amountIn,
      slippageTolerance
    );
    
    if (!swapResult.success) {
      throw new Error('代币兑换失败');
    }
    
    console.log(`✅ 兑换完成，获得 ${swapResult.amountOut} ${toToken}`);
    
    // 2. 转账兑换后的代币给接收方
    console.log(`📤 正在转账 ${toToken} 给 ${recipientAddress}...`);
    
    const keypair = Ed25519Keypair.fromSecretKey(privateKey);
    const senderAddress = keypair.getPublicKey().toSuiAddress();
    const suiClient = new SuiClient({ url: getFullnodeUrl("mainnet") });
    
    // 获取目标代币类型和精度
    const toTokenType = TOKEN_TYPES[toToken];
    const toDecimals = TOKEN_DECIMALS[toToken];
    
    // 获取用户的目标代币
    const coins = await suiClient.getCoins({
      owner: senderAddress,
      coinType: toTokenType
    });
    
    if (!coins.data || coins.data.length === 0) {
      throw new Error(`兑换后未找到 ${toToken} 代币`);
    }
    
    console.log(`💰 找到 ${coins.data.length} 个 ${toToken} 代币对象`);
    
    // 构建转账交易
    const tx = new Transaction();
    
    // 计算转账数量（使用实际兑换获得的数量）
    const transferAmount = Math.floor(swapResult.amountOut * Math.pow(10, toDecimals));
    console.log(`💸 转账数量: ${transferAmount} (${swapResult.amountOut} ${toToken})`);
    
    // 检查是否有足够的代币进行转账
    if (transferAmount <= 0) {
      throw new Error(`转账数量无效: ${transferAmount}`);
    }
    
    // 检查余额是否足够（简化版本）
    const totalBalance = coins.data.reduce((sum, coin) => sum + parseInt(coin.balance), 0);
    console.log(`💰 总 ${toToken} 余额: ${totalBalance / Math.pow(10, toDecimals)} ${toToken}`);
    
    if (totalBalance < transferAmount) {
      throw new Error(`❌ ${toToken} 余额不足，需要 ${transferAmount / Math.pow(10, toDecimals)} ${toToken}，当前 ${totalBalance / Math.pow(10, toDecimals)} ${toToken}`);
    }
    
    // 使用与 server.js 相同的转账逻辑
    if (toToken === 'SUI') {
      // SUI代币转账（从gas中分割）
      console.log(`📤 使用 SUI 转账逻辑: 从 Gas 中分割`);
      const [coin] = tx.splitCoins(tx.gas, [tx.pure('u64', transferAmount)]);
      tx.transferObjects([coin], tx.pure('address', recipientAddress));
    } else {
      // 其他代币转账（USDB, USDC等）
      console.log(`📤 使用 ${toToken} 转账逻辑: 合并代币对象`);
      
      if (coins.data.length === 1) {
        // 只有一个代币对象，直接使用
        console.log(`📦 使用单个代币对象进行转账`);
        const [transferCoin] = tx.splitCoins(coins.data[0].coinObjectId, [tx.pure('u64', transferAmount)]);
        tx.transferObjects([transferCoin], tx.pure('address', recipientAddress));
      } else {
        // 多个代币对象，需要合并
        console.log(`🔗 合并 ${coins.data.length} 个代币对象`);
        const primaryCoin = coins.data[0].coinObjectId;
        const mergeCoins = coins.data.slice(1).map(coin => coin.coinObjectId);
        
        tx.mergeCoins(primaryCoin, mergeCoins);
        
        // 分割出转账金额
        const [transferCoin] = tx.splitCoins(primaryCoin, [tx.pure('u64', transferAmount)]);
        tx.transferObjects([transferCoin], tx.pure('address', recipientAddress));
      }
    }
    
    // 准备执行转账
    console.log(`🚀 准备执行转账交易...`);
    
    // 设置发送方
    tx.setSender(senderAddress);
    
    // 设置 Gas 预算（与 server.js 保持一致）
    tx.setGasBudget(10000000); // 设置 Gas 预算为 0.01 SUI
    
    console.log(`⛽ Gas 预算设置: 0.01 SUI`);
    console.log(`📤 发送方: ${senderAddress}`);
    console.log(`📥 接收方: ${recipientAddress}`);
    
    // 执行转账交易
    const transferResult = await suiClient.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: {
        showEffects: true,
        showObjectChanges: true,
        showInput: true
      }
    });
    
    if (transferResult.effects?.status?.status !== "success") {
      throw new Error(`转账失败: ${transferResult.effects?.status?.error || "未知错误"}`);
    }
    
    console.log(`✅ 转账成功: ${transferResult.digest}`);
    console.log(`📋 完整流程完成！`);
    
    return {
      success: true,
      swapTxHash: swapResult.txHash,
      transferTxHash: transferResult.digest,
      txHash: transferResult.digest, // 主要交易哈希（用于记录）
      digest: transferResult.digest,
      fromToken,
      toToken,
      amountIn,
      amountOut: swapResult.amountOut,
      recipientAddress,
      message: `成功将 ${amountIn} ${fromToken} 兑换为 ${swapResult.amountOut} ${toToken} 并转账给 ${recipientAddress}`
    };
    
  } catch (error) {
    console.error("❌ Swap + 转账流程失败:", error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  swapTokens,
  swapAndTransfer,
  TOKEN_TYPES,
  TOKEN_DECIMALS
};

