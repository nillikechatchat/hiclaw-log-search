# HiClaw Log Search

HiClaw 系统日志查询服务，提供 Web UI 和 REST API，支持实时日志流、高级搜索和统计分析。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![Version](https://img.shields.io/badge/version-2.0.0-orange.svg)

## ✨ 功能特性

### 基础功能
- 🔍 **多组件日志查询** - 支持 12+ 个系统组件
- 🎨 **级别过滤** - ERROR / WARN / INFO / DEBUG
- 🔄 **自动刷新** - 可配置的轮询刷新

### 高级功能 (v2.0)
- ⚡ **WebSocket 实时日志流** - 替代轮询，真正的实时推送
- 🔎 **高级搜索** - 正则表达式、时间范围、关键词组合
- 📊 **日志统计分析** - 错误趋势图表、Top 错误、级别分布
- 📝 **日志上下文** - 查看某条日志的前后 N 行
- 💾 **日志导出** - JSON / CSV 格式导出
- 🎯 **智能解析** - 自动识别 JSON 格式日志、堆栈跟踪

## 🚀 快速开始

### 1. 安装

```bash
git clone https://github.com/nillikechatchat/hiclaw-log-search.git
cd hiclaw-log-search
npm install  # 可选，仅用于安装 ws 模块
```

### 2. 启动服务

```bash
npm start
# 或
node skill/server.js
```

### 3. 配置 Nginx

```bash
cp skill/nginx.conf /etc/nginx/conf.d/log-search.conf
nginx -s reload
```

### 4. 访问

打开浏览器访问: `http://<ip>:19997/log-search/`

## 📡 API 文档

### 健康检查

```
GET /log-search/api/health
```

响应:
```json
{
  "status": "ok",
  "time": "2024-03-24T14:00:00.000Z",
  "uptime": 3600,
  "cache": { "entries": 5, "usagePercent": "12.5" },
  "websocket": { "clients": 2, "watchers": 3 }
}
```

### 获取组件列表

```
GET /log-search/api/components
```

响应:
```json
{
  "components": [
    {
      "id": "higress-gateway",
      "name": "Higress Gateway",
      "size": 5242880,
      "lastModified": "2024-03-24T14:00:00.000Z",
      "exists": true
    }
  ],
  "total": 12
}
```

### 查询日志 (增强版)

```
GET /log-search/api/logs?component=higress-gateway&lines=200&level=ERROR&search=timeout&regex=error.*timeout&startTime=2024-03-24T00:00:00Z&endTime=2024-03-24T23:59:59Z
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `component` | string | 组件 ID（必填） |
| `lines` | number | 返回行数（默认 1000，最大 5000） |
| `level` | string | 日志级别过滤（ERROR/WARN/INFO/DEBUG/ALL） |
| `search` | string | 关键词搜索 |
| `regex` | string | 正则表达式搜索 |
| `startTime` | ISO8601 | 开始时间 |
| `endTime` | ISO8601 | 结束时间 |

### 日志上下文

```
GET /log-search/api/context?component=higress-gateway&line=1234&before=10&after=10
```

### 日志统计

```
GET /log-search/api/stats?component=higress-gateway&hours=24
```

响应:
```json
{
  "component": "higress-gateway",
  "period": { "start": "...", "end": "...", "hours": 24 },
  "summary": {
    "total": 15234,
    "byLevel": { "ERROR": 234, "WARN": 567, "INFO": 14000, "DEBUG": 433 }
  },
  "trend": [
    { "hour": "00:00", "error": 10, "warn": 20, "info": 500 }
  ],
  "topErrors": [
    { "message": "Connection timeout", "count": 45 }
  ]
}
```

### 日志导出

```
GET /log-search/api/export?component=higress-gateway&format=json&level=ERROR
```

| 参数 | 说明 |
|------|------|
| `format` | 输出格式：`json`（默认）或 `csv` |

## 🔌 WebSocket API

### 连接

```
ws://host:19996/log-search/ws
```

### 协议

```javascript
// 订阅组件日志
{ "action": "subscribe", "component": "higress-gateway", "filters": { "level": "ERROR" } }

// 取消订阅
{ "action": "unsubscribe", "component": "higress-gateway" }

// 暂停接收
{ "action": "pause" }

// 恢复接收
{ "action": "resume" }
```

### 消息类型

```javascript
// 连接成功
{ "type": "connected", "clientId": 1, "message": "..." }

// 日志推送
{ "type": "log", "component": "higress-gateway", "data": { ... } }

// 订阅确认
{ "type": "subscribed", "success": true, "componentId": "higress-gateway" }

// 心跳
{ "type": "heartbeat", "time": 1711296000000 }
```

## 📁 项目结构

```
skill/
├── server.js           # 主入口（HTTP + WebSocket）
├── config.js           # 配置文件
├── routes/
│   ├── health.js       # 健康检查
│   ├── components.js   # 组件列表
│   ├── logs.js         # 日志查询/上下文/导出
│   └── stats.js        # 日志统计
├── services/
│   ├── logReader.js    # 日志读取（缓存）
│   ├── logParser.js    # 日志解析（多格式）
│   ├── logWatcher.js   # 实时监控（WebSocket）
│   └── statsCalculator.js # 统计计算
└── utils/
    └── cache.js        # LRU 缓存
```

## ⚙️ 配置

日志组件配置在 `skill/config.js` 中：

```javascript
const COMPONENTS = {
  "higress-gateway": { name: "Higress Gateway", file: "/var/log/hiclaw/higress-gateway.log" },
  // 添加更多组件...
};
```

## 📦 依赖

- **必需**: Node.js >= 18
- **可选**: `ws` 模块（用于 WebSocket 实时日志）

```bash
npm install ws  # 可选
```

## 🔧 部署

### systemd 服务

```bash
./scripts/install.sh /opt/log-search
systemctl enable hiclaw-log-search
systemctl start hiclaw-log-search
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY skill/ ./skill/
COPY package.json .
RUN npm install --production
EXPOSE 19996
CMD ["node", "skill/server.js"]
```

## 📄 License

MIT