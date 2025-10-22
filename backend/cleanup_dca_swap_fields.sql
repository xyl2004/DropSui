-- 清理和统一 dca_plans 表的 Swap 相关字段
-- 执行时间: 2025-10-22
-- 目的: 移除重复字段，统一使用 enable_swap

-- ========================================
-- 1. 数据迁移：将 enable_token_swap 的数据迁移到 enable_swap
-- ========================================

-- 如果 enable_swap 还是 NULL，使用 enable_token_swap 的值
UPDATE dca_plans 
SET enable_swap = COALESCE(enable_swap, enable_token_swap, false)
WHERE enable_swap IS NULL OR enable_token_swap IS NOT NULL;

-- ========================================
-- 2. 删除重复字段和未使用的字段
-- ========================================

-- 删除旧的 enable_token_swap 字段的索引
DROP INDEX IF EXISTS idx_dca_plans_enable_swap;

-- 删除旧字段 enable_token_swap
ALTER TABLE dca_plans 
DROP COLUMN IF EXISTS enable_token_swap;

-- 删除未使用的字段
ALTER TABLE dca_plans 
DROP COLUMN IF EXISTS exchange_rate;

ALTER TABLE dca_plans 
DROP COLUMN IF EXISTS swap_tx_hash;

-- ========================================
-- 3. 确保 enable_swap 字段存在且有默认值
-- ========================================

-- 如果 enable_swap 不存在则添加（安全操作）
ALTER TABLE dca_plans 
ADD COLUMN IF NOT EXISTS enable_swap BOOLEAN DEFAULT false;

-- 确保所有 NULL 值都设为 false
UPDATE dca_plans 
SET enable_swap = false 
WHERE enable_swap IS NULL;

-- 设置 NOT NULL 约束
ALTER TABLE dca_plans 
ALTER COLUMN enable_swap SET NOT NULL;

-- ========================================
-- 4. 创建必要的索引
-- ========================================

-- 为 enable_swap 创建索引（提高查询性能）
CREATE INDEX IF NOT EXISTS idx_dca_plans_enable_swap_v2 
ON dca_plans(enable_swap);

-- 为 target_token_symbol 优化索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_dca_plans_target_token 
ON dca_plans(target_token_symbol) 
WHERE target_token_symbol IS NOT NULL;

-- 为启用 swap 的计划创建复合索引
CREATE INDEX IF NOT EXISTS idx_dca_plans_swap_active 
ON dca_plans(enable_swap, is_active, target_token_symbol) 
WHERE enable_swap = true;

-- ========================================
-- 5. 添加字段注释
-- ========================================

COMMENT ON COLUMN dca_plans.enable_swap IS '是否启用代币兑换（Swap），使用 Cetus Aggregator';
COMMENT ON COLUMN dca_plans.target_token_symbol IS '目标代币符号（启用 swap 时的目标币种）';
COMMENT ON COLUMN dca_plans.slippage IS '滑点容忍度（0.01 = 1%），用于 swap 交易';
COMMENT ON COLUMN dca_plans.swap_pool_address IS 'Swap 流动性池子地址（可选）';

-- ========================================
-- 6. 验证结果
-- ========================================

-- 查看更新后的表结构
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'dca_plans'
ORDER BY ordinal_position;

-- 查看所有索引
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'dca_plans'
ORDER BY indexname;

-- 统计启用 swap 的计划数量
SELECT
    enable_swap,
    COUNT(*) as count
FROM dca_plans
GROUP BY enable_swap;

-- ========================================
-- 执行完成提示
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '✅ DCA Plans 表清理完成！';
    RAISE NOTICE '📋 已移除字段: enable_token_swap, exchange_rate, swap_tx_hash';
    RAISE NOTICE '✨ 已统一使用字段: enable_swap';
    RAISE NOTICE '📊 已创建优化索引';
END $$;

