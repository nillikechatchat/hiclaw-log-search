# HiClaw Log Search

HiClaw 系统日志查询服务，提供 Web UI 和 REST API，支持查询所有系统组件日志。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)

## 功能特性

- 🔍 **多组件日志查询** - 支持 12+ 个系统组件
- 🎨 **级别过滤** - ERROR / WARN / INFO / DEBUG
- 🔎 **关键词搜索** - 实时日志内容搜索
- 🔄 **自动刷新** - 3 秒自动刷新
- 🌙 **深色主题** - 护眼的深色 UI

## 支持的组件

| 组件 | 说明 |
|------|------|
| higress-gateway | Higress 网关日志 |
| higress-controller | Higress 控制器日志 |
| higress-pilot | Higress Pilot 日志 |
| higress-console | Higress 控制台日志 |
| higress-apiserver | Higress API Server 日志 |
| manager-agent | Manager Agent 日志 |
| mc-mirror | MinIO 同步日志 |
| minio | MinIO 服务日志 |
| tuwunel | Matrix 服务器日志 |
| nginx-access | Nginx 访问日志 |
| nginx-error | Nginx 错误日志 |
| supervisord | Supervisor 日志 |

## 快速开始

### 1. 安装

```bash
git clone https://github.com/YOUR_USERNAME/hiclaw-log-search.git
cd hiclaw-log-search
./scripts/install.sh /opt/log-search
```

### 2. 配置 Nginx

```bash
cp skill/nginx.conf /etc/nginx/conf.d/log-search.conf
nginx -s reload
```

### 3. 配置 Higress 路由

```bash
./scripts/setup-higress.sh
```

### 4. 访问

打开浏览器访问: `http://<ip>:18080/log-search/`

## API 文档

### 健康检查

```
GET /log-search/api/health
```

响应:
```json
{"status": "ok", "time": "2024-03-24T14:00:00.000Z"}
```

### 获取组件列表

```
GET /log-search/api/components
```

响应:
```json
{
  "components": [
    {"id": "higress-gateway", "name": "Higress Gateway", "size": 5242880, "exists": true},
    ...
  ]
}
```

### 查询日志

```
GET /log-search/api/logs?component=higress-gateway&lines=200&level=ERROR&search=timeout
```

参数:
- `component` - 组件 ID（必填）
- `lines` - 返回行数（默认 200，最大 1000）
- `level` - 日志级别过滤（ERROR/WARN/INFO/DEBUG）
- `search` - 关键词搜索

## 配置

日志文件路径在 `skill/server.js` 中的 `COMPONENTS` 对象定义，可根据实际环境修改：

```javascript
const COMPONENTS = {
  "higress-gateway": { name: "Higress Gateway", file: "/var/log/hiclaw/higress-gateway.log" },
  // 添加更多组件...
};
```

## 技术栈

- **后端**: Node.js (原生 HTTP 模块，无依赖)
- **前端**: HTML + Tailwind CSS
- **网关**: Nginx + Higress

## License

MIT
