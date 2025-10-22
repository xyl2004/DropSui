-- ========================================
-- DCA Plans 表最终结构定义
-- 更新时间: 2025-10-22
-- 版本: v2.0 (清理后)
-- ========================================

CREATE TABLE IF NOT EXISTS public.dca_plans (
  -- 基本字段
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_name VARCHAR(255) NOT NULL,
  
  -- 定投配置
  token_symbol VARCHAR(20) NOT NULL DEFAULT 'SUI',
  amount NUMERIC(20, 8) NOT NULL,
  target_address VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  
  -- Bucket Protocol 理财策略
  bucket_strategy VARCHAR(50) DEFAULT 'NONE',
  
  -- Swap 代币兑换配置
  enable_swap BOOLEAN NOT NULL DEFAULT false,
  target_token_symbol VARCHAR(20) DEFAULT 'SUI',
  slippage NUMERIC(5, 4) DEFAULT 0.01,
  swap_pool_address TEXT DEFAULT NULL,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 索引
-- ========================================

-- 基础索引
CREATE INDEX IF NOT EXISTS idx_dca_plans_user_id 
ON public.dca_plans(user_id);

CREATE INDEX IF NOT EXISTS idx_dca_plans_is_active 
ON public.dca_plans(is_active);

-- Bucket 策略索引
CREATE INDEX IF NOT EXISTS idx_dca_plans_bucket_strategy 
ON public.dca_plans(bucket_strategy);

-- Swap 相关索引
CREATE INDEX IF NOT EXISTS idx_dca_plans_enable_swap_v2 
ON public.dca_plans(enable_swap);

CREATE INDEX IF NOT EXISTS idx_dca_plans_target_token 
ON public.dca_plans(target_token_symbol) 
WHERE target_token_symbol IS NOT NULL;

-- 复合索引（优化查询性能）
CREATE INDEX IF NOT EXISTS idx_dca_plans_swap_active 
ON public.dca_plans(enable_swap, is_active, target_token_symbol) 
WHERE enable_swap = true;

-- ========================================
-- 字段注释
-- ========================================

COMMENT ON TABLE public.dca_plans IS '用户定投计划表 - 支持传统转账、Bucket理财、代币兑换';

-- 基本字段
COMMENT ON COLUMN public.dca_plans.id IS '主键，自增ID';
COMMENT ON COLUMN public.dca_plans.user_id IS '关联的用户ID';
COMMENT ON COLUMN public.dca_plans.plan_name IS '定投计划名称';

-- 定投配置
COMMENT ON COLUMN public.dca_plans.token_symbol IS '源代币符号（定投币种）';
COMMENT ON COLUMN public.dca_plans.amount IS '定投数量';
COMMENT ON COLUMN public.dca_plans.target_address IS '接收地址（传统转账模式）';
COMMENT ON COLUMN public.dca_plans.is_active IS '是否正在执行定投';

-- Bucket Protocol
COMMENT ON COLUMN public.dca_plans.bucket_strategy IS 'Bucket理财策略: NONE(传统转账), SAVING_POOL(存款池), AUTO_INVEST(自动投资)';

-- Swap 配置
COMMENT ON COLUMN public.dca_plans.enable_swap IS '是否启用代币兑换（Swap），使用 Cetus Aggregator';
COMMENT ON COLUMN public.dca_plans.target_token_symbol IS '目标代币符号（启用 swap 时的目标币种）';
COMMENT ON COLUMN public.dca_plans.slippage IS '滑点容忍度（0.01 = 1%），用于 swap 交易';
COMMENT ON COLUMN public.dca_plans.swap_pool_address IS 'Swap 流动性池子地址（可选）';

-- 时间戳
COMMENT ON COLUMN public.dca_plans.created_at IS '记录创建时间';
COMMENT ON COLUMN public.dca_plans.updated_at IS '记录更新时间';

-- ========================================
-- 示例数据
-- ========================================

-- 示例 1: 传统 USDB 转账（无 Swap）
-- INSERT INTO dca_plans (user_id, plan_name, token_symbol, amount, target_address, bucket_strategy, enable_swap)
-- VALUES (1, 'Monthly USDB Transfer', 'USDB', 100.00, '0x...', 'NONE', false);

-- 示例 2: USDB → SUI 兑换后转账
-- INSERT INTO dca_plans (user_id, plan_name, token_symbol, amount, target_address, bucket_strategy, enable_swap, target_token_symbol, slippage)
-- VALUES (1, 'USDB to SUI Weekly', 'USDB', 50.00, '0x...', 'NONE', true, 'SUI', 0.01);

-- 示例 3: USDB Bucket 理财
-- INSERT INTO dca_plans (user_id, plan_name, token_symbol, amount, target_address, bucket_strategy, enable_swap)
-- VALUES (1, 'USDB Savings Plan', 'USDB', 200.00, '', 'SAVING_POOL', false);

