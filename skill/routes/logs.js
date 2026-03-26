/**
 * 日志查询路由
 */

const url = require('url');
const { readLogFile, getLogContext, exportLogs } = require('../services/logReader');

/**
 * 处理日志查询请求
 */
function handleLogs(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const query = parsedUrl.query;

  const options = {
    maxLines: Math.min(parseInt(query.lines) || 1000, 5000),
    level: query.level || 'ALL',
    search: query.search || '',
    regex: query.regex || '',
    startTime: query.startTime || query.start || '',
    endTime: query.endTime || query.end || ''
  };

  const result = readLogFile(query.component || 'higress-gateway', options);

  if (result.error) {
    res.statusCode = result.code || 500;
    res.end(JSON.stringify(result));
    return;
  }

  res.end(JSON.stringify(result));
}

/**
 * 处理日志上下文请求
 */
function handleContext(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const query = parsedUrl.query;

  const result = getLogContext(
    query.component,
    parseInt(query.line) || 0,
    parseInt(query.before) || 10,
    parseInt(query.after) || 10
  );

  if (result.error) {
    res.statusCode = result.code || 500;
    res.end(JSON.stringify(result));
    return;
  }

  res.end(JSON.stringify(result));
}

/**
 * 处理日志导出请求
 */
function handleExport(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const query = parsedUrl.query;

  const format = query.format || 'json';
  const options = {
    maxLines: Math.min(parseInt(query.lines) || 5000, 10000),
    level: query.level || 'ALL',
    search: query.search || '',
    regex: query.regex || '',
    startTime: query.startTime || '',
    endTime: query.endTime || ''
  };

  const result = exportLogs(query.component, format, options);

  if (result.error) {
    res.statusCode = result.code || 500;
    res.end(JSON.stringify(result));
    return;
  }

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
  res.end(result.data);
}

/**
 * 处理日志删除请求
 */
function handleDeleteLogs(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const query = parsedUrl.query;

  const component = query.component;

  if (!component) {
    res.statusCode = 400;
    res.end(JSON.stringify({
      error: 'Component required',
      message: 'Please specify a component to delete logs'
    }));
    return;
  }

  const fs = require('fs');
  const { COMPONENTS } = require('../config');

  const componentConfig = COMPONENTS[component];
  if (!componentConfig) {
    res.statusCode = 404;
    res.end(JSON.stringify({
      error: 'Component not found',
      message: `Unknown component: ${component}`
    }));
    return;
  }

  const logFile = componentConfig.file;

  try {
    // 检查文件是否存在
    if (!fs.existsSync(logFile)) {
      res.statusCode = 404;
      res.end(JSON.stringify({
        error: 'Log file not found',
        message: `Log file does not exist: ${logFile}`
      }));
      return;
    }

    // 清空日志文件（而不是删除）
    fs.truncateSync(logFile, 0);

    res.end(JSON.stringify({
      success: true,
      message: `Log file cleared: ${logFile}`,
      component,
      timestamp: new Date().toISOString()
    }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({
      error: 'Failed to clear log file',
      message: e.message
    }));
  }
}

module.exports = {
  handleLogs,
  handleContext,
  handleExport,
  handleDeleteLogs
};