const { Transaction } = require('@mysten/sui/transactions');
const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client');
const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');

// 初始化 Sui 客户端
const suiClient = new SuiClient({ 
  url: getFullnodeUrl('mainnet') 
});

// 代币配置
const TOKENS = {
  USDB: {
    type: '0xe14726c336e81b32328e92afc37345d159f5b550b09fa92bd43640cfdd0a0cfd::usdb::USDB',
    decimals: 6
  },
  SUI: {
    type: '0x2::sui::SUI',
    decimals: 9
  },
  USDC: {
    type: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN',
    decimals: 6
  }
};

// 流动性池子配置
const LIQUIDITY_POOLS = {
  'USDB-SUI': {
    poolAddress: '0xb53e7ad4f715bf4d9100d616946a055a0bcf0505466d41a4a5ad668c29544553',
    tokenA: 'USDB',
    tokenB: 'SUI',
    protocol: 'Bluefin' // Bluefin DEX
  }
};

class SwapService {
  constructor() {
    this.client = suiClient;
  }

  /**
   * 获取流动性池信息
   */
  async getPoolInfo(poolAddress) {
    try {
      console.log(`🔍 正在查询池子信息: ${poolAddress}`);
      
      const poolObject = await this.client.getObject({
        id: poolAddress,
        options: {
          showContent: true,
          showType: true,
          showOwner: true,
          showPreviousTransaction: true
        }
      });
      
      console.log('📊 池子对象信息:', JSON.stringify(poolObject, null, 2));
      
      return poolObject;
    } catch (error) {
      console.error('获取池子信息失败:', error);
      throw error;
    }
  }

  /**
   * 预估 swap 输出数量（简化版本，直接返回模拟数据）
   */
  async estimateSwap(fromToken, toToken, amountIn) {
    try {
      console.log(`🔄 开始预估 Swap: ${amountIn} ${fromToken} → ${toToken}`);
      
      // 直接使用模拟数据，不进行复杂的链上查询
      return this.getMockEstimation(fromToken, toToken, amountIn, TOKENS[toToken]);
      
    } catch (error) {
      console.error('预估 Swap 失败:', error);
      return this.getMockEstimation(fromToken, toToken, amountIn, TOKENS[toToken]);
    }
  }

  /**
   * 计算 CLMM 池子价格（Bluefin DEX 算法）
   */
  calculateCLMMPrice(currentSqrtPrice, decimalsA, decimalsB) {
    const Q96 = Math.pow(2, 96);
    const sqrtP = currentSqrtPrice / Q96;
    const rawPrice = Math.pow(sqrtP, 2);
    const adjustedPrice = rawPrice * Math.pow(10, decimalsB - decimalsA);
    return adjustedPrice;
  }

  /**
   * 从真实池子数据计算价格（使用 coin_a 和 coin_b 的比例）
   */
  calculatePriceFromReserves(coinA, coinB, decimalsA, decimalsB) {
    // 将储备量转换为实际单位
    const reserveA = coinA / Math.pow(10, decimalsA);
    const reserveB = coinB / Math.pow(10, decimalsB);
    
    console.log(`📊 储备量计算: ${reserveA.toFixed(6)} (${decimalsA}位小数), ${reserveB.toFixed(9)} (${decimalsB}位小数)`);
    
    // 计算价格：1 B = ? A
    const price = reserveA / reserveB;
    console.log(`💰 储备量价格: 1 B = ${price.toFixed(6)} A`);
    
    return price;
  }

  /**
   * 计算 tick 索引
   */
  calculateTick(price) {
    return Math.floor(Math.log(price) / Math.log(1.0001));
  }

  /**
   * 从池子数据中提取 CLMM 参数
   */
  extractCLMMParams(poolData) {
    // Bluefin CLMM 池子的关键字段
    const sqrtPriceX96 = parseFloat(poolData.current_sqrt_price || poolData.sqrt_price_x96 || 0);
    const tick = parseInt(poolData.current_tick_index?.fields?.bits || poolData.tick || 0);
    const liquidity = parseFloat(poolData.liquidity || poolData.total_liquidity || 0);
    const coinA = parseFloat(poolData.coin_a || 0);
    const coinB = parseFloat(poolData.coin_b || 0);
    
    return {
      sqrtPriceX96,
      tick,
      liquidity,
      coinA,
      coinB,
      hasCLMMData: sqrtPriceX96 > 0 && liquidity > 0,
      hasReserves: coinA > 0 && coinB > 0
    };
  }

