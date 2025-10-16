# 提币余额查询问题修复

## 问题描述

用户反馈提币时显示"您的储蓄池余额为0，无法提币"，但实际账户有余额（约0.1 USDB）。

## 问题分析

### 调试发现

通过调试脚本 `debug_user_savings.js` 发现：

1. **用户确实有余额**：
   - 钱包地址: `0x38a10f5b8b91f72ae68fc8a24690a38edd2cc44aad5ddf5477d8e8798f2bbaeb`
   - LP余额: `99999` (约 `0.099999 USDB`)
   - 投资总额: `0.2 USDB`

2. **提币时查询余额为0**：
   ```
   💰 用户LP余额: 0 (约 0 USDB)
   ```

### 根本原因

问题出在 `getKeypairFromAddress` 函数：

1. **错误的密钥获取方式**：
   - 该函数只从本地 `~/.sui/sui_config/sui.keystore` 文件中查找密钥
   - 如果用户的钱包私钥存储在数据库中（加密），但不在本地keystore中
   - 函数可能找不到密钥，或者找到错误的密钥

2. **使用了错误的钱包**：
   - 因为密钥匹配失败，可能使用了keystore中的第一个密钥
   - 导致查询了错误钱包地址的余额
   - 所以显示余额为0

## 解决方案

### 1. 改进 `getKeypairFromAddress` 函数

**文件**: `backend/bucket_protocol_service.js` (第292-362行)

**修改**：支持从提供的私钥创建密钥对

```javascript
getKeypairFromAddress(address, privateKey = null) {
  // 优先使用提供的私钥
  if (privateKey) {
    // 从suiprivkey格式导入并创建密钥对
    // ...
  }
  
  // 否则从keystore查找
  // ...
}
```

### 2. 修改 `executeWithdraw` 函数

**文件**: `backend/bucket_protocol_service.js` (第390行)

**修改**：添加 `privateKey` 参数

```javascript
async executeWithdraw(userAddress, amount, strategy = 'SAVING_POOL', privateKey = null, maxRetries = 3) {
  // ...
  const keypair = this.getKeypairFromAddress(userAddress, privateKey);
  // ...
}
```

### 3. 修改提币API

**文件**: `backend/server.js` (第1119-1128行)

**修改**：传递解密后的私钥

```javascript
// 解密私钥
const privateKey = decrypt(wallet.private_key);

// 调用Bucket Protocol提币功能（传递私钥）
const bucketResult = await bucketService.executeWithdraw(
  wallet.address,
  amount,
  plan.bucket_strategy,
  privateKey  // 传递私钥
);
```

## 工作流程

### 修复前的错误流程：
1. 用户点击"提取资金"
2. 系统获取用户的钱包地址（正确的）
3. 调用 `getKeypairFromAddress(address)` - **只从keystore查找**
4. 找不到匹配的密钥，或者找到错误的密钥
5. 使用错误的密钥查询余额
6. 显示余额为0

### 修复后的正确流程：
1. 用户点击"提取资金"
2. 系统获取用户的钱包地址和加密的私钥
3. 解密私钥
4. 调用 `getKeypairFromAddress(address, privateKey)` - **使用提供的私钥**
5. 从私钥创建正确的密钥对
6. 使用正确的密钥查询余额
7. 正确显示余额并执行提币

## 技术细节

### 私钥格式处理

系统支持 `suiprivkey` 格式的私钥：
```
suiprivkey1q...（后续字符）
```

导入流程：
1. 使用 `sui keytool import` 命令导入私钥
2. 从keystore读取最新导入的密钥
3. 解析并创建 `Ed25519Keypair`
4. 验证地址匹配

### 向后兼容

修改后的函数仍然支持从keystore查找：
- 如果提供了 `privateKey`，优先使用
- 如果没有提供，回退到keystore查找
- 保持向后兼容性

## 测试验证

### 调试脚本输出（修复前）
```
✅ 用户: 用户1 (12313131@ada)
✅ 找到 1 个钱包
💰 LP余额: 99999 (0.099999 USDB)
📊 投资总额: 0.2 USDB
```

### 预期结果（修复后）
- 提币时正确获取余额: `0.099999 USDB`
- 允许提币操作
- 成功执行提币交易

## 完成状态

✅ 改进密钥获取逻辑，支持从私钥创建  
✅ 修改提币函数接受私钥参数  
✅ 修改提币API传递解密的私钥  
✅ 保持向后兼容性  
✅ 文档编写完成  

现在系统会使用正确的私钥查询余额和执行提币操作。
