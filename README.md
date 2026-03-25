# HiClaw Log Search

HiClaw 系统日志查询服务，提供 Web UI 和 REST API，支持身份认证、高级搜索和统计分析。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)
![Version](https://img.shields.io/badge/version-2.1.0-orange.svg)

## ✨ 功能特性

### 基础功能
- 🔍 **多组件日志查询** - 支持 12+ 个系统组件
- 🎨 **级别过滤** - ERROR / WARN / INFO / DEBUG
- 🔄 **自动刷新** - 可配置的轮询刷新

### 高级功能 (v2.1)
- 🔐 **一次性密钥认证** - 安全的身份验证机制
- 🔎 **高级搜索** - 正则表达式、时间范围、关键词组合
- 📊 **Dashboard 状态监控** - OpenClaw 运行状态、Worker 状态（带动画）
- 🗑️ **日志删除** - 支持删除指定组件日志
- 📝 **日志上下文** - 查看某条日志的前后 N 行
- 💾 **日志导出** - JSON / CSV 格式导出
- 🎯 **智能解析** - 自动识别 JSON 格式日志、堆栈跟踪

## 🚀 快速开始

### 1. 安装

```bash
git clone https://github.com/nillikechatchat/hiclaw-log-search.git
cd hiclaw-log-search
```

### 2. 生成访问密钥

在宿主机执行以下命令生成一次性访问密钥：

```bash
# 方法 1: 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 方法 2: 使用 openssl
openssl rand -hex 32
```

将生成的密钥配置到 `skill/config.js` 的 `AUTH_TOKENS` 中。

### 3. 启动服务

```bash
npm start
# 或
node skill/server.js
```

### 4. 配置 Nginx

```bash
cp skill/nginx.conf /etc/nginx/conf.d/log-search.conf
nginx -s reload
```

### 5. 访问

打开浏览器访问: `http://<ip>:19997/log-search/`

输入一次性密钥进行身份验证。

## 🔐 身份认证

### 密钥生成

访问密钥需要通过宿主机命令生成：

```bash
# 生成 64 位十六进制密钥
openssl rand -hex 32
```

### 密钥配置

将密钥添加到 `skill/config.js`：

```javascript
const AUTH_TOKENS = new Set([
  'your-generated-token-here'
]);
```

### 认证流程

1. 访问 `/log-search/` 页面
2. 输入一次性密钥
3. 验证成功后获得访问权限
4. 密钥使用后自动失效（一次性）

## 📡 API 文档

### 认证 API

**验证密钥**
```
POST /log-search/api/auth/verify
Content-Type: application/json

{
  "token": "your-token-here"
}
```

响应:
```json
{
  "success": true,
  "message": "Authentication successful"
}
```

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
  "cache": { "entries": 5, "usagePercent": "12.5" }
}
```

### 获取组件列表

```
GET /log-search/api/components
Authorization: Bearer <token>
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

### 查询日志

```
GET /log-search/api/logs?component=higress-gateway&lines=200&level=ERROR&search=timeout&regex=error.*timeout&startTime=2024-03-24T00:00:00Z&endTime=2024-03-24T23:59:59Z
Authorization: Bearer <token>
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

### 删除日志

```
DELETE /log-search/api/logs?component=higress-gateway
Authorization: Bearer <token>
```

响应:
```json
{
  "success": true,
  "message": "Log file deleted",
  "component": "higress-gateway"
}
```

### 日志上下文

```
GET /log-search/api/context?component=higress-gateway&line=1234&before=10&after=10
Authorization: Bearer <token>
```

### 日志统计

```
GET /log-search/api/stats?component=higress-gateway&hours=24
Authorization: Bearer <token>
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
Authorization: Bearer <token>
```

| 参数 | 说明 |
|------|------|
| `format` | 输出格式：`json`（默认）或 `csv` |

### Dashboard API

**系统状态**
```
GET /log-search/api/status
Authorization: Bearer <token>
```

响应:
```json
{
  "openclaw": {
    "status": "running",
    "uptime": 86400,
    "version": "1.0.0",
    "startTime": "2024-03-23T00:00:00.000Z"
  },
  "workers": [
    {
      "name": "abackend",
      "status": "working",
      "lastActive": "2024-03-24T14:00:00.000Z",
      "currentTask": "Processing logs"
    }
  ],
  "timestamp": "2024-03-24T14:00:00.000Z"
}
```

## 📁 项目结构

```
skill/
├── server.js           # 主入口（HTTP 服务）
├── config.js           # 配置文件（含认证密钥）
├── routes/
│   ├── health.js       # 健康检查
│   ├── components.js   # 组件列表
│   ├── logs.js         # 日志查询/上下文/导出/删除
│   ├── stats.js        # 日志统计
│   ├── status.js       # 系统状态（Dashboard）
│   └── auth.js         # 身份认证
├── services/
│   ├── logReader.js    # 日志读取（缓存）
│   ├── logParser.js    # 日志解析（多格式）
│   ├── statsCalculator.js # 统计计算
│   └── statusService.js # 系统状态服务
└── utils/
    └── cache.js        # LRU 缓存
```

## ⚙️ 配置

日志组件配置在 `skill/config.js` 中：

```javascript
// 认证密钥（一次性使用后失效）
const AUTH_TOKENS = new Set([
  'your-token-here'
]);

// 日志组件
const COMPONENTS = {
  "higress-gateway": { name: "Higress Gateway", file: "/var/log/hiclaw/higress-gateway.log" },
  // 添加更多组件...
};
```

## 📦 依赖

- **必需**: Node.js >= 18
- **零外部依赖**: 所有功能使用 Node.js 内置模块实现

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
EXPOSE 19996
CMD ["node", "skill/server.js"]
```

## 🎨 Dashboard 功能

### OpenClaw 状态
- 运行状态（运行中/停止）
- 启动时间
- 运行时长
- 版本信息

### Worker 状态
- Worker 列表
- 当前状态（运行中/停止/工作中）
- 最后活动时间
- 当前任务（工作中时显示）
- 工作动画效果（状态为 working 时）

## 📄 License

MIT