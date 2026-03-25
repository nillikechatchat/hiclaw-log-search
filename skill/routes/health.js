/**
 * 健康检查路由
 */

const { logCache } = require('../utils/cache');
const { logWatcher } = require('../services/logWatcher');

/**
 * 处理健康检查请求
 */
function handleHealth(req, res) {
  const cacheStats = logCache.stats();
  const wsStats = logWatcher.getStatus();

  res.end(JSON.stringify({
    status: 'ok',
    time: new Date().toISOString(),
    uptime: process.uptime(),
    cache: cacheStats,
    websocket: {
      clients: wsStats.clients,
      watchers: wsStats.watchers.length
    }
  }));
}

module.exports = {
  handleHealth
};