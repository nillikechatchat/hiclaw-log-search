/**
 * HiClaw Log Search v2.1 - 配置文件
 */

const path = require('path');

// 日志组件配置
const COMPONENTS = {
  "higress-gateway": { name: "Higress Gateway", file: "/var/log/hiclaw/higress-gateway.log" },
  "higress-controller": { name: "Higress Controller", file: "/var/log/hiclaw/higress-controller.log" },
  "higress-pilot": { name: "Higress Pilot", file: "/var/log/hiclaw/higress-pilot.log" },
  "higress-console": { name: "Higress Console", file: "/var/log/hiclaw/higress-console.log" },
  "openclaw-gateway": { name: "OpenClaw Gateway", file: "/var/log/hiclaw/manager-agent.log" },
  "openclaw-gateway-error": { name: "OpenClaw Gateway Error", file: "/var/log/hiclaw/manager-agent-error.log" },
  "manager-agent": { name: "Manager Agent", file: "/var/log/hiclaw/manager-agent.log" },
  "mc-mirror": { name: "MinIO Mirror", file: "/var/log/hiclaw/mc-mirror.log" },
  "minio": { name: "MinIO", file: "/var/log/hiclaw/minio.log" },
  "tuwunel": { name: "Matrix Server", file: "/var/log/hiclaw/tuwunel.log" },
  "nginx-access": { name: "Nginx Access", file: "/var/log/nginx/access.log" },
  "nginx-error": { name: "Nginx Error", file: "/var/log/nginx/error.log" },
  "supervisord": { name: "Supervisor", file: "/var/log/supervisord.log" }
};

// 服务器配置
const SERVER_CONFIG = {
  port: process.env.LOG_SEARCH_PORT || 16654,
  host: process.env.LOG_SEARCH_HOST || "127.0.0.1",
  corsOrigin: process.env.LOG_SEARCH_CORS || "*"
};

// 认证配置 - 一次性密钥
// 使用环境变量或默认值
const AUTH_TOKENS = new Set([
  process.env.HICLAW_AUTH_TOKEN || 'hiclaw-log-search-default-token-2026'
].filter(Boolean));

// 缓存配置
const CACHE_CONFIG = {
  maxSize: 100 * 1024 * 1024,  // 最大 100MB
  ttl: 60000,                   // 缓存 60 秒
  fileHandlePool: 10            // 文件句柄池大小
};

// 日志级别
const LOG_LEVELS = {
  ERROR: { priority: 4, color: '#ff4757', label: 'ERROR' },
  WARN: { priority: 3, color: '#ffa502', label: 'WARN' },
  INFO: { priority: 2, color: '#3498db', label: 'INFO' },
  DEBUG: { priority: 1, color: '#9b59b6', label: 'DEBUG' }
};

// 日志级别检测模式
const LEVEL_PATTERNS = [
  { level: 'ERROR', patterns: [/\bERROR\b/gi, /\bFATAL\b/gi, /\bCRITICAL\b/gi] },
  { level: 'WARN', patterns: [/\bWARN(ING)?\b/gi] },
  { level: 'INFO', patterns: [/\bINFO\b/gi] },
  { level: 'DEBUG', patterns: [/\bDEBUG\b/gi, /\bTRACE\b/gi] }
];

// API 路径前缀
const API_PREFIX = "/log-search/api";

// OpenClaw 状态配置
const OPENCLAW_CONFIG = {
  managerPidFile: '/var/run/manager-agent.pid',
  workersRegistry: '/root/manager-workspace/workers-registry.json'
};

module.exports = {
  COMPONENTS,
  SERVER_CONFIG,
  CACHE_CONFIG,
  LOG_LEVELS,
  LEVEL_PATTERNS,
  API_PREFIX,
  AUTH_TOKENS,
  OPENCLAW_CONFIG
};