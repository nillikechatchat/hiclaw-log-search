/**
 * 认证路由
 */

const url = require('url');
const { generateToken, verifyToken, getAuthStatus, clearAllSessions } = require('../services/authService');
const { AUTH_TOKENS } = require('../config');

/**
 * 生成一次性密钥（仅限本地调用）
 */
function handleGenerateToken(req, res) {
  // 检查是否为本地调用
  const clientIp = req.socket.remoteAddress || '';
  const isLocal = clientIp === '127.0.0.1' || 
                  clientIp === '::1' || 
                  clientIp === '::ffff:127.0.0.1' ||
                  clientIp.startsWith('127.') ||
                  clientIp === 'localhost';

  if (!isLocal) {
    res.statusCode = 403;
    res.end(JSON.stringify({ 
      error: 'Forbidden', 
      message: 'Token generation only allowed from localhost' 
    }));
    return;
  }

  try {
    const tokenData = generateToken();
    res.end(JSON.stringify({
      success: true,
      token: tokenData.token,
      expiresAt: new Date(tokenData.expiresAt).toISOString(),
      expiresIn: Math.floor((tokenData.expiresAt - Date.now()) / 1000) + ' seconds',
      message: 'Token generated successfully. Use this token to authenticate.',
      usage: 'Add header: Authorization: Bearer <token>'
    }));
  } catch (e) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: 'Token generation failed', message: e.message }));
  }
}

/**
 * 验证密钥
 */
function handleVerifyToken(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const token = parsedUrl.query.token || 
                req.headers['authorization']?.replace('Bearer ', '');

  if (!token) {
    res.statusCode = 400;
    res.end(JSON.stringify({ 
      error: 'Token required',
      message: 'Provide token via query parameter or Authorization header'
    }));
    return;
  }

  // 首先检查静态 token
  if (AUTH_TOKENS.has(token)) {
    res.end(JSON.stringify({
      success: true,
      message: 'Static token verified',
      type: 'static',
    }));
    return;
  }

  // 检查动态 token
  const result = verifyToken(token);
  
  if (result.valid) {
    // 设置 Cookie
    if (result.sessionId) {
      res.setHeader('Set-Cookie', [
        `session_id=${result.sessionId}; Path=/log-search/; HttpOnly; SameSite=Strict; Max-Age=86400`
      ]);
    }
    
    res.end(JSON.stringify({
      success: true,
      message: result.message,
      sessionId: result.sessionId,
      type: 'session',
      expiresAt: result.expiresAt ? new Date(result.expiresAt).toISOString() : null,
    }));
  } else {
    res.statusCode = 401;
    res.end(JSON.stringify({
      success: false,
      error: result.error,
    }));
  }
}

/**
 * 获取认证状态（需要认证）
 */
function handleAuthStatus(req, res) {
  res.end(JSON.stringify(getAuthStatus()));
}

/**
 * 清理会话（仅限本地）
 */
function handleClearSessions(req, res) {
  const clientIp = req.socket.remoteAddress || '';
  const isLocal = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp.startsWith('127.');

  if (!isLocal) {
    res.statusCode = 403;
    res.end(JSON.stringify({ error: 'Forbidden' }));
    return;
  }

  const result = clearAllSessions();
  res.end(JSON.stringify(result));
}

module.exports = {
  handleGenerateToken,
  handleVerifyToken,
  handleAuthStatus,
  handleClearSessions,
};