-- 添加交易类型字段到transactions表
-- 用于区分定投(dca_investment)和提币(withdraw)等不同类型的交易

-- 1. 添加transaction_type字段
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50) DEFAULT 'dca_investment';

-- 2. 添加token_symbol字段（用于显示正确的代币类型）
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS token_symbol VARCHAR(20) DEFAULT 'USDB';

-- 3. 更新现有记录的transaction_type
UPDATE transactions 
SET transaction_type = 'dca_investment' 
WHERE transaction_type IS NULL OR transaction_type = '';

-- 4. 添加注释
COMMENT ON COLUMN transactions.transaction_type IS '交易类型：dca_investment(定投), bucket_withdraw(提币), transfer(转账)等';
COMMENT ON COLUMN transactions.token_symbol IS '代币符号：USDB, SUI等';

-- 5. 创建索引
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_type ON transactions(transaction_type);

-- 6. 验证表结构
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'transactions'
ORDER BY ordinal_position;

-- 完成
SELECT 'transactions表已添加transaction_type和token_symbol字段！' as message;
