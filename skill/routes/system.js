/**
 * 系统管理路由
 * 版本检查、升级、卸载
 */

const url = require('url');
const { 
  getVersion, 
  checkUpgrade, 
  executeUpgrade, 
  executeUninstall,
  getUninstallConfirmCode 
} = require('../services/systemService');

/**
 * 获取版本信息
 */
function handleGetVersion(req, res) {
  const version = getVersion();
  res.end(JSON.stringify(version));
}

/**
 * 检查升级
 */
async function handleCheckUpgrade(req, res) {
  const result = await checkUpgrade();
  res.end(JSON.stringify(result));
}

/**
 * 执行升级
 */
async function handleExecuteUpgrade(req, res) {
  // 检查是否为本地调用
  const clientIp = req.socket.remoteAddress || '';
  const isLocal = clientIp === '127.0.0.1' || 
                  clientIp === '::1' || 
                  clientIp === '::ffff:127.0.0.1';

  if (!isLocal) {
    res.statusCode = 403;
    res.end(JSON.stringify({ 
      error: 'Forbidden', 
      message: 'Upgrade can only be executed from localhost' 
    }));
    return;
  }

  const result = await executeUpgrade();
  
  if (result.success) {
    res.end(JSON.stringify(result));
  } else {
    res.statusCode = 500;
    res.end(JSON.stringify(result));
  }
}

/**
 * 执行卸载
 */
async function handleUninstall(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const confirmCode = parsedUrl.query.confirm;

  if (!confirmCode) {
    // 返回需要确认码的提示
    res.statusCode = 400;
    res.end(JSON.stringify({
      error: 'Confirmation required',
      message: 'This is a destructive operation. Please provide confirm parameter.',
      hint: 'Call from localhost to get confirm code: GET /system/uninstall/code',
    }));
    return;
  }

  const result = await executeUninstall(confirmCode);
  
  if (result.success) {
    res.end(JSON.stringify(result));
  } else {
    res.statusCode = 400;
    res.end(JSON.stringify(result));
  }
}

/**
 * 获取卸载确认码（仅本地）
 */
function handleGetUninstallCode(req, res) {
  const clientIp = req.socket.remoteAddress || '';
  const result = getUninstallConfirmCode(clientIp);
  
  if (result.error) {
    res.statusCode = 403;
    res.end(JSON.stringify(result));
    return;
  }
  
  res.end(JSON.stringify(result));
}

module.exports = {
  handleGetVersion,
  handleCheckUpgrade,
  handleExecuteUpgrade,
  handleUninstall,
  handleGetUninstallCode,
};