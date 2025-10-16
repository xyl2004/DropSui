-- 创建传感器计数表
CREATE TABLE IF NOT EXISTS sensor_counts (
    id SERIAL PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入初始记录
INSERT INTO sensor_counts (count) VALUES (0);

-- 添加注释
COMMENT ON TABLE sensor_counts IS '传感器计数表';
COMMENT ON COLUMN sensor_counts.id IS '主键，自增ID';
COMMENT ON COLUMN sensor_counts.count IS '当前计数值';
COMMENT ON COLUMN sensor_counts.updated_at IS '最后更新时间';

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_sensor_counts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_sensor_counts_updated_at
    BEFORE UPDATE ON sensor_counts
    FOR EACH ROW
    EXECUTE FUNCTION update_sensor_counts_updated_at();

-- 查询表结构确认
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'sensor_counts' 
ORDER BY ordinal_position;

