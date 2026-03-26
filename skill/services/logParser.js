/**
 * 日志解析服务
 * 支持多种日志格式：纯文本、JSON、混合格式
 */

const { LEVEL_PATTERNS, LOG_LEVELS } = require('../config');

/**
 * 解析单行日志
 * @param {string} line - 日志行
 * @param {number} lineNumber - 行号
 * @returns {Object} 解析后的日志对象
 */
function parseLine(line, lineNumber = 0) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // 尝试 JSON 格式解析
  if (trimmed.startsWith('{')) {
    const jsonLog = tryParseJson(trimmed, lineNumber);
    if (jsonLog) return jsonLog;
  }

  // 纯文本格式解析
  return parsePlainText(trimmed, lineNumber);
}

/**
 * 尝试解析 JSON 格式日志
 */
function tryParseJson(line, lineNumber) {
  try {
    const parsed = JSON.parse(line);
    
    // 提取时间戳
    let timestamp = parsed.timestamp || parsed.time || parsed['@timestamp'] || parsed.start_time || new Date().toISOString();
    
    // 提取级别 - 优先使用显式级别，其次根据 response_code 推断
    let level = parsed.level || parsed.severity || parsed.lvl;
    
    if (!level) {
      // 对于 Envoy/Higress 访问日志，根据 response_code 推断级别
      const responseCode = parseInt(parsed.response_code || parsed.status || parsed.responseStatus || parsed.code);
      if (responseCode) {
        if (responseCode >= 500) {
          level = 'ERROR';
        } else if (responseCode >= 400) {
          level = 'WARN';
        } else {
          level = 'INFO';
        }
      } else {
        level = 'INFO';
      }
    }
    
    level = normalizeLevel(level);
    
    // 提取消息 - 构建更有意义的消息
    let message;
    if (parsed.message || parsed.msg) {
      message = parsed.message || parsed.msg;
    } else if (parsed.method && parsed.path) {
      // Envoy/Higress 访问日志格式
      message = `${parsed.method} ${parsed.path} → ${parsed.response_code || parsed.status || '?'}`;
    } else {
      message = line;
    }
    
    // 保留其他字段作为额外数据
    const extra = { ...parsed };
    delete extra.timestamp;
    delete extra.time;
    delete extra['@timestamp'];
    delete extra.level;
    delete extra.severity;
    delete extra.lvl;
    delete extra.message;
    delete extra.msg;

    return {
      id: lineNumber,
      timestamp: formatTimestamp(timestamp),
      level,
      message: typeof message === 'object' ? JSON.stringify(message) : String(message),
      raw: line,
      extra: Object.keys(extra).length > 0 ? extra : undefined,
      format: 'json'
    };
  } catch {
    return null;
  }
}

/**
 * 解析纯文本格式日志
 */
function parsePlainText(line, lineNumber) {
  // 提取时间戳
  let timestamp = extractTimestamp(line);
  
  // 检测日志级别
  const level = detectLevel(line);
  
  // 提取消息（移除时间戳前缀）
  let message = line;
  if (timestamp) {
    message = line.replace(/^\d{4}[-\/]\d{2}[-\/]\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?\s*/, '').trim();
  }

  return {
    id: lineNumber,
    timestamp: timestamp || new Date().toISOString(),
    level,
    message: message.substring(0, 2000), // 限制长度
    raw: line,
    format: 'text'
  };
}

/**
 * 从行中提取时间戳
 */
function extractTimestamp(line) {
  // ISO 8601 格式: 2024-03-24T14:30:00.000Z
  const isoMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/);
  if (isoMatch) return isoMatch[1];

  // 常见格式: 2024-03-24 14:30:00
  const commonMatch = line.match(/^(\d{4}[-\/]\d{2}[-\/]\d{2}[ ]\d{2}:\d{2}:\d{2})/);
  if (commonMatch) return commonMatch[1];

  // Syslog 格式: Mar 24 14:30:00
  const syslogMatch = line.match(/^([A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/);
  if (syslogMatch) {
    // 转换为完整日期
    const now = new Date();
    const year = now.getFullYear();
    return `${year}-${syslogMatch[1]}`;
  }

  return null;
}

/**
 * 检测日志级别
 */
function detectLevel(line) {
  // 检查行首是否有明确的级别标记（优先级最高）
  const lineStartMatch = line.match(/^\s*\[(ERROR|WARN|INFO|DEBUG|FATAL|CRITICAL)\]/i);
  if (lineStartMatch) {
    return normalizeLevel(lineStartMatch[1]);
  }

  // 按优先级检查级别模式
  for (const { level, patterns } of LEVEL_PATTERNS) {
    for (const pattern of patterns) {
      // 重置正则状态
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        // 排除误判情况
        if (level === 'ERROR') {
          // 排除 "no error", "without error", "error-free" 等
          if (/no\s+error|without\s+error|error-?free|no\s+errors/i.test(line)) {
            continue;
          }
        }
        return level;
      }
    }
  }

  return 'INFO';
}

