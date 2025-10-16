-- 数据库迁移脚本：修复transactions表
-- 目的：确保使用正确的表名和字段

-- 1. 删除旧的dca_transactions表（如果存在）
DROP TABLE IF EXISTS dca_transactions CASCADE;

-- 2. 删除旧的transactions表（如果字段不匹配）
DROP TABLE IF EXISTS transactions CASCADE;

-- 3. 创建新的transactions表（字段与代码匹配）
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dca_plan_id INTEGER REFERENCES dca_plans(id) ON DELETE CASCADE,
    wallet_address VARCHAR(100) NOT NULL,
    tx_hash VARCHAR(255) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    recipient_address VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    block_number BIGINT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 添加注释
COMMENT ON TABLE transactions IS '定投转账历史记录表';
COMMENT ON COLUMN transactions.id IS '主键，自增ID';
COMMENT ON COLUMN transactions.user_id IS '关联的用户ID';
COMMENT ON COLUMN transactions.dca_plan_id IS '关联的定投计划ID（可选）';
COMMENT ON COLUMN transactions.wallet_address IS '钱包地址';
COMMENT ON COLUMN transactions.tx_hash IS '交易哈希';
COMMENT ON COLUMN transactions.amount IS '转账数量';
COMMENT ON COLUMN transactions.recipient_address IS '接收地址';
COMMENT ON COLUMN transactions.status IS '交易状态（pending, confirmed, failed）';
COMMENT ON COLUMN transactions.block_number IS '区块号';
COMMENT ON COLUMN transactions.error_message IS '错误信息（如果失败）';
COMMENT ON COLUMN transactions.created_at IS '记录创建时间';

-- 5. 创建索引以提高查询性能
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_dca_plan_id ON transactions(dca_plan_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash);

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
SELECT 'transactions表迁移完成！' as message;

