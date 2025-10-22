-- 为 dca_plans 表添加 Swap 相关字段

-- 1. 添加是否启用 swap 字段
ALTER TABLE dca_plans 
ADD COLUMN IF NOT EXISTS enable_swap BOOLEAN DEFAULT false;

-- 2. 添加目标代币字段（swap 后的代币类型）
ALTER TABLE dca_plans 
ADD COLUMN IF NOT EXISTS target_token_symbol VARCHAR(10) DEFAULT NULL;

-- 3. 添加滑点容忍度字段
ALTER TABLE dca_plans 
ADD COLUMN IF NOT EXISTS slippage DECIMAL(5,4) DEFAULT 0.01;

-- 4. 添加 swap 池子地址字段（可选）
ALTER TABLE dca_plans 
ADD COLUMN IF NOT EXISTS swap_pool_address TEXT DEFAULT NULL;

-- 添加注释
COMMENT ON COLUMN dca_plans.enable_swap IS '是否启用代币兑换（Swap）';
COMMENT ON COLUMN dca_plans.target_token_symbol IS '目标代币符号（启用 swap 时使用）';
COMMENT ON COLUMN dca_plans.slippage IS '滑点容忍度（0.01 = 1%）';
COMMENT ON COLUMN dca_plans.swap_pool_address IS 'Swap 流动性池子地址';

-- 更新现有记录的默认值
UPDATE dca_plans 
SET enable_swap = false, 
    target_token_symbol = token_symbol,
    slippage = 0.01
WHERE enable_swap IS NULL;

