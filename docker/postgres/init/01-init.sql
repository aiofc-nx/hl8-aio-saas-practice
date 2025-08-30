-- Aiofix IAM PostgreSQL 数据库初始化脚本
-- 创建时间: 2024年12月
-- 描述: 初始化IAM系统所需的数据库结构和基础数据

-- 设置时区
SET timezone = 'UTC';

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 创建数据库用户（如果需要）
-- CREATE USER aiofix_user WITH PASSWORD 'aiofix_password';
-- GRANT ALL PRIVILEGES ON DATABASE aiofix_iam TO aiofix_user;

-- 创建事件存储相关的表
CREATE TABLE IF NOT EXISTS event_store (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_data JSONB NOT NULL,
    event_metadata JSONB,
    version INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255),
    tenant_id VARCHAR(255),
    organization_id VARCHAR(255),
    department_id VARCHAR(255)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_event_store_aggregate_id ON event_store(aggregate_id);
CREATE INDEX IF NOT EXISTS idx_event_store_aggregate_type ON event_store(aggregate_type);
CREATE INDEX IF NOT EXISTS idx_event_store_event_type ON event_store(event_type);
CREATE INDEX IF NOT EXISTS idx_event_store_created_at ON event_store(created_at);
CREATE INDEX IF NOT EXISTS idx_event_store_tenant_id ON event_store(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_store_organization_id ON event_store(organization_id);

-- 创建快照表
CREATE TABLE IF NOT EXISTS snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(255) NOT NULL,
    snapshot_data JSONB NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id VARCHAR(255),
    organization_id VARCHAR(255),
    department_id VARCHAR(255),
    UNIQUE(aggregate_id, version)
);

-- 创建快照索引
CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate_id ON snapshots(aggregate_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate_type ON snapshots(aggregate_type);
CREATE INDEX IF NOT EXISTS idx_snapshots_tenant_id ON snapshots(tenant_id);

-- 创建审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(255),
    resource_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tenant_id VARCHAR(255),
    organization_id VARCHAR(255),
    department_id VARCHAR(255)
);

-- 创建审计日志索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);

-- 创建系统配置表
CREATE TABLE IF NOT EXISTS system_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(255),
    tenant_id VARCHAR(255),
    organization_id VARCHAR(255),
    department_id VARCHAR(255)
);

-- 创建系统配置索引
CREATE INDEX IF NOT EXISTS idx_system_configs_key ON system_configs(config_key);
CREATE INDEX IF NOT EXISTS idx_system_configs_tenant_id ON system_configs(tenant_id);

-- 插入基础系统配置
INSERT INTO system_configs (config_key, config_value, description, is_public) VALUES
('system.info', '{"name": "Aiofix IAM", "version": "1.0.0", "description": "基于DDD和Clean Architecture的多租户SaaS平台"}', '系统基础信息', true),
('security.password_policy', '{"min_length": 8, "require_uppercase": true, "require_lowercase": true, "require_numbers": true, "require_special_chars": true}', '密码策略配置', false),
('security.session_policy', '{"timeout": 3600, "max_concurrent_sessions": 5, "remember_me_days": 30}', '会话策略配置', false)
ON CONFLICT (config_key) DO NOTHING;

-- 创建函数：更新时间戳
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器：自动更新updated_at
CREATE TRIGGER update_system_configs_updated_at 
    BEFORE UPDATE ON system_configs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 创建视图：事件统计
CREATE OR REPLACE VIEW event_statistics AS
SELECT 
    aggregate_type,
    COUNT(*) as event_count,
    MIN(created_at) as first_event,
    MAX(created_at) as last_event,
    COUNT(DISTINCT aggregate_id) as unique_aggregates
FROM event_store 
GROUP BY aggregate_type;

-- 创建视图：审计统计
CREATE OR REPLACE VIEW audit_statistics AS
SELECT 
    action,
    resource_type,
    COUNT(*) as action_count,
    MIN(created_at) as first_action,
    MAX(created_at) as last_action,
    COUNT(DISTINCT user_id) as unique_users
FROM audit_logs 
GROUP BY action, resource_type;

-- 授予权限（如果需要）
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aiofix_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aiofix_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO aiofix_user;

-- 输出初始化完成信息
DO $$
BEGIN
    RAISE NOTICE 'Aiofix IAM PostgreSQL 数据库初始化完成';
    RAISE NOTICE '已创建的表: event_store, snapshots, audit_logs, system_configs';
    RAISE NOTICE '已创建的视图: event_statistics, audit_statistics';
    RAISE NOTICE '已创建的函数: update_updated_at_column';
    RAISE NOTICE '已插入基础系统配置数据';
END $$;