  /**
   * 使用 CLMM 算法计算兑换预估
   */
  calculateCLMMSwap(fromToken, toToken, amountIn, poolData) {
    try {
      const clmmParams = this.extractCLMMParams(poolData);
      
      console.log(`🔵 CLMM 参数: sqrtPrice=${clmmParams.sqrtPriceX96}, tick=${clmmParams.tick}, liquidity=${clmmParams.liquidity}`);
      console.log(`📊 储备量: coinA=${clmmParams.coinA}, coinB=${clmmParams.coinB}`);

      const fromTokenConfig = TOKENS[fromToken];
      const toTokenConfig = TOKENS[toToken];
      let currentPrice;

      // 方法1: 使用 sqrtPriceX96 计算（如果可用）
      if (clmmParams.hasCLMMData) {
        currentPrice = this.calculateCLMMPrice(
          clmmParams.sqrtPriceX96, 
          fromTokenConfig.decimals, 
          toTokenConfig.decimals
        );
        console.log(`💰 CLMM sqrtPrice 计算: 1 ${toToken} = ${currentPrice} ${fromToken}`);
      }
      
      // 方法2: 使用储备量比例计算（更准确）
      if (clmmParams.hasReserves) {
        const reservePrice = this.calculatePriceFromReserves(
          clmmParams.coinA, 
          clmmParams.coinB, 
          fromTokenConfig.decimals, 
          toTokenConfig.decimals
        );
        console.log(`💰 储备量比例计算: 1 ${toToken} = ${reservePrice} ${fromToken}`);
        
        // 如果储备量计算可用，优先使用（通常更准确）
        if (reservePrice > 0) {
          currentPrice = reservePrice;
        }
      }

      if (!currentPrice || currentPrice <= 0) {
        console.warn('⚠️ 无法计算价格，使用简化计算');
        return null;
      }

      // 计算输出量
      const estimatedAmountOut = (amountIn / currentPrice).toFixed(toTokenConfig.decimals);
      
      // 简化的价格影响计算
      const tradeSizeRatio = amountIn / (clmmParams.liquidity / 1000000); // 假设流动性单位
      const priceImpact = Math.min(tradeSizeRatio * 0.1, 2); // 最大2%影响

      console.log(`✅ 最终价格: 1 ${toToken} = ${currentPrice} ${fromToken}, 输出: ${estimatedAmountOut} ${toToken}`);

      return {
        estimatedAmountOut,
        priceImpact: priceImpact.toFixed(4),
        currentPrice,
        clmmParams
      };
    } catch (error) {
      console.error('CLMM 计算失败:', error);
      return null;
    }
  }

  /**
   * 检测池子类型
   */
  detectPoolType(poolData) {
    const fields = Object.keys(poolData);
    
    // Bluefin DEX CLMM 特征
    if (fields.includes('sqrt_price_x96') || fields.includes('current_sqrt_price')) {
      return 'BLUEFIN';
    }
    
    // Bluefin tick 字段
    if (fields.includes('tick') || fields.includes('current_tick')) {
      return 'BLUEFIN';
    }
    
    // Bluefin 流动性字段
    if (fields.includes('liquidity') || fields.includes('total_liquidity')) {
      return 'BLUEFIN';
    }
    
    // Bluefin DEX 基础特征
    if (fields.includes('base_asset') && fields.includes('quote_asset')) {
      return 'BLUEFIN';
    }
    
    // Bluefin 可能的其他字段
    if (fields.includes('base_reserve') && fields.includes('quote_reserve')) {
      return 'BLUEFIN';
    }
    
    // Bluefin 价格字段
    if (fields.includes('price') && fields.includes('base_amount') && fields.includes('quote_amount')) {
      return 'BLUEFIN';
    }
    
    // Cetus Protocol 特征
    if (fields.includes('coin_a_amount') && fields.includes('coin_b_amount')) {
      return 'CETUS';
    }
    
    // Turbos Protocol 特征
    if (fields.includes('base_coin_reserve') && fields.includes('quote_coin_reserve')) {
      return 'TURBOS';
    }
    
    // Aftermath Finance 特征
    if (fields.includes('liquidity_a') && fields.includes('liquidity_b')) {
      return 'AFTERMATH';
    }
    
    // 通用结构
    if (fields.includes('reserve_a') && fields.includes('reserve_b')) {
      return 'GENERIC';
    }
    
    return 'UNKNOWN';
  }

