const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const { createClient } = require('@supabase/supabase-js');
const BucketProtocolService = require('./bucket_protocol_service');
const { Transaction } = require('@mysten/sui/transactions');
const { getFullnodeUrl, SuiClient } = require('@mysten/sui/client');
const { Ed25519Keypair } = require('@mysten/sui.js/keypairs/ed25519');
require('dotenv').config();

const execAsync = promisify(exec);

// Sui客户端配置
const suiClient = new SuiClient({ 
  url: getFullnodeUrl('mainnet') 
});

const app = express();
const PORT = process.env.PORT || 5001;

// 初始化Supabase客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

// 初始化Bucket Protocol服务
const bucketService = new BucketProtocolService();

// 中间件配置
app.use(cors());
app.use(express.json());

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000 // 限制每个IP 15分钟内最多1000个请求
});
app.use('/api/', limiter);

// JWT token验证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: '访问令牌缺失，请先登录' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { 
      userId: decoded.userId, 
      username: decoded.username 
    };
    next();
  } catch (error) {
    console.error('Token验证失败:', error);
    return res.status(403).json({ error: '访问令牌无效或已过期，请重新登录' });
  }
};

// 加密/解密函数
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-32-chars!!'; // 32字符密钥

// 使用Sui SDK构建和发送交易（支持不同代币类型）
async function buildAndSendTransferTx(privateKey, recipient, amount = 1000000, tokenType = 'SUI') {
  try {
    // 1. 创建密钥对
    const keypair = Ed25519Keypair.fromSecretKey(privateKey);
    const senderAddress = keypair.getPublicKey().toSuiAddress();
    
    console.log('创建密钥对成功:', senderAddress);
    console.log(`转账类型: ${tokenType}, 金额: ${amount}, 接收方: ${recipient}`);
    
    // 2. 创建交易
    const tx = new Transaction();
    
    // 3. 根据代币类型添加转账操作
    if (tokenType === 'SUI') {
      // SUI代币转账（从gas中分割）
      const [coin] = tx.splitCoins(tx.gas, [tx.pure('u64', amount)]);
      tx.transferObjects([coin], tx.pure('address', recipient));
    } else if (tokenType === 'USDB') {
      // USDB代币转账
      const usdbType = '0xe14726c336e81b32328e92afc37345d159f5b550b09fa92bd43640cfdd0a0cfd::usdb::USDB';
      
      // 获取用户的USDB代币对象
      const usdbCoins = await suiClient.getCoins({
        owner: senderAddress,
        coinType: usdbType
      });
      
      if (!usdbCoins.data || usdbCoins.data.length === 0) {
        throw new Error('用户没有足够的USDB代币');
      }
      
      // 合并所有USDB代币
      const primaryCoin = usdbCoins.data[0].coinObjectId;
      const mergeCoins = usdbCoins.data.slice(1).map(coin => coin.coinObjectId);
      
      if (mergeCoins.length > 0) {
        tx.mergeCoins(primaryCoin, mergeCoins);
      }
      
      // 分割出指定金额
      const [coin] = tx.splitCoins(primaryCoin, [tx.pure('u64', amount)]);
      tx.transferObjects([coin], tx.pure('address', recipient));
    } else {
      throw new Error(`不支持的代币类型: ${tokenType}`);
    }
    
    console.log('交易构建完成，开始发送...');
    
    // 4. 签名并执行交易
    const result = await suiClient.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx
    });
    
    console.log('交易发送成功:', result.digest);
    
    return {
      digest: result.digest,
      effects: result.effects,
      address: senderAddress
    };
    
  } catch (error) {
    console.error('Sui SDK交易失败:', error);
    throw error;
  }
}

