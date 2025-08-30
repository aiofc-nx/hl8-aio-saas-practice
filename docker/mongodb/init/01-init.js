// Aiofix IAM MongoDB 事件存储初始化脚本
// 创建时间: 2024年12月
// 描述: 初始化事件存储数据库和集合

// 切换到事件存储数据库
db = db.getSiblingDB('aiofix_iam_events');

// 创建集合
db.createCollection('events');
db.createCollection('snapshots');
db.createCollection('projections');
db.createCollection('subscriptions');

// 创建索引
// 事件集合索引
db.events.createIndex({ "aggregateId": 1, "version": 1 }, { unique: true });
db.events.createIndex({ "aggregateType": 1 });
db.events.createIndex({ "eventType": 1 });
db.events.createIndex({ "createdAt": 1 });
db.events.createIndex({ "tenantId": 1 });
db.events.createIndex({ "organizationId": 1 });
db.events.createIndex({ "departmentId": 1 });

// 快照集合索引
db.snapshots.createIndex({ "aggregateId": 1, "version": 1 }, { unique: true });
db.snapshots.createIndex({ "aggregateType": 1 });
db.snapshots.createIndex({ "tenantId": 1 });

// 投影集合索引
db.projections.createIndex({ "projectionName": 1, "aggregateId": 1 }, { unique: true });
db.projections.createIndex({ "projectionName": 1 });
db.projections.createIndex({ "lastProcessedEventId": 1 });
db.projections.createIndex({ "tenantId": 1 });

// 订阅集合索引
db.subscriptions.createIndex({ "subscriptionName": 1, "eventType": 1 });
db.subscriptions.createIndex({ "subscriptionName": 1 });
db.subscriptions.createIndex({ "lastProcessedEventId": 1 });
db.subscriptions.createIndex({ "tenantId": 1 });

// 插入基础配置数据
db.system_configs.insertMany([
    {
        _id: "event_store_config",
        config: {
            maxEventsPerSnapshot: 100,
            snapshotRetentionDays: 365,
            eventRetentionDays: 2555, // 7年
            maxEventSize: 16777216, // 16MB
            compressionEnabled: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: "projection_config",
        config: {
            batchSize: 100,
            processingInterval: 1000, // 1秒
            maxRetries: 3,
            retryDelay: 5000 // 5秒
        },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        _id: "subscription_config",
        config: {
            batchSize: 50,
            processingInterval: 500, // 0.5秒
            maxRetries: 5,
            retryDelay: 3000 // 3秒
        },
        createdAt: new Date(),
        updatedAt: new Date()
    }
]);

// 创建用户（如果需要）
// db.createUser({
//     user: "aiofix_user",
//     pwd: "aiofix_password",
//     roles: [
//         { role: "readWrite", db: "aiofix_iam_events" }
//     ]
// });

// 输出初始化完成信息
print("Aiofix IAM MongoDB 事件存储初始化完成");
print("已创建的集合: events, snapshots, projections, subscriptions");
print("已创建的索引: 事件索引、快照索引、投影索引、订阅索引");
print("已插入基础配置数据");
