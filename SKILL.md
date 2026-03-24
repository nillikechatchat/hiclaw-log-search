---
name: log-search
description: HiClaw 日志查询服务 - 查询和管理 HiClaw 系统所有组件的日志。提供 Web UI 和 REST API，支持日志过滤、搜索和实时刷新。
---

# HiClaw 日志查询 Skill

提供 HiClaw 系统的集中式日志查询服务，包括 Web UI 和 REST API。

## 功能特性

- **多组件日志**: 支持 12+ 个系统组件日志查询
- **级别过滤**: ERROR / WARN / INFO / DEBUG
- **关键词搜索**: 实时日志内容搜索
- **自动刷新**: 3 秒自动刷新
- **深色主题**: 护眼的深色 UI

## 支持的日志组件

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

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/log-search/api/health` | GET | 健康检查 |
| `/log-search/api/components` | GET | 获取组件列表 |
| `/log-search/api/logs` | GET | 查询日志 |

## 部署要求

- Node.js 18+
- Nginx
- Higress Gateway

## 安装

```bash
# 1. 复制文件到容器
cp -r skill/* /opt/log-search/

# 2. 启动 Node.js 服务
node /opt/log-search/server.js &

# 3. 配置 Nginx
cp ui/nginx.conf /etc/nginx/conf.d/log-search.conf
nginx -s reload

# 4. 配置 Higress 路由
# 参见 scripts/setup-higress.sh
```

## 配置

日志文件路径在 `server.js` 中的 `COMPONENTS` 对象定义，可根据实际环境修改。

## 访问

部署完成后通过 `http://<ip>:18080/log-search/` 访问。
