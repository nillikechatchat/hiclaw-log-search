/**
 * HiClaw Log Search Server v2.1
 * 
 * 功能特性:
 * - 一次性密钥认证
 * - 多组件日志查询
 * - 高级搜索（正则、时间范围）
 * - 日志统计分析
 * - 日志导出（JSON/CSV）
 * - 日志上下文查看
 * - 日志删除功能
 * - Dashboard 状态 API
 * 
 * 移除功能:
 * - WebSocket 实时日志流（改用 HTTP 轮询）
 */

const http = require('http');
const crypto = require('crypto');
const { SERVER_CONFIG, API_PREFIX, AUTH_TOKENS } = require('./config');
const { handleHealth } = require('./routes/health');
const { handleComponents } = require('./routes/components');
const { handleLogs, handleContext, handleExport, handleDeleteLogs } = require('./routes/logs');
const { handleStats } = require('./routes/stats');
const { handleGenerateToken, handleVerifyToken, handleAuthStatus, handleClearSessions } = require('./routes/auth');
const { handleOpenClawStatus, handleWorkersStatus, handleOverview } = require('./routes/status');

/**
 * 验证认证 token
 */
function verifyAuth(req) {
  // 从 query 或 header 获取 token
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token') || 
                (req.headers.authorization || '').replace('Bearer ', '');
  
  if (!token) {
    return false;
  }
  
  // 检查静态 token 是否有效
  if (AUTH_TOKENS.has(token)) {
    return true;
  }
  
  // 检查会话是否有效（动态 token）
  const { validateSession } = require('./services/authService');
  if (validateSession(token)) {
    return true;
  }
  
  return false;
}

/**
 * 认证中间件
 */
function withAuth(handler) {
  return (req, res) => {
    // 健康检查不需要认证
    const pathname = req.url.split('?')[0];
    if (pathname === `${API_PREFIX}/health`) {
      return handler(req, res);
    }
    
    // 认证检查
    if (!verifyAuth(req)) {
      res.statusCode = 401;
      res.end(JSON.stringify({
        error: 'Unauthorized',
        message: 'Valid token required. Use /auth/verify to authenticate.'
      }));
      return;
    }
    
    return handler(req, res);
  };
}

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理 OPTIONS 预检请求
  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 路由分发
  try {
    // 认证路由（不需要认证）
    if (pathname === `${API_PREFIX}/auth/verify` && method === 'GET') {
      handleVerifyToken(req, res);
    }
    // 健康检查（不需要认证）
    else if (pathname === `${API_PREFIX}/health`) {
      handleHealth(req, res);
    }
    // 以下路由需要认证
    else if (pathname === `${API_PREFIX}/components`) {
      withAuth(handleComponents)(req, res);
    } else if (pathname === `${API_PREFIX}/logs` && method === 'GET') {
      withAuth(handleLogs)(req, res);
    } else if (pathname === `${API_PREFIX}/logs` && method === 'DELETE') {
      withAuth(handleDeleteLogs)(req, res);
    } else if (pathname === `${API_PREFIX}/context`) {
      withAuth(handleContext)(req, res);
    } else if (pathname === `${API_PREFIX}/export`) {
      withAuth(handleExport)(req, res);
    } else if (pathname === `${API_PREFIX}/stats`) {
      withAuth(handleStats)(req, res);
    } else if (pathname === `${API_PREFIX}/status/openclaw`) {
      withAuth(handleOpenClawStatus)(req, res);
    } else if (pathname === `${API_PREFIX}/status/workers`) {
      withAuth(handleWorkersStatus)(req, res);
    } else if (pathname === `${API_PREFIX}/status/overview`) {
      withAuth(handleOverview)(req, res);
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({
        error: 'Not found',
        path: pathname,
        availableEndpoints: [
          `${API_PREFIX}/health`,
          `${API_PREFIX}/auth/verify`,
          `${API_PREFIX}/components`,
          `${API_PREFIX}/logs (GET, DELETE)`,
          `${API_PREFIX}/context`,
          `${API_PREFIX}/export`,
          `${API_PREFIX}/stats`,
          `${API_PREFIX}/status/openclaw`,
          `${API_PREFIX}/status/workers`,
          `${API_PREFIX}/status/overview`
        ]
      }));
    }
  } catch (error) {
    console.error('Request error:', error);
    res.statusCode = 500;
    res.end(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }));
  }
});

/**
 * 启动服务器
 */
function start() {
  server.listen(SERVER_CONFIG.port, SERVER_CONFIG.host, () => {
    console.log('========================================');
    console.log('  HiClaw Log Search Server v2.1');
    console.log('========================================');
    console.log(`  HTTP:  http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}${API_PREFIX}/`);
    console.log('');
    console.log('Available API Endpoints:');
    console.log(`  GET  ${API_PREFIX}/health          - Health check`);
    console.log(`  GET  ${API_PREFIX}/auth/verify     - Verify token`);
    console.log(`  GET  ${API_PREFIX}/components      - List log components`);
    console.log(`  GET  ${API_PREFIX}/logs            - Query logs`);
    console.log(`  DEL  ${API_PREFIX}/logs            - Delete log file`);
    console.log(`  GET  ${API_PREFIX}/context         - Get log context`);
    console.log(`  GET  ${API_PREFIX}/export          - Export logs`);
    console.log(`  GET  ${API_PREFIX}/stats           - Log statistics`);
    console.log(`  GET  ${API_PREFIX}/status/openclaw - OpenClaw status`);
    console.log(`  GET  ${API_PREFIX}/status/workers  - Workers status`);
    console.log(`  GET  ${API_PREFIX}/status/overview - System overview`);
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
    console.log('Server closed');
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

module.exports = { server, verifyAuth };