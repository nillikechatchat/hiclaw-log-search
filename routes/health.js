/**
 * 健康检查路由 - v2.1
 * 移除 WebSocket 状态
 */

const { logCache } = require('../utils/cache');

/**
 * 处理健康检查请求
 */
function handleHealth(req, res) {
  const cacheStats = logCache.stats();

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    time: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    cache: {
      entries: cacheStats.entries,
      usagePercent: cacheStats.usagePercent
    },
    version: '2.1.0'
  }));
}

module.exports = {
  handleHealth
};