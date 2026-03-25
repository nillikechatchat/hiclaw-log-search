/**
 * HiClaw Log Search Server
 * 
 * 功能特性:
 * - 多组件日志查询
 * - 高级搜索（正则、时间范围）
 * - WebSocket 实时日志流
 * - 日志统计分析
 * - 日志导出（JSON/CSV）
 * - 日志上下文查看
 */

const http = require('http');
const crypto = require('crypto');
const { SERVER_CONFIG, API_PREFIX } = require('./config');
const { handleHealth } = require('./routes/health');
const { handleComponents } = require('./routes/components');
const { handleLogs, handleContext, handleExport } = require('./routes/logs');
const { handleStats } = require('./routes/stats');
const { logWatcher } = require('./services/logWatcher');

// WebSocket 支持（如果 ws 模块可用）
let WebSocket = null;
try {
  WebSocket = require('ws');
} catch {
  console.log('WebSocket module not found, real-time features disabled');
}

/**
 * 创建 HTTP 服务器
 */
const server = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];
  
  // 设置 CORS 和内容类型
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', SERVER_CONFIG.corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // 路由分发
  if (pathname === `${API_PREFIX}/health`) {
    handleHealth(req, res);
  } else if (pathname === `${API_PREFIX}/components`) {
    handleComponents(req, res);
  } else if (pathname === `${API_PREFIX}/logs`) {
    handleLogs(req, res);
  } else if (pathname === `${API_PREFIX}/context`) {
    handleContext(req, res);
  } else if (pathname === `${API_PREFIX}/export`) {
    handleExport(req, res);
  } else if (pathname === `${API_PREFIX}/stats`) {
    handleStats(req, res);
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({
      error: 'Not found',
      path: pathname,
      availableEndpoints: [
        `${API_PREFIX}/health`,
        `${API_PREFIX}/components`,
        `${API_PREFIX}/logs`,
        `${API_PREFIX}/context`,
        `${API_PREFIX}/export`,
        `${API_PREFIX}/stats`
      ]
    }));
  }
});

/**
 * WebSocket 服务器
 */
let wss = null;

function setupWebSocket() {
  if (!WebSocket) {
    console.log('WebSocket not available, skipping real-time setup');
    return;
  }

  // 生成 WebSocket key（用于升级请求）
  wss = new WebSocket.Server({ noServer: true });

  // 处理 HTTP 升级请求
  server.on('upgrade', (request, socket, head) => {
    const pathname = request.url.split('?')[0];
    
    if (pathname === '/log-search/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // 处理 WebSocket 连接
  wss.on('connection', (ws, request) => {
    const clientId = logWatcher.addClient(ws);
    console.log(`WebSocket client ${clientId} connected`);

    ws.on('message', (message) => {
      logWatcher.handleMessage(clientId, message.toString());
    });

    ws.on('close', () => {
      logWatcher.removeClient(clientId);
      console.log(`WebSocket client ${clientId} disconnected`);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error.message);
    });
  });

  console.log('WebSocket server ready at /log-search/ws');
}

/**
 * 启动服务器
 */
function start() {
  server.listen(SERVER_CONFIG.port, SERVER_CONFIG.host, () => {
    console.log('========================================');
    console.log('  HiClaw Log Search Server');
    console.log('========================================');
    console.log(`  HTTP:  http://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}${API_PREFIX}/`);
    if (wss) {
      console.log(`  WS:    ws://${SERVER_CONFIG.host}:${SERVER_CONFIG.port}/log-search/ws`);
    }
    console.log('========================================');
    console.log('');
    console.log('Available API Endpoints:');
    console.log(`  GET ${API_PREFIX}/health      - Health check`);
    console.log(`  GET ${API_PREFIX}/components  - List log components`);
    console.log(`  GET ${API_PREFIX}/logs        - Query logs (with filters)`);
    console.log(`  GET ${API_PREFIX}/context     - Get log context`);
    console.log(`  GET ${API_PREFIX}/export      - Export logs (JSON/CSV)`);
    console.log(`  GET ${API_PREFIX}/stats       - Log statistics`);
    console.log('');
    if (wss) {
      console.log('WebSocket Actions:');
      console.log('  subscribe   - Subscribe to component logs');
      console.log('  unsubscribe - Unsubscribe from component');
      console.log('  pause       - Pause receiving logs');
      console.log('  resume      - Resume receiving logs');
      console.log('');
    }
  });

  // 设置 WebSocket
  setupWebSocket();

  // 优雅关闭
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * 关闭服务器
 */
function shutdown() {
  console.log('Shutting down...');
  
  if (wss) {
    logWatcher.close();
    wss.close(() => {
      console.log('WebSocket server closed');
    });
  }
  
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
  wss,
  logWatcher
};