/**
 * 标准化日志级别
 */
function normalizeLevel(level) {
  const upper = String(level).toUpperCase().trim();
  
  // 映射常见变体
  const levelMap = {
    'FATAL': 'ERROR',
    'CRITICAL': 'ERROR',
    'CRIT': 'ERROR',
    'ERR': 'ERROR',
    'WARNING': 'WARN',
    'INFORMATION': 'INFO',
    'TRACE': 'DEBUG',
    'VERBOSE': 'DEBUG'
  };

  return levelMap[upper] || (LOG_LEVELS[upper] ? upper : 'INFO');
}

/**
 * 格式化时间戳
 */
function formatTimestamp(ts) {
  if (!ts) return new Date().toISOString();
  
  // 如果已经是 ISO 格式，直接返回
  if (ts.includes('T') && ts.length >= 19) {
    return ts;
  }
  
  // 尝试解析并转换为 ISO
  try {
    const date = new Date(ts);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch {}
  
  return ts;
}

/**
 * 批量解析日志
 * @param {string} content - 日志文件内容
 * @param {Object} options - 解析选项
 * @returns {Array} 解析后的日志数组
 */
function parseLogs(content, options = {}) {
  const { 
    maxLines = 1000, 
    level, 
    search, 
    regex,
    startTime, 
    endTime,
    offset = 0
  } = options;

  let lines = content.split('\n').filter(l => l.trim());
  
  // 只取最后 maxLines 行
  if (lines.length > maxLines) {
    lines = lines.slice(-maxLines);
  }

  // 解析每一行
  let logs = [];
  let lineNumber = offset;
  let lastLog = null;

  for (const line of lines) {
    const parsed = parseLine(line, lineNumber++);
    if (!parsed) continue;

    // 检测堆栈跟踪（合并到上一条日志）
    if (isStackTrace(line) && lastLog) {
      lastLog.stackTrace = lastLog.stackTrace || [];
      lastLog.stackTrace.push(line);
      lastLog.message += '\n' + line;
      continue;
    }

    logs.push(parsed);
    lastLog = parsed;
  }

  // 应用过滤器
  logs = applyFilters(logs, { level, search, regex, startTime, endTime });

  return logs;
}

/**
 * 检测是否为堆栈跟踪行
 */
function isStackTrace(line) {
  // Java/Kotlin: at com.example.Class.method(File.java:123)
  // Node.js: at Object.method (file.js:123:45)
  // Python: File "file.py", line 123, in method
  // Go: goroutine 1 [running]:
  return /^\s+at\s+/.test(line) ||
         /^\s+File\s+"/.test(line) ||
         /^\s+goroutine\s+\d+/.test(line) ||
         /^\s+#\d+\s+/.test(line);
}

/**
 * 应用过滤器
 */
function applyFilters(logs, filters) {
  const { level, search, regex, startTime, endTime } = filters;

  return logs.filter(log => {
    // 级别过滤
    if (level && level !== 'ALL' && log.level !== level) {
      return false;
    }

    // 时间范围过滤
    if (startTime || endTime) {
      const logTime = new Date(log.timestamp).getTime();
      if (startTime && logTime < new Date(startTime).getTime()) return false;
      if (endTime && logTime > new Date(endTime).getTime()) return false;
    }

    // 正则搜索
    if (regex) {
      try {
        const re = new RegExp(regex, 'gi');
        if (!re.test(log.message) && !re.test(log.raw || '')) return false;
      } catch {
        // 正则无效，跳过此过滤
      }
    }

    // 关键词搜索
    if (search) {
      const searchLower = search.toLowerCase();
      if (!log.message.toLowerCase().includes(searchLower) &&
          !(log.raw || '').toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * 获取日志上下文
 * @param {string} content - 日志文件内容
 * @param {number} targetLine - 目标行号
 * @param {number} before - 前面行数
 * @param {number} after - 后面行数
 */
function getContext(content, targetLine, before = 10, after = 10) {
  const lines = content.split('\n').filter(l => l.trim());
  const start = Math.max(0, targetLine - before);
  const end = Math.min(lines.length, targetLine + after + 1);

  const result = {
    target: null,
    before: [],
    after: []
  };

  for (let i = start; i < end; i++) {
    const parsed = parseLine(lines[i], i);
    if (!parsed) continue;

    if (i === targetLine) {
      result.target = parsed;
    } else if (i < targetLine) {
      result.before.push(parsed);
    } else {
      result.after.push(parsed);
    }
  }

  return result;
}

module.exports = {
  parseLine,
  parseLogs,
  detectLevel,
  normalizeLevel,
  extractTimestamp,
  getContext,
  applyFilters
};