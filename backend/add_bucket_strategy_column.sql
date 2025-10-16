-- 为 dca_plans 表添加 bucket_strategy 字段
-- 用于存储理财策略类型

-- 添加 bucket_strategy 字段
ALTER TABLE dca_plans 
ADD COLUMN bucket_strategy VARCHAR(50) DEFAULT 'NONE';

-- 添加字段注释
COMMENT ON COLUMN dca_plans.bucket_strategy IS '理财策略类型: NONE(传统转账), SAVING_POOL(储蓄池定投), CDP_LEVERAGE(CDP杠杆理财), HYBRID(混合策略)';

-- 更新现有记录的默认值
UPDATE dca_plans 
SET bucket_strategy = 'NONE' 
WHERE bucket_strategy IS NULL;

-- 创建索引以提高查询性能
CREATE INDEX idx_dca_plans_bucket_strategy ON dca_plans(bucket_strategy);

-- 显示更新结果
SELECT 
  id,
  plan_name,
  bucket_strategy,
  target_address,
  created_at
FROM dca_plans 
ORDER BY created_at DESC;