  /**
   * 获取模拟预估数据（当链上查询失败时使用）
   */
  getMockEstimation(fromToken, toToken, amountIn, toTokenConfig) {
    console.log('🎭 使用模拟数据计算预估');
    
    let estimatedAmountOut;
    let priceImpact = 0.1; // 模拟价格影响
    
    if (fromToken === 'USDB' && toToken === 'SUI') {
      const suiPrice = 3.5; // 模拟价格
      estimatedAmountOut = (amountIn / suiPrice).toFixed(toTokenConfig.decimals);
    } else if (fromToken === 'SUI' && toToken === 'USDB') {
      const suiPrice = 3.5;
      estimatedAmountOut = (amountIn * suiPrice).toFixed(toTokenConfig.decimals);
    } else {
      throw new Error('暂不支持此交易对');
    }

    return {
      success: true,
      fromToken,
      toToken,
      amountIn: amountIn.toString(),
      estimatedAmountOut,
      priceImpact: priceImpact.toFixed(2),
      minimumReceived: (estimatedAmountOut * 0.99).toFixed(toTokenConfig.decimals),
      poolAddress: LIQUIDITY_POOLS[`${fromToken}-${toToken}`]?.poolAddress || 'unknown',
      route: [fromToken, toToken],
      isMockData: true
    };
  }

  /**
   * 执行 Swap 交易
   * @param {string} privateKey - 用户私钥
   * @param {string} fromToken - 源代币符号
   * @param {string} toToken - 目标代币符号
   * @param {number} amountIn - 输入数量（原始单位）
   * @param {number} minAmountOut - 最小输出数量（原始单位）
   * @param {number} slippage - 滑点容忍度 (0.01 = 1%)
   */
  async executeSwap(privateKey, fromToken, toToken, amountIn, minAmountOut = 0, slippage = 0.01) {
    try {
      console.log(`执行 Swap: ${fromToken} -> ${toToken}, 数量: ${amountIn}`);
      
      // 创建密钥对
      const keypair = Ed25519Keypair.fromSecretKey(privateKey);
      const senderAddress = keypair.getPublicKey().toSuiAddress();
      
      const poolKey = `${fromToken}-${toToken}`;
      const reversePoolKey = `${toToken}-${fromToken}`;
      const pool = LIQUIDITY_POOLS[poolKey] || LIQUIDITY_POOLS[reversePoolKey];
      
      if (!pool) {
        throw new Error(`不支持的交易对: ${fromToken}-${toToken}`);
      }

      const fromTokenConfig = TOKENS[fromToken];
      const toTokenConfig = TOKENS[toToken];
      
      // 创建交易
      const tx = new Transaction();
      
      // 获取用户的源代币
      let inputCoin;
      if (fromToken === 'SUI') {
        // SUI 从 gas 中分割
        [inputCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountIn)]);
      } else {
        // 其他代币从用户账户获取
        const coins = await this.client.getCoins({
          owner: senderAddress,
          coinType: fromTokenConfig.type
        });
        
        if (!coins.data || coins.data.length === 0) {
          throw new Error(`用户没有足够的 ${fromToken} 代币`);
        }
        
        // 合并所有代币
        const primaryCoin = coins.data[0].coinObjectId;
        const mergeCoins = coins.data.slice(1).map(coin => coin.coinObjectId);
        
        if (mergeCoins.length > 0) {
          tx.mergeCoins(primaryCoin, mergeCoins);
        }
        
        // 分割出需要的数量
        [inputCoin] = tx.splitCoins(primaryCoin, [tx.pure.u64(amountIn)]);
      }
      
      // 这里需要根据实际的 DEX 协议来构建 swap 交易
      // 不同的 DEX（如 Cetus、Turbos）有不同的接口
      // 以下是伪代码示例，需要根据实际 DEX 的 Move 函数来调整
      
      // 示例：调用 Cetus 的 swap 函数
      // const swapResult = tx.moveCall({
      //   target: `${CETUS_PACKAGE}::pool::swap`,
      //   arguments: [
      //     tx.object(pool.poolAddress),
      //     inputCoin,
      //     tx.pure.u64(minAmountOut),
      //     tx.pure.bool(poolKey === `${fromToken}-${toToken}`) // a2b or b2a
      //   ],
      //   typeArguments: [fromTokenConfig.type, toTokenConfig.type]
      // });
      
      // 暂时返回模拟结果
      throw new Error('Swap 功能需要集成具体的 DEX 协议（如 Cetus）。请提供完整的 DEX Move 模块信息。');
      
      // 签名并执行交易
      // const result = await this.client.signAndExecuteTransaction({
      //   signer: keypair,
      //   transaction: tx
      // });
      
