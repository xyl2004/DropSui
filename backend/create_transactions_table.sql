-- 创建转账历史表（表名修改为transactions以匹配代码）
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dca_plan_id INTEGER REFERENCES dca_plans(id) ON DELETE CASCADE,
    wallet_address VARCHAR(100) NOT NULL,
    tx_hash VARCHAR(255) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    recipient_address VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, confirmed, failed
    block_number BIGINT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE transactions IS '定投转账历史记录表';
COMMENT ON COLUMN transactions.id IS '主键，自增ID';
COMMENT ON COLUMN transactions.user_id IS '关联的用户ID';
COMMENT ON COLUMN transactions.dca_plan_id IS '关联的定投计划ID（可选）';
COMMENT ON COLUMN transactions.wallet_address IS '钱包地址';
COMMENT ON COLUMN transactions.tx_hash IS '交易哈希';
COMMENT ON COLUMN transactions.amount IS '转账数量';
COMMENT ON COLUMN transactions.recipient_address IS '接收地址';
COMMENT ON COLUMN transactions.status IS '交易状态';
COMMENT ON COLUMN transactions.block_number IS '区块号';
COMMENT ON COLUMN transactions.error_message IS '错误信息（如果失败）';
COMMENT ON COLUMN transactions.created_at IS '记录创建时间';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_dca_plan_id ON transactions(dca_plan_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);

-- 查询表结构确认
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'transactions'
ORDER BY ordinal_position;

