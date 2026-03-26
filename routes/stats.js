/**
 * 统计查询路由
 */

const url = require('url');
const { calculateStats, getOverviewStats } = require('../services/statsCalculator');

/**
 * 处理统计请求
 */
function handleStats(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const query = parsedUrl.query;

  // 如果没有指定组件，返回概览
  if (!query.component) {
    const result = getOverviewStats();
    res.end(JSON.stringify(result));
    return;
  }

  const options = {
    hours: parseInt(query.hours) || 24
  };

  const result = calculateStats(query.component, options);

  if (result.error) {
    res.statusCode = result.code || 500;
    res.end(JSON.stringify(result));
    return;
  }

  res.end(JSON.stringify(result));
}

module.exports = {
  handleStats
};