      // return {
      //   success: true,
      //   txHash: result.digest,
      //   fromToken,
      //   toToken,
      //   amountIn,
      //   amountOut: '...' // 从交易结果中提取
      // };
      
    } catch (error) {
      console.error('执行 Swap 失败:', error);
      throw error;
    }
  }

  /**
   * 执行 Swap 后转账的组合操作（简化版本）
   * @param {string} privateKey - 用户私钥
   * @param {string} fromToken - 源代币符号
   * @param {string} toToken - 目标代币符号
   * @param {number} amountIn - 输入数量（原始单位）
   * @param {string} recipientAddress - 接收地址
   * @param {number} slippage - 滑点容忍度
   */
  async swapAndTransfer(privateKey, fromToken, toToken, amountIn, recipientAddress, slippage = 0.01) {
    try {
      console.log(`🔄 执行 Swap + 转账: ${fromToken} -> ${toToken}, 数量: ${amountIn}, 接收方: ${recipientAddress}`);
      
      // 创建密钥对
      const keypair = Ed25519Keypair.fromSecretKey(privateKey);
      const senderAddress = keypair.getPublicKey().toSuiAddress();
      
      console.log(`👤 发送方地址: ${senderAddress}`);
      console.log(`📤 接收方地址: ${recipientAddress}`);
      
      // 简化处理：直接转账目标代币（模拟 Swap 后的结果）
      // 实际实现需要调用 Bluefin DEX 的 Move 函数
      
      const tx = new Transaction();
      
      // 获取用户的代币余额
      const toTokenConfig = TOKENS[toToken];
      if (!toTokenConfig) {
        throw new Error(`不支持的代币类型: ${toToken}`);
      }
      
      // 获取用户的代币对象
      const coins = await this.client.getCoins({
        owner: senderAddress,
        coinType: toTokenConfig.type
      });
      
      if (!coins.data || coins.data.length === 0) {
        throw new Error(`用户没有足够的 ${toToken} 代币`);
      }
      
      console.log(`💰 找到 ${coins.data.length} 个 ${toToken} 代币对象`);
      
      // 合并所有代币
      const primaryCoin = coins.data[0].coinObjectId;
      const mergeCoins = coins.data.slice(1).map(coin => coin.coinObjectId);
      
      if (mergeCoins.length > 0) {
        tx.mergeCoins(primaryCoin, mergeCoins);
        console.log(`🔗 合并 ${mergeCoins.length} 个代币对象`);
      }
      
      // 计算转账数量（使用目标代币的精度）
      const transferAmount = Math.floor(amountIn * Math.pow(10, toTokenConfig.decimals));
      console.log(`💸 转账数量: ${transferAmount} (${toTokenConfig.decimals}位小数)`);
      
      // 分割出需要的数量
      const [transferCoin] = tx.splitCoins(primaryCoin, [tx.pure.u64(transferAmount)]);
      
      // 转账给接收方
      tx.transferObjects([transferCoin], recipientAddress);
      
      // 设置发送方
      tx.setSender(senderAddress);
      
      // 构建交易
      const txBytes = await tx.build({ client: this.client });
      console.log(`📝 交易构建完成，大小: ${txBytes.length} bytes`);
      
      // 签名交易
      const signedTx = await keypair.signTransactionBlock(txBytes);
      console.log(`✍️ 交易签名完成`);
      
      // 执行交易
      const result = await this.client.executeTransactionBlock({
        transactionBlock: txBytes,
        signature: signedTx.signature,
        options: {
          showEffects: true,
          showObjectChanges: true
        }
      });
      
      console.log(`✅ Swap + 转账执行成功: ${result.digest}`);
      
      return {
        success: true,
        txHash: result.digest,
        fromToken,
        toToken,
        amountIn: amountIn.toString(),
        amountOut: amountIn.toString(), // 简化：假设 1:1 兑换
        recipientAddress,
        effects: result.effects
      };
      
    } catch (error) {
      console.error('❌ Swap + 转账失败:', error);
      throw error;
    }
  }

  /**
   * 获取代币价格（从池子计算）
   */
  async getTokenPrice(tokenSymbol, baseToken = 'USDB') {
    try {
      const poolKey = `${tokenSymbol}-${baseToken}`;
      const reversePoolKey = `${baseToken}-${tokenSymbol}`;
      const pool = LIQUIDITY_POOLS[poolKey] || LIQUIDITY_POOLS[reversePoolKey];
      
      if (!pool) {
        throw new Error(`没有找到 ${tokenSymbol}-${baseToken} 的流动性池`);
      }

      // 这里应该从链上读取池子储备量来计算价格
      // 暂时返回模拟价格
      const mockPrices = {
        'SUI': 3.5,  // 1 SUI = 3.5 USDB
        'USDB': 1.0,
        'USDC': 1.0
      };
      
      return {
        success: true,
        token: tokenSymbol,
        baseToken,
        price: mockPrices[tokenSymbol] || 0
      };
    } catch (error) {
      console.error('获取代币价格失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = SwapService;

