-- 创建定投执行计数表
-- 每个定投计划独立记录执行次数

CREATE TABLE IF NOT EXISTS dca_execution_counts (
    id SERIAL PRIMARY KEY,
    dca_plan_id INTEGER NOT NULL REFERENCES dca_plans(id) ON DELETE CASCADE,
    execution_count INTEGER NOT NULL DEFAULT 0,
    last_executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dca_plan_id)
);

-- 添加注释
COMMENT ON TABLE dca_execution_counts IS '定投计划执行计数表';
COMMENT ON COLUMN dca_execution_counts.id IS '主键，自增ID';
COMMENT ON COLUMN dca_execution_counts.dca_plan_id IS '关联的定投计划ID';
COMMENT ON COLUMN dca_execution_counts.execution_count IS '执行次数（累加）';
COMMENT ON COLUMN dca_execution_counts.last_executed_at IS '最后执行时间';
COMMENT ON COLUMN dca_execution_counts.created_at IS '创建时间';
COMMENT ON COLUMN dca_execution_counts.updated_at IS '更新时间';

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_dca_execution_counts_plan_id ON dca_execution_counts(dca_plan_id);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_dca_execution_counts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dca_execution_counts_updated_at
    BEFORE UPDATE ON dca_execution_counts
    FOR EACH ROW
    EXECUTE FUNCTION update_dca_execution_counts_updated_at();

-- 查询表结构确认
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'dca_execution_counts' 
ORDER BY ordinal_position;