const encrypt = (text) => {
  // 使用AES-256-CBC加密（现代方法）
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (encryptedText) => {
  // 支持多种私钥格式：
  // 1. 未加密的Sui格式：suiprivkey1...
  // 2. 未加密的十六进制格式：0x...
  // 3. AES加密格式：iv:encrypted_data
  // 4. Base64编码格式：base64_string
  
  // 检查是否已经是未加密的格式
  if (encryptedText.startsWith('suiprivkey1') || encryptedText.startsWith('0x')) {
    return encryptedText; // 直接返回未加密的私钥
  }
  
  if (encryptedText.includes(':')) {
    // AES加密格式
    try {
      const parts = encryptedText.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('AES解密失败:', error);
      return encryptedText; // 返回原始数据
    }
  } else {
    // Base64编码格式
    try {
      return Buffer.from(encryptedText, 'base64').toString('utf-8');
    } catch (error) {
      console.error('Base64解密失败:', error);
      return encryptedText; // 返回原始数据
    }
  }
};

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'ESP32传感器监控系统后端API'
  });
});

// 用户认证相关API
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: '用户名、邮箱和密码都是必填项' });
    }

    // 检查用户是否已存在
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: '用户名或邮箱已存在' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        username,
        email,
        password: hashedPassword,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('注册错误:', error);
      return res.status(500).json({ error: '注册失败' });
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { userId: newUser.id, username: newUser.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: '注册成功',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      }
    });

  } catch (error) {
    console.error('注册异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码都是必填项' });
    }

    // 查找用户
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .or(`username.eq.${username},email.eq.${username}`)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('登录异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 钱包管理API
app.get('/api/wallets', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取钱包错误:', error);
      return res.status(500).json({ error: '获取钱包失败' });
    }

    res.json({ wallets: data });

  } catch (error) {
    console.error('获取钱包异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/wallets', authenticateToken, async (req, res) => {
  try {
    const { walletName } = req.body;

    if (!walletName) {
      return res.status(400).json({ error: '钱包名称是必填项' });
    }

    // 使用Sui SDK真实生成钱包（与generate_sui_wallet.js保持一致）
    const keypair = Ed25519Keypair.generate();
    const address = keypair.getPublicKey().toSuiAddress();
    const privateKey = keypair.getSecretKey().toString('hex');
    const publicKey = keypair.getPublicKey().toBase64();
    const encryptedPrivateKey = encrypt(privateKey);

    // 将其他钱包设为非活跃状态
    await supabase
      .from('wallets')
      .update({ is_active: false })
      .eq('user_id', req.user.userId);

    // 创建新钱包
    const { data, error } = await supabase
      .from('wallets')
      .insert([{
        user_id: req.user.userId,
        wallet_name: walletName,
        address,
        private_key: encryptedPrivateKey,
        public_key: publicKey,
        is_active: true,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('创建钱包错误:', error);
      return res.status(500).json({ error: '创建钱包失败' });
    }

    res.json({
      message: '钱包创建成功',
      wallet: {
        ...data,
        private_key: privateKey // 返回未加密的私钥给前端
      }
    });

  } catch (error) {
    console.error('创建钱包异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/wallets/import', authenticateToken, async (req, res) => {
  try {
    const { walletName, privateKey } = req.body;

    if (!walletName || !privateKey) {
      return res.status(400).json({ error: '钱包名称和私钥都是必填项' });
    }

    // 验证私钥格式（只支持Sui格式的私钥）
    const isSuiFormat = privateKey.startsWith('suiprivkey1');
    
    if (!isSuiFormat) {
      return res.status(400).json({ error: '私钥格式不正确，只支持Sui格式(suiprivkey1...)' });
    }

    // 从Sui私钥推导地址和公钥
    let address, publicKey;
    
    try {
      // 使用Sui CLI从私钥推导地址
      const alias = `temp-${Date.now()}`;
      const command = `sui keytool import "${privateKey}" ed25519 --alias ${alias} --json`;
      const { stdout } = await execAsync(command);
      const result = JSON.parse(stdout);
      
      address = result.suiAddress;
      publicKey = result.publicBase64Key;
      
      // 清理临时导入的密钥（Sui CLI可能没有delete命令，忽略错误）
      try {
        await execAsync(`sui keytool delete ${alias}`);
      } catch (cleanupError) {
        console.warn('清理临时密钥失败（这是正常的，Sui CLI可能没有delete命令）:', cleanupError.message);
      }
      
    } catch (error) {
      console.error('Sui私钥解析失败:', error);
      return res.status(400).json({ error: 'Sui私钥格式不正确或已损坏' });
    }
    const encryptedPrivateKey = encrypt(privateKey);

    // 将其他钱包设为非活跃状态
    await supabase
      .from('wallets')
      .update({ is_active: false })
      .eq('user_id', req.user.userId);

    // 创建导入的钱包
    const { data, error } = await supabase
      .from('wallets')
      .insert([{
        user_id: req.user.userId,
        wallet_name: walletName,
        address,
        private_key: encryptedPrivateKey,
        public_key: publicKey,
        is_active: true,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('导入钱包错误:', error);
      return res.status(500).json({ error: '导入钱包失败' });
    }

    res.json({
      message: '钱包导入成功',
      wallet: {
        ...data,
        private_key: privateKey // 返回未加密的私钥给前端
      }
    });

  } catch (error) {
    console.error('导入钱包异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.put('/api/wallets/:id/activate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 将其他钱包设为非活跃状态（限制在同一用户下）
    await supabase
      .from('wallets')
      .update({ is_active: false })
      .eq('user_id', req.user.userId)
      .neq('id', id);

    // 激活指定钱包（限制在同一用户下）
    const { data: updateData, error } = await supabase
      .from('wallets')
      .update({ is_active: true })
      .eq('id', id)
      .eq('user_id', req.user.userId)
      .select();

    if (error) {
      console.error('激活钱包错误:', error);
      return res.status(500).json({ error: '激活钱包失败' });
    }

    if (!updateData || updateData.length === 0) {
      return res.status(404).json({ error: '钱包不存在或不属于当前用户' });
    }

    res.json({ message: '钱包激活成功' });

  } catch (error) {
    console.error('激活钱包异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/wallets/:id/private-key', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('wallets')
      .select('private_key')
      .eq('id', id)
      .eq('user_id', req.user.userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: '钱包不存在' });
    }

    const decryptedPrivateKey = decrypt(data.private_key);

    res.json({ private_key: decryptedPrivateKey });

  } catch (error) {
    console.error('获取私钥异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.delete('/api/wallets/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('wallets')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.userId);

    if (error) {
      console.error('删除钱包错误:', error);
      return res.status(500).json({ error: '删除钱包失败' });
    }

    res.json({ message: '钱包删除成功' });

  } catch (error) {
    console.error('删除钱包异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 定投计划API
app.get('/api/dca-plans', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dca_plans')
      .select('*')
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取定投计划错误:', error);
      return res.status(500).json({ error: '获取定投计划失败' });
    }

    res.json({ dcaPlans: data });

  } catch (error) {
    console.error('获取定投计划异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/dca-plans', authenticateToken, async (req, res) => {
  try {
    const { planName, tokenSymbol, amount, targetAddress, bucketStrategy } = req.body;

    if (!planName || !tokenSymbol || !amount || !bucketStrategy) {
      return res.status(400).json({ error: '计划名称、币种、数量和策略都是必填项' });
    }

    // 传统转账模式需要接收地址
    if (bucketStrategy === 'NONE' && !targetAddress) {
      return res.status(400).json({ error: '传统转账模式需要填写接收地址' });
    }

    const { data, error } = await supabase
      .from('dca_plans')
      .insert([{
        user_id: req.user.userId,
        plan_name: planName,
        token_symbol: tokenSymbol,
        amount: parseFloat(amount),
        target_address: targetAddress || 'bucket-protocol',
        bucket_strategy: bucketStrategy,
        is_active: false,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('创建定投计划错误:', error);
      return res.status(500).json({ error: '创建定投计划失败' });
    }

    res.json({
      message: '定投计划创建成功',
      dcaPlan: data
    });

  } catch (error) {
    console.error('创建定投计划异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.put('/api/dca-plans/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { planName, tokenSymbol, amount, targetAddress, bucketStrategy } = req.body;

    const updateData = {};
    if (planName !== undefined) updateData.plan_name = planName;
    if (tokenSymbol !== undefined) updateData.token_symbol = tokenSymbol;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (targetAddress !== undefined) updateData.target_address = targetAddress;
    if (bucketStrategy !== undefined) updateData.bucket_strategy = bucketStrategy;

    const { data, error } = await supabase
      .from('dca_plans')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', req.user.userId)
      .select()
      .single();

    if (error) {
      console.error('更新定投计划错误:', error);
      return res.status(500).json({ error: '更新定投计划失败' });
    }

    if (!data) {
      return res.status(404).json({ error: '定投计划不存在' });
    }

    res.json({
      message: '定投计划更新成功',
      dcaPlan: data
    });

  } catch (error) {
    console.error('更新定投计划异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.put('/api/dca-plans/:id/start', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('dca_plans')
      .update({ is_active: true })
      .eq('id', id)
      .eq('user_id', req.user.userId)
      .select()
      .single();

    if (error) {
      console.error('开始定投错误:', error);
      return res.status(500).json({ error: '开始定投失败' });
    }

    if (!data) {
      return res.status(404).json({ error: '定投计划不存在' });
    }

    res.json({
      message: '定投计划已开始',
      dcaPlan: data
    });

  } catch (error) {
    console.error('开始定投异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.put('/api/dca-plans/:id/stop', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('dca_plans')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', req.user.userId)
      .select()
      .single();

    if (error) {
      console.error('停止定投错误:', error);
      return res.status(500).json({ error: '停止定投失败' });
    }

    if (!data) {
      return res.status(404).json({ error: '定投计划不存在' });
    }

    res.json({
      message: '定投计划已停止',
      dcaPlan: data
    });

  } catch (error) {
    console.error('停止定投异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.delete('/api/dca-plans/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 先检查定投计划是否存在且属于当前用户
    const { data: plan, error: checkError } = await supabase
      .from('dca_plans')
      .select('id')
      .eq('id', id)
      .eq('user_id', req.user.userId)
      .single();

    if (checkError || !plan) {
      return res.status(404).json({ error: '定投计划不存在或不属于当前用户' });
    }

    const { error } = await supabase
      .from('dca_plans')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.userId);

    if (error) {
      console.error('删除定投计划错误:', error);
      return res.status(500).json({ error: '删除定投计划失败' });
    }

    res.json({ message: '定投计划删除成功' });

  } catch (error) {
    console.error('删除定投计划异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/dca-plans/:id/balance', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // 获取定投计划信息
    const { data: plan, error: planError } = await supabase
      .from('dca_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.userId)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: '定投计划不存在' });
    }

    // 获取用户活跃钱包
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', req.user.userId)
      .eq('is_active', true)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ error: '未找到活跃钱包' });
    }

    let balance = 0;

    // 如果是Bucket理财策略，查询储蓄池余额
    if (plan.bucket_strategy !== 'NONE') {
      try {
        const savings = await bucketService.getUserSavings(wallet.address);
        
        // 查找对应的储蓄池类型
        const lpType = '0x38f61c75fa8407140294c84167dd57684580b55c3066883b48dedc344b1cde1e::susdb::SUSDB';
        
        if (savings && savings[lpType]) {
          // 获取LP余额并转换为USDB余额（LP余额约等于USDB余额）
          const lpBalance = parseFloat(savings[lpType].lpBalance) || 0;
          balance = lpBalance / 1000000; // 转换为USDB单位（6位精度）
        }
      } catch (error) {
        console.error('获取储蓄池余额失败:', error);
        // 如果获取失败，返回0余额
        balance = 0;
      }
    }

    res.json({ balance });

  } catch (error) {
    console.error('获取计划余额异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/dca-plans/:id/withdraw', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, planId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: '提币金额必须大于0' });
    }

    // 获取定投计划信息
    const { data: plan, error: planError } = await supabase
      .from('dca_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.userId)
      .single();

    if (planError || !plan) {
      return res.status(404).json({ error: '定投计划不存在' });
    }

    // 获取用户活跃钱包
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', req.user.userId)
      .eq('is_active', true)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ error: '未找到活跃钱包' });
    }

    // 只有Bucket理财策略才能提币
    if (plan.bucket_strategy === 'NONE') {
      return res.status(400).json({ error: '传统转账模式不支持提币功能' });
    }

    try {
      const decryptedPrivateKey = decrypt(wallet.private_key);
      
      // 执行提币操作
      const result = await bucketService.executeWithdraw(
        wallet.address,
        parseFloat(amount),
        plan.bucket_strategy,
        decryptedPrivateKey
      );

      if (result.success) {
        // 记录提币交易
        const { error: txError } = await supabase
          .from('transactions')
          .insert([{
            user_id: req.user.userId,
            dca_plan_id: plan.id,
            wallet_address: wallet.address,
            recipient_address: wallet.address, // 提币到自己的钱包
            amount: parseFloat(amount),
            token_symbol: plan.token_symbol,
            transaction_type: 'bucket_withdraw',
            tx_hash: result.hash,
            status: 'confirmed',
            created_at: new Date().toISOString()
          }]);

        if (txError) {
          console.error('记录提币交易失败:', txError);
        }

        res.json({
          success: true,
          message: '提币成功',
          hash: result.hash
        });
      } else {
        res.status(400).json({ error: result.error || '提币失败' });
      }

    } catch (error) {
      console.error('提币操作失败:', error);
      res.status(500).json({ error: error.message || '提币操作失败' });
    }

  } catch (error) {
    console.error('提币异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// Bucket Protocol相关API
app.get('/api/bucket/strategies', authenticateToken, async (req, res) => {
  try {
    const strategies = bucketService.getStrategies();
    res.json({ strategies });

  } catch (error) {
    console.error('获取策略异常:', error);
    res.status(500).json({ error: '获取策略失败' });
  }
});

app.get('/api/bucket/saving-pools', authenticateToken, async (req, res) => {
  try {
    const pools = await bucketService.getSavingPools();
    res.json({ pools });

  } catch (error) {
    console.error('获取储蓄池异常:', error);
    res.status(500).json({ error: '获取储蓄池失败' });
  }
});

app.get('/api/bucket/user-savings/:address', authenticateToken, async (req, res) => {
  try {
    const { address } = req.params;
    
    // 获取用户活跃钱包的私钥
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', req.user.userId)
      .eq('is_active', true)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ error: '未找到活跃钱包' });
    }

    const decryptedPrivateKey = decrypt(wallet.private_key);
    const savings = await bucketService.getUserSavings(address);
    
    res.json({ savings });

  } catch (error) {
    console.error('获取用户储蓄异常:', error);
    res.status(500).json({ error: '获取用户储蓄失败' });
  }
});

app.get('/api/bucket/apr', authenticateToken, async (req, res) => {
  try {
    const aprData = await bucketService.getAPR();
    res.json(aprData);

  } catch (error) {
    console.error('获取APR异常:', error);
    res.status(500).json({ error: '获取APR失败' });
  }
});

app.post('/api/bucket/calculate-return', authenticateToken, async (req, res) => {
  try {
    const { strategy, amount, timeInDays } = req.body;
    
    const calculation = await bucketService.calculateExpectedReturn(
      strategy,
      parseFloat(amount),
      timeInDays || 365
    );
    
    res.json({ calculation });

  } catch (error) {
    console.error('计算收益异常:', error);
    res.status(500).json({ error: '计算收益失败' });
  }
});

app.post('/api/bucket/execute-dca', authenticateToken, async (req, res) => {
  try {
    const { userAddress, amount, strategy } = req.body;

    if (!userAddress || !amount || !strategy) {
      return res.status(400).json({ error: '用户地址、金额和策略都是必填项' });
    }

    // 获取用户活跃钱包的私钥
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', req.user.userId)
      .eq('is_active', true)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({ error: '未找到活跃钱包' });
    }

    const decryptedPrivateKey = decrypt(wallet.private_key);
    
    // 执行Bucket定投
    const result = await bucketService.executeSavingPoolDCA(
      userAddress,
      parseFloat(amount),
      strategy,
      'USDB',
      decryptedPrivateKey
    );

    if (result.success) {
      // 记录定投交易
      const { error: txError } = await supabase
        .from('transactions')
        .insert([{
          user_id: req.user.userId,
          wallet_address: wallet.address,
          recipient_address: 'bucket-protocol',
          amount: parseFloat(amount),
          token_symbol: 'USDB',
          transaction_type: 'bucket_investment',
          tx_hash: result.hash,
          status: 'confirmed',
          created_at: new Date().toISOString()
        }]);

      if (txError) {
        console.error('记录定投交易失败:', txError);
      }

      res.json({
        success: true,
        message: '定投执行成功',
        hash: result.hash
      });
    } else {
      res.status(400).json({ error: result.error || '定投执行失败' });
    }

  } catch (error) {
    console.error('执行定投异常:', error);
    res.status(500).json({ error: error.message || '定投执行失败' });
  }
});

// 交易记录API
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, plan_id } = req.query;

    let query = supabase
      .from('transactions')
      .select(`
        *,
        dca_plans!inner(
          id,
          plan_name,
          token_symbol,
          amount
        )
      `)
      .eq('user_id', req.user.userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (plan_id) {
      query = query.eq('dca_plan_id', plan_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('获取交易记录错误:', error);
      return res.status(500).json({ error: '获取交易记录失败' });
    }

    res.json({
      transactions: data,
      total: data.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('获取交易记录异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 传感器数据API
app.get('/api/sensor/counts', authenticateToken, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const { data, error } = await supabase
      .from('sensor_counts')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('获取传感器数据错误:', error);
      return res.status(500).json({ error: '获取数据失败' });
    }

    res.json({
      data,
      total: data.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('获取传感器数据异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 传感器计数增加时触发DCA执行
app.post('/api/sensor/trigger-dca', authenticateToken, async (req, res) => {
  try {
    console.log('传感器计数增加，开始执行DCA...');
    
    // 1. 获取当前用户的所有活跃DCA计划
    const { data: activePlans, error: plansError } = await supabase
      .from('dca_plans')
      .select('*')
      .eq('user_id', req.user.userId)
      .eq('is_active', true);

    if (plansError) {
      console.error('获取活跃DCA计划错误:', plansError);
      return res.status(500).json({ error: '获取DCA计划失败' });
    }

    if (!activePlans || activePlans.length === 0) {
      console.log('没有活跃的DCA计划');
      return res.json({ message: '没有活跃的DCA计划', executed: 0 });
    }

    let executedCount = 0;
    const results = [];

    // 2. 为每个活跃计划执行交易
    for (const plan of activePlans) {
      try {
        console.log(`执行DCA计划: ${plan.plan_name} (ID: ${plan.id})`);
        
        // 获取计划对应的活跃钱包
        const { data: wallet, error: walletError } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', req.user.userId)
          .eq('is_active', true)
          .single();

        if (walletError || !wallet) {
          console.error(`用户 ${req.user.userId} 没有活跃钱包`);
          continue;
        }

        // 解密私钥
        const privateKey = decrypt(wallet.private_key);

        // 使用Sui SDK构建和发送交易
        let amount, tokenType;
        if (plan.token_symbol === 'USDB') {
          amount = Math.floor(plan.amount * 1000000); // USDB精度6位
          tokenType = 'USDB';
        } else {
          amount = Math.floor(plan.amount * 1000000000); // SUI精度9位
          tokenType = 'SUI';
        }
        
        const result = await buildAndSendTransferTx(
          privateKey,
          plan.target_address,
          amount,
          tokenType
        );
        
        // 3. 创建交易记录
        const { data: transaction, error: txError } = await supabase
          .from('transactions')
          .insert([{
            dca_plan_id: plan.id,
            user_id: req.user.userId,
            wallet_address: wallet.address,
            recipient_address: plan.target_address,
            amount: plan.amount,
            token_symbol: plan.token_symbol,
            transaction_type: 'dca_investment',
            tx_hash: result.digest,
            status: 'confirmed',
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (txError) {
          console.error('创建交易记录失败:', txError);
        } else {
          console.log(`交易记录创建成功: ${transaction.id}`);
          executedCount++;
          results.push({
            planId: plan.id,
            planName: plan.plan_name,
            txHash: result.digest,
            status: 'success'
          });
        }

      } catch (planError) {
        console.error(`执行DCA计划 ${plan.id} 失败:`, planError);
        results.push({
          planId: plan.id,
          planName: plan.plan_name,
          status: 'failed',
          error: planError.message
        });
      }
    }

    console.log(`DCA执行完成，成功执行 ${executedCount} 个计划`);
    
    res.json({
      message: `DCA执行完成，成功执行 ${executedCount} 个计划`,
      executed: executedCount,
      results: results
    });

  } catch (error) {
    console.error('传感器触发DCA执行异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 定投执行计数API
app.get('/api/dca/execution-counts', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dca_execution_counts')
      .select(`
        *,
        dca_plans!inner(
          id,
          plan_name,
          user_id
        )
      `)
      .eq('dca_plans.user_id', req.user.userId)
      .order('last_executed_at', { ascending: false });

    if (error) {
      console.error('获取定投执行统计错误:', error);
      return res.status(500).json({ error: '获取执行统计失败' });
    }

    res.json({ data });

  } catch (error) {
    console.error('获取定投执行统计异常:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('未处理的错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// DCA执行监控状态
let lastExecutionCounts = new Map(); // 存储每个计划的最后执行计数
let isMonitoring = false;
let isInitialized = false; // 标记是否已初始化

// 初始化DCA执行计数状态
async function initializeDcaExecutionCounts() {
  try {
    console.log('🔄 初始化DCA执行计数状态...');
    
    const { data: plans, error } = await supabase
      .from('dca_execution_counts')
      .select(`
        dca_plan_id,
        execution_count,
        dca_plans!inner(
          id,
          plan_name,
          is_active
        )
      `)
      .eq('dca_plans.is_active', true);

    if (error) {
      console.error('初始化DCA执行计数失败:', error);
      return;
    }

    if (plans && plans.length > 0) {
      for (const plan of plans) {
        lastExecutionCounts.set(plan.dca_plan_id, plan.execution_count);
        console.log(`📊 初始化计划 ${plan.dca_plans.plan_name}: 当前计数 = ${plan.execution_count}`);
      }
      console.log(`✅ 已初始化 ${plans.length} 个活跃DCA计划的执行计数`);
    } else {
      console.log('📋 没有活跃的DCA计划需要初始化');
    }
    
    isInitialized = true;
  } catch (error) {
    console.error('初始化DCA执行计数异常:', error);
    isInitialized = true; // 即使失败也标记为已初始化，避免阻塞
  }
}

// 监控DCA执行计数变化的函数
async function monitorDcaExecutionCounts() {
  if (isMonitoring || !isInitialized) return;
  isMonitoring = true;
  
  try {
    // 获取所有活跃的DCA计划及其执行计数
    const { data: plans, error } = await supabase
      .from('dca_execution_counts')
      .select(`
        *,
        dca_plans!inner(
          id,
          plan_name,
          user_id,
          token_symbol,
          amount,
          target_address,
          bucket_strategy,
          is_active
        )
      `)
      .eq('dca_plans.is_active', true);

    if (error) {
      console.error('获取DCA执行计数失败:', error);
      return;
    }

    if (!plans || plans.length === 0) {
      // 只在第一次没有计划时显示，避免重复日志
      if (lastExecutionCounts.size === 0) {
        console.log('📋 没有活跃的DCA计划');
      }
      return;
    }

    // 检查每个计划的执行计数变化
    for (const plan of plans) {
      const planId = plan.dca_plan_id;
      const currentCount = plan.execution_count;
      const lastCount = lastExecutionCounts.get(planId) || 0;
      
      // 如果计数增加了，执行交易
      if (currentCount > lastCount) {
        console.log(`🎯 检测到DCA计划 ${plan.dca_plans.plan_name} 执行计数增加: ${lastCount} → ${currentCount}`);
        
        try {
          await executeDcaTransaction(plan);
          console.log(`✅ DCA计划 ${plan.dca_plans.plan_name} 交易执行成功`);
        } catch (error) {
          console.error(`❌ DCA计划 ${plan.dca_plans.plan_name} 交易执行失败:`, error);
        }
      }
      
      // 更新最后计数
      lastExecutionCounts.set(planId, currentCount);
    }
    
  } catch (error) {
    console.error('监控DCA执行计数异常:', error);
  } finally {
    isMonitoring = false;
  }
}

// 执行DCA交易的函数
async function executeDcaTransaction(executionRecord) {
  const plan = executionRecord.dca_plans;
  
  // 获取用户的钱包信息
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', plan.user_id)
    .eq('is_active', true)
    .single();

  if (walletError || !wallet) {
    throw new Error(`用户 ${plan.user_id} 没有活跃钱包`);
  }

  // 解密私钥
  const privateKey = decrypt(wallet.private_key);

  let result;
  
  // 根据理财策略执行不同的交易
  if (plan.bucket_strategy === 'NONE') {
    // 传统转账
    let amount, tokenType;
    if (plan.token_symbol === 'USDB') {
      amount = Math.floor(plan.amount * 1000000); // USDB精度6位
      tokenType = 'USDB';
    } else {
      amount = Math.floor(plan.amount * 1000000000); // SUI精度9位
      tokenType = 'SUI';
    }
    
    result = await buildAndSendTransferTx(
      privateKey,
      plan.target_address,
      amount,
      tokenType
    );
  } else {
    // Bucket理财策略
    result = await bucketService.executeSavingPoolDCA(
      wallet.address,
      plan.amount,
      plan.bucket_strategy,
      plan.token_symbol,
      privateKey
    );
  }

  // 记录交易
  const { error: txError } = await supabase
    .from('transactions')
    .insert([{
      dca_plan_id: plan.id,
      user_id: plan.user_id,
      wallet_address: wallet.address,
      recipient_address: plan.bucket_strategy === 'NONE' ? plan.target_address : 'bucket-protocol',
      amount: plan.amount,
      token_symbol: plan.token_symbol,
      transaction_type: plan.bucket_strategy === 'NONE' ? 'dca_investment' : 'bucket_investment',
      tx_hash: result.digest || result.hash,
      status: 'confirmed',
      created_at: new Date().toISOString()
    }]);

  if (txError) {
    console.error('记录交易失败:', txError);
  }

  return result;
}

// 启动服务器
app.listen(PORT, async () => {
  console.log(`🚀 ESP32传感器监控系统后端API已启动`);
  console.log(`📡 端口: ${PORT}`);
  console.log(`🌐 健康检查: http://localhost:${PORT}/health`);
  console.log(`📊 API文档: http://localhost:${PORT}/api/`);
  console.log(`⏰ 启动时间: ${new Date().toISOString()}`);
  
  // 先初始化DCA执行计数状态
  await initializeDcaExecutionCounts();
  
  // 启动DCA执行监控
  console.log('🔄 启动DCA执行监控...');
  setInterval(monitorDcaExecutionCounts, 2000); // 每2秒检查一次
});

// 优雅关闭已禁用

module.exports = app;