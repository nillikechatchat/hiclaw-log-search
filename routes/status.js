/**
 * 系统状态路由
 */

const { 
  getOpenClawStatus, 
  getWorkersStatus, 
  getWorkerStatus, 
  getSystemOverview 
} = require('../services/statusService');

/**
 * 获取 OpenClaw 状态
 */
function handleOpenClawStatus(req, res) {
  const status = getOpenClawStatus();
  res.end(JSON.stringify(status));
}

/**
 * 获取 Worker 列表状态
 */
function handleWorkersStatus(req, res) {
  const status = getWorkersStatus();
  res.end(JSON.stringify(status));
}

/**
 * 获取单个 Worker 状态
 */
function handleWorkerStatus(req, res) {
  const url = require('url');
  const parsedUrl = url.parse(req.url, true);
  const name = parsedUrl.query.name;

  if (!name) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'Worker name required' }));
    return;
  }

  const status = getWorkerStatus(name);
  res.end(JSON.stringify(status));
}

/**
 * 获取系统概览
 */
function handleSystemOverview(req, res) {
  const overview = getSystemOverview();
  res.end(JSON.stringify(overview));
}

module.exports = {
  handleOpenClawStatus,
  handleWorkersStatus,
  handleWorkerStatus,
  handleSystemOverview,
};