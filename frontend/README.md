# HiClaw Log Analyzer v2.0

现代化的实时日志查看与分析工具。

## ✨ 功能特性

### 🔴 实时日志流
- WebSocket 实时日志推送
- 支持暂停/恢复实时流
- 新日志入场动画

### 🔍 高级搜索
- 关键词搜索
- 正则表达式支持
- 时间范围筛选
- 多条件组合过滤
- 搜索历史保存

### 📊 日志分析仪表盘
- 错误趋势图表（ECharts）
- 日志级别分布饼图
- Top 错误统计
- 实时统计面板

### 🎨 界面美化
- 现代化 UI 设计（玻璃效果、渐变）
- 响应式布局
- 暗色/亮色主题切换
- 日志语法高亮

### 📥 导出功能
- JSON 格式导出
- CSV 格式导出

### ⌨️ 快捷键支持
- `Ctrl+K` - 聚焦搜索
- `T` - 切换主题
- `R` - 刷新日志
- `Space` - 暂停/恢复实时流
- `?` - 显示帮助

## 🛠 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **样式**: Tailwind CSS 3
- **状态管理**: Zustand
- **图表**: ECharts
- **后端**: Node.js (原生 HTTP + WebSocket)

## 📁 项目结构

```
frontend/
├── src/
│   ├── components/      # React 组件
│   │   ├── Header.tsx   # 头部导航
│   │   ├── Sidebar.tsx  # 侧边栏组件列表
│   │   ├── SearchPanel.tsx # 搜索面板
│   │   ├── LogStream.tsx # 日志流组件
│   │   └── Dashboard.tsx # 统计仪表盘
│   ├── hooks/           # 自定义 Hooks
│   ├── stores/          # Zustand 状态管理
│   ├── services/        # API 服务
│   ├── types/           # TypeScript 类型定义
│   ├── utils/           # 工具函数
│   └── styles/          # 全局样式
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 🚀 快速开始

### 安装依赖

```bash
cd frontend
npm install
```

### 开发模式

```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
npm run build
```

## 🔧 配置

### API 代理

开发模式下，Vite 会自动代理 API 请求到后端：

```typescript
// vite.config.ts
proxy: {
  '/log-search/api': {
    target: 'http://127.0.0.1:19996',
    changeOrigin: true,
  },
  '/log-search/ws': {
    target: 'ws://127.0.0.1:19996',
    ws: true,
  },
}
```

### 环境变量

创建 `.env.local` 文件：

```
VITE_API_BASE=/log-search/api
VITE_WS_URL=ws://127.0.0.1:19996/log-search/ws
```

## 📝 后端 API

### REST API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/components` | GET | 获取组件列表 |
| `/api/logs` | GET | 查询日志 |
| `/api/stats` | GET | 获取统计数据 |
| `/api/context` | GET | 获取日志上下文 |
| `/api/export` | GET | 导出日志 |

### WebSocket

连接地址: `ws://host/log-search/ws`

消息格式：

```json
// 订阅
{ "action": "subscribe", "component": "higress-gateway" }

// 接收日志
{ "type": "log", "data": { "timestamp": "...", "level": "ERROR", "message": "..." } }
```

## 📄 License

MIT