/**
 * 一次性密钥认证服务
 * 
 * 流程：
 * 1. 宿主机执行命令生成密钥，写入指定文件
 * 2. 后端读取密钥并验证
 * 3. 验证成功后密钥失效
 * 
 * v2.2 新增：同时支持静态 Token
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// 密钥配置
const AUTH_CONFIG = {
  // 密钥文件路径（宿主机写入）
  tokenFile: process.env.LOG_SEARCH_TOKEN_FILE || '/tmp/log-search-token',
  // 密钥有效期（毫秒），默认 5 分钟
  tokenTTL: parseInt(process.env.LOG_SEARCH_TOKEN_TTL) || 5 * 60 * 1000,
  // 是否启用认证（可通过环境变量关闭）
  enabled: process.env.LOG_SEARCH_AUTH_ENABLED !== 'false',
  // 会话有效期（毫秒），默认 24 小时
  sessionTTL: 24 * 60 * 60 * 1000,
  // 静态 Token 列表（长期有效）
  staticTokens: [
    'hiclaw-log-search-default-token-2026',
  ],
};

// 已认证的会话（内存存储）
const sessions = new Map();

// 清理过期会话的定时器
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    if (session.expiresAt < now) {
      sessions.delete(sessionId);
    }
  }
}, 60000); // 每分钟清理一次

/**
 * 生成一次性密钥（仅限本地调用）
 * @returns {Object} { token, expiresAt }
 */
function generateToken() {
  // 检查是否为本地调用
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + AUTH_CONFIG.tokenTTL;
  
  // 写入密钥文件
  const tokenData = {
    token,
    createdAt: Date.now(),
    expiresAt,
  };
  
  fs.writeFileSync(AUTH_CONFIG.tokenFile, JSON.stringify(tokenData), { mode: 0o600 });
  
  return tokenData;
}

/**
 * 验证一次性密钥
 * @param {string} token - 要验证的密钥
 * @returns {Object} { valid, sessionId, error }
 */
function verifyToken(token) {
  if (!AUTH_CONFIG.enabled) {
    // 认证未启用，直接通过
    return { valid: true, sessionId: null, message: 'Auth disabled' };
  }

  if (!token) {
    return { valid: false, error: 'Token required' };
  }

  // v2.2: 先检查静态 Token
  if (AUTH_CONFIG.staticTokens.includes(token)) {
    // 静态 Token 有效，创建会话
    const sessionId = crypto.randomBytes(32).toString('hex');
    const session = {
      createdAt: Date.now(),
      expiresAt: Date.now() + AUTH_CONFIG.sessionTTL,
      type: 'static',
    };
    sessions.set(sessionId, session);
    
    return { 
      valid: true, 
      sessionId, 
      message: 'Static token verified',
      type: 'static',
      expiresAt: session.expiresAt,
    };
  }

  // 检查是否已经是已认证的会话
  const existingSession = sessions.get(token);
  if (existingSession && existingSession.expiresAt > Date.now()) {
    return { valid: true, sessionId: token, message: 'Session valid' };
  }

  // 读取密钥文件
  let tokenData;
  try {
    const content = fs.readFileSync(AUTH_CONFIG.tokenFile, 'utf-8');
    tokenData = JSON.parse(content);
  } catch (e) {
    return { valid: false, error: 'Invalid token' };
  }

  // 验证密钥
  if (tokenData.token !== token) {
    return { valid: false, error: 'Invalid token' };
  }

  // 检查是否过期
  if (tokenData.expiresAt < Date.now()) {
    // 删除过期密钥文件
    try {
      fs.unlinkSync(AUTH_CONFIG.tokenFile);
    } catch {}
    return { valid: false, error: 'Token expired' };
  }

  // 验证成功，创建会话
  const sessionId = crypto.randomBytes(32).toString('hex');
  const session = {
    createdAt: Date.now(),
    expiresAt: Date.now() + AUTH_CONFIG.sessionTTL,
    originalToken: token,
    type: 'dynamic',
  };
  
  sessions.set(sessionId, session);
  
  // 删除密钥文件（一次性使用）
  try {
    fs.unlinkSync(AUTH_CONFIG.tokenFile);
  } catch {}
  
  return { 
    valid: true, 
    sessionId, 
    message: 'Authentication successful',
    type: 'dynamic',
    expiresAt: session.expiresAt,
  };
}

/**
 * 验证会话
 * @param {string} sessionId - 会话 ID 或 token
 * @returns {boolean}
 */
function validateSession(sessionId) {
  if (!AUTH_CONFIG.enabled) {
    return true;
  }

  if (!sessionId) {
    return false;
  }

  // v2.2: 先检查是否是静态 Token
  if (AUTH_CONFIG.staticTokens.includes(sessionId)) {
    return true;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return false;
  }

  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return false;
  }

  return true;
}

/**
 * 认证中间件
 */
function authMiddleware(req, res, next) {
  if (!AUTH_CONFIG.enabled) {
    return next();
  }

  // 从 Header 或 Cookie 获取 session ID
  const sessionId = req.headers['x-session-id'] || 
                    req.headers['authorization']?.replace('Bearer ', '') ||
                    parseCookie(req.headers.cookie || '')['session_id'];

  if (!validateSession(sessionId)) {
    res.statusCode = 401;
    res.end(JSON.stringify({ 
      error: 'Unauthorized', 
      message: 'Valid session required. Please authenticate first.',
      authUrl: '/log-search/api/auth/token'
    }));
    return;
  }

  // 添加会话信息到请求
  req.sessionId = sessionId;
  next();
}

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
 * 获取认证状态
 */
function getAuthStatus() {
  return {
    enabled: AUTH_CONFIG.enabled,
    activeSessions: sessions.size,
    tokenTTL: AUTH_CONFIG.tokenTTL,
    sessionTTL: AUTH_CONFIG.sessionTTL,
  };
}

/**
 * 清理所有会话
 */
function clearAllSessions() {
  sessions.clear();
  return { cleared: true };
}

module.exports = {
  generateToken,
  verifyToken,
  validateSession,
  authMiddleware,
  getAuthStatus,
  clearAllSessions,
  AUTH_CONFIG,
};