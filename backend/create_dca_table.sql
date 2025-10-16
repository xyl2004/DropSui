-- 创建定投表
CREATE TABLE IF NOT EXISTS dca_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_name VARCHAR(255) NOT NULL,
    token_symbol VARCHAR(20) NOT NULL DEFAULT 'SUI',
    amount DECIMAL(20, 8) NOT NULL,
    target_address VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE dca_plans IS '用户定投计划表';
COMMENT ON COLUMN dca_plans.id IS '主键，自增ID';
COMMENT ON COLUMN dca_plans.user_id IS '关联的用户ID';
COMMENT ON COLUMN dca_plans.plan_name IS '定投计划名称';
COMMENT ON COLUMN dca_plans.token_symbol IS '定投币种符号';
COMMENT ON COLUMN dca_plans.amount IS '定投数量';
COMMENT ON COLUMN dca_plans.target_address IS '发送地址';
COMMENT ON COLUMN dca_plans.is_active IS '是否正在执行定投';
COMMENT ON COLUMN dca_plans.created_at IS '记录创建时间';
COMMENT ON COLUMN dca_plans.updated_at IS '记录更新时间';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_dca_plans_user_id ON dca_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_dca_plans_is_active ON dca_plans(is_active);

-- 查询表结构确认
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'dca_plans'
ORDER BY ordinal_position;
