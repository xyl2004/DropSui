-- 创建钱包表
-- 在Supabase数据库中执行此SQL脚本

-- 创建wallets表
CREATE TABLE IF NOT EXISTS wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(100) NOT NULL,
    private_key TEXT NOT NULL,
    public_key TEXT NOT NULL,
    wallet_name VARCHAR(100) DEFAULT 'My Wallet',
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE wallets IS '用户钱包表';
COMMENT ON COLUMN wallets.id IS '主键，自增ID';
COMMENT ON COLUMN wallets.user_id IS '用户ID，外键关联users表';
COMMENT ON COLUMN wallets.address IS '钱包地址';
COMMENT ON COLUMN wallets.private_key IS '私钥（加密存储）';
COMMENT ON COLUMN wallets.public_key IS '公钥';
COMMENT ON COLUMN wallets.wallet_name IS '钱包名称';
COMMENT ON COLUMN wallets.is_active IS '是否为当前活跃钱包';
COMMENT ON COLUMN wallets.created_at IS '创建时间';
COMMENT ON COLUMN wallets.updated_at IS '更新时间';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(address);
CREATE INDEX IF NOT EXISTS idx_wallets_is_active ON wallets(is_active);

-- 创建更新时间触发器
CREATE TRIGGER update_wallets_updated_at 
    BEFORE UPDATE ON wallets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 确保每个用户只有一个活跃钱包的约束
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_user_active 
ON wallets(user_id) 
WHERE is_active = true;

-- 查询表结构确认
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'wallets' 
ORDER BY ordinal_position;
