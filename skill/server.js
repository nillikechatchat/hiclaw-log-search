/**
 * HiClaw Log Search Server v2.2
 * 
 * 功能特性:
 * - 多组件日志查询
 * - 高级搜索（正则、时间范围）
 * - 日志统计分析
 * - 日志导出（JSON/CSV）
 * - 日志删除
 * - 一次性密钥认证
 * - OpenClaw/Worker 状态监控
 * - 版本检查/升级/卸载
 */

const http = require('http');
const { SERVER_CONFIG, API_PREFIX } = require('./config');
const { handleHealth } = require('./routes/health');
const { handleComponents } = require('./routes/components');
const { handleLogs, handleContext, handleExport, handleDeleteLogs } = require('./routes/logs');
const { handleStats } = require('./routes/stats');
const { 
  handleGenerateToken, 
  handleVerifyToken, 
  handleAuthStatus,
  handleClearSessions 
} = require('./routes/auth');
const { 
  handleOpenClawStatus, 
  handleWorkersStatus, 
  handleWorkerStatus,
  handleSystemOverview 
} = require('./routes/status');
const {
  handleGetVersion,
  handleCheckUpgrade,
  handleExecuteUpgrade,
  handleUninstall,
  handleGetUninstallCode,
} = require('./routes/system');
const { validateSession, AUTH_CONFIG } = require('./services/authService');

/**
 * 路由处理器映射
 */
const routes = {
  'GET': {
    [`${API_PREFIX}/health`]: handleHealth,
    [`${API_PREFIX}/components`]: handleComponents,
    [`${API_PREFIX}/logs`]: handleLogs,
    [`${API_PREFIX}/context`]: handleContext,
    [`${API_PREFIX}/stats`]: handleStats,
    [`${API_PREFIX}/auth/token`]: handleGenerateToken,
    [`${API_PREFIX}/auth/verify`]: handleVerifyToken,
    [`${API_PREFIX}/auth/status`]: handleAuthStatus,
    [`${API_PREFIX}/status/openclaw`]: handleOpenClawStatus,
    [`${API_PREFIX}/status/workers`]: handleWorkersStatus,
    [`${API_PREFIX}/status/worker`]: handleWorkerStatus,
    [`${API_PREFIX}/status/overview`]: handleSystemOverview,
    [`${API_PREFIX}/system/version`]: handleGetVersion,
    [`${API_PREFIX}/system/upgrade/check`]: handleCheckUpgrade,
    [`${API_PREFIX}/system/upgrade/execute`]: handleExecuteUpgrade,
    [`${API_PREFIX}/system/uninstall`]: handleUninstall,
    [`${API_PREFIX}/system/uninstall/code`]: handleGetUninstallCode,
    [`${API_PREFIX}/export`]: handleExport,
  },
  'POST': {
    [`${API_PREFIX}/auth/token`]: handleGenerateToken,
    [`${API_PREFIX}/auth/clear`]: handleClearSessions,
    [`${API_PREFIX}/system/upgrade/execute`]: handleExecuteUpgrade,
  },
  'DELETE': {
    [`${API_PREFIX}/logs`]: handleDeleteLogs,
  },
};

/**
 * 无需认证的路由
 */
const publicRoutes = [
  `${API_PREFIX}/health`,
  `${API_PREFIX}/auth/token`,
  `${API_PREFIX}/auth/verify`,
  `${API_PREFIX}/auth/clear`,
  `${API_PREFIX}/system/version`,
  `${API_PREFIX}/system/upgrade/check`,
];

/**
 * 创建 HTTP 服务器
 */
const server = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];
  const method = req.method;
  
  // 设置 CORS 和内容类型
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', SERVER_CONFIG.corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-ID');

  // 处理 OPTIONS 预检请求
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 查找路由处理器
  const handler = routes[method]?.[pathname];
  
  if (!handler) {
    res.statusCode = 404;
    res.end(JSON.stringify({
      error: 'Not found',
      path: pathname,
      method,
      availableEndpoints: Object.keys(routes[method] || {}),
    }));
    return;
  }

  // 检查是否需要认证
  if (AUTH_CONFIG.enabled && !publicRoutes.includes(pathname)) {
    const sessionId = req.headers['x-session-id'] || 
                      req.headers['authorization']?.replace('Bearer ', '') ||
                      parseCookie(req.headers.cookie || '')['session_id'];
    
    if (!validateSession(sessionId)) {
      res.statusCode = 401;
      res.end(JSON.stringify({ 
        error: 'Unauthorized', 
        message: 'Valid session required.',
        authUrl: `${API_PREFIX}/auth/token`
      }));
      return;
    }
  }

  // 执行处理器
  try {
    const result = handler(req, res);
    // 处理 async 函数返回的 Promise
    if (result instanceof Promise) {
      result.catch(e => {
        console.error('Handler error:', e);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Internal server error', message: e.message }));
        }
      });
    }
  } catch (e) {
    console.error('Handler error:', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Internal server error', message: e.message }));
  }
});

/**
 * 解析 Cookie
 */
function parseCookie(cookieString) {
  const cookies = {};
  cookieString.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = value;
    }
  });
  return cookies;
}

/**
 * 启动服务器
 */
function start() {
  server.listen(SERVER_CONFIG.port, SERVER_CONFIG.host, () => {
    console.log('========================================');
    console.log('  HiClaw Log Search Server v2.2');
    console.log('========================================');
    console.log(`  HTTP:  http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}${API_PREFIX}/`);
    console.log(`  Auth:  ${AUTH_CONFIG.enabled ? 'Enabled' : 'Disabled'}`);
    console.log('========================================');
    console.log('');
    console.log('API Endpoints:');
    console.log(`  GET  ${API_PREFIX}/health           - Health check`);
    console.log(`  GET  ${API_PREFIX}/components       - List log components`);
    console.log(`  GET  ${API_PREFIX}/logs             - Query logs`);
    console.log(`  DEL  ${API_PREFIX}/logs             - Clear log file`);
    console.log(`  GET  ${API_PREFIX}/stats            - Log statistics`);
    console.log('');
    console.log('Authentication:');
    console.log(`  GET  ${API_PREFIX}/auth/token       - Generate token (localhost only)`);
    console.log(`  GET  ${API_PREFIX}/auth/verify      - Verify token`);
    console.log('');
    console.log('System Status:');
    console.log(`  GET  ${API_PREFIX}/status/overview  - System overview`);
    console.log(`  GET  ${API_PREFIX}/status/workers   - Workers status`);
    console.log('');
    console.log('System Management:');
    console.log(`  GET  ${API_PREFIX}/system/version         - Get version`);
    console.log(`  GET  ${API_PREFIX}/system/upgrade/check   - Check for updates`);
    console.log(`  POST ${API_PREFIX}/system/upgrade/execute - Execute upgrade`);
    console.log(`  GET  ${API_PREFIX}/system/uninstall       - Uninstall (needs confirm)`);
    console.log('');
  });

  // 优雅关闭
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * 关闭服务器
 */
function shutdown() {
  console.log('Shutting down...');
  
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // 强制退出
  setTimeout(() => {
    console.log('Forced exit');
    process.exit(1);
  }, 5000);
}

// 启动
start();

// 导出供测试使用
module.exports = {
  server,
  routes,
};