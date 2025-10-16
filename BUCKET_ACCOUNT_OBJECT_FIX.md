# Bucket Protocol Account对象查询修复

## 问题分析

### 错误信息
```
err_account_not_found: MoveAbort(MoveLocation { 
  module: saving, 
  function: err_account_not_found 
})
```

### 根本原因

Bucket Protocol的提币操作需要用户的**Account对象ID**，但之前的实现中：

1. **提币时未传递account参数**：
   ```javascript
   accountObjectOrId: undefined  // ❌ 错误
   ```

2. **SDK无法找到用户的储蓄账户**：
   - 即使用户有余额（0.099999 USDB）
   - 没有account对象ID，SDK无法定位到用户的储蓄记录
   - 导致 `err_account_not_found` 错误

## 技术细节

### Bucket Protocol Account结构

在Bucket Protocol中，每个用户的储蓄都存储在一个Account对象中：

```
Account<SUSDB> {
  id: ObjectID,
  lpBalance: u64,
  rewards: Table<...>,
  ...
}
```

Account对象的类型格式：
```
{package_id}::saving::Account<{lpType}>
```

例如：
```
0x872d08a70db3db498aa7853276acea8091fdd9871b2d86bc8dcb8524526df622::saving::Account<0x38f61c75fa8407140294c84167dd57684580b55c3066883b48dedc344b1cde1e::susdb::SUSDB>
```

### 为什么存款不需要account？

- **存款**：如果用户第一次存款，SDK会自动创建Account对象
- **提币**：必须提供已存在的Account对象ID

## 解决方案

### 修改提币函数

**文件**: `backend/bucket_protocol_service.js` (第541-580行)

**新增逻辑**：查询用户的Account对象

```javascript
// 获取用户的account对象
console.log(`  🔍 获取用户account对象...`);
let accountObjectId = undefined;

try {
  // 查询用户拥有的Account对象
  const objects = await this.client.suiClient.getOwnedObjects({
    owner: this.client.sender,
    filter: {
      StructType: `${lpType.split('::')[0]}::saving::Account<${lpType}>`
    },
    options: {
      showContent: true
    }
  });
  
  if (objects && objects.data && objects.data.length > 0) {
    accountObjectId = objects.data[0].data.objectId;
    console.log(`  ✅ 找到account对象: ${accountObjectId}`);
  } else {
    console.log(`  ⚠️  未找到account对象`);
  }
} catch (error) {
  console.log(`  ⚠️  获取account对象失败: ${error.message}`);
}

// 构建提币交易时传递account对象
const usdbCoin = this.client.buildWithdrawFromSavingPoolTransaction(tx, {
  lpType: lpType,
  amount: withdrawAmount,
  accountObjectOrId: accountObjectId  // ✅ 传递正确的account对象ID
});
```

## 工作流程

### 修复前（错误流程）：
1. 用户请求提币
2. 构建提币交易，`accountObjectOrId: undefined`
3. SDK无法找到用户的Account对象
4. 抛出 `err_account_not_found` 错误

### 修复后（正确流程）：
1. 用户请求提币
2. **查询用户的Account对象ID**
3. 构建提币交易，`accountObjectOrId: <实际的对象ID>`
4. SDK成功定位Account对象
5. 执行提币操作
6. 提币成功

## 调试信息

修复后，日志将显示：

```
🔍 获取用户account对象...
✅ 找到account对象: 0x123...abc
📋 提币参数: lpType=..., amount=0.099999, accountObjectId=0x123...abc
✅ 已构建储蓄池提币交易
```

## 完成状态

✅ 添加Account对象查询逻辑  
✅ 查询用户拥有的Account对象  
✅ 将Account对象ID传递给SDK  
✅ 处理Account不存在的情况  
✅ 文档编写完成  

现在提币操作应该能够正确找到用户的储蓄账户并成功执行。
