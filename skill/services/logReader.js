/**
 * 日志读取服务
 * 支持缓存、增量读取
 */

const fs = require('fs');
const path = require('path');
const { logCache, fileStateCache } = require('../utils/cache');
const { parseLogs, getContext: parseContext } = require('./logParser');
const { COMPONENTS } = require('../config');

// 导出 parseLogs 供其他模块使用
module.exports.parseLogs = parseLogs;

/**
 * 读取日志文件内容
 */
function readLogFile(componentId, options = {}) {
  const info = COMPONENTS[componentId];
  if (!info) {
    return { error: 'Component not found', code: 404 };
  }

  const filepath = info.file;
  
  try {
    const stat = fs.statSync(filepath);
    const hasChanged = fileStateCache.hasChanged(filepath, stat);
    
    // 构建缓存键 - 包含过滤条件
    const { maxLines = 1000, level = 'ALL', search = '', regex = '', startTime = '', endTime = '' } = options;
    const filterKey = `${level}:${search}:${regex}:${startTime}:${endTime}`;
    const cacheKey = `${componentId}:${stat.size}:${stat.mtime.getTime()}:${maxLines}:${filterKey}`;
    
    if (!hasChanged && !options.forceRefresh) {
      const cached = logCache.get(cacheKey);
      if (cached) {
        return {
          component: componentId,
          name: info.name,
          file: filepath,
          size: stat.size,
          cached: true,
          ...cached
        };
      }
    }

    // 读取文件
    const content = fs.readFileSync(filepath, 'utf-8');
    
    // 解析日志
    const logs = parseLogs(content, { maxLines, level, search, regex, startTime, endTime });

    const result = {
      total: logs.length,
      logs,
      fileSize: stat.size,
      lastModified: stat.mtime.toISOString()
    };

    // 更新缓存
    logCache.set(cacheKey, result);
    fileStateCache.update(filepath, stat);

    return {
      component: componentId,
      name: info.name,
      file: filepath,
      size: stat.size,
      cached: false,
      ...result
    };
  } catch (e) {
    if (e.code === 'ENOENT') {
      return { error: 'Log file not found', file: filepath, code: 404 };
    }
    return { error: e.message, code: 500 };
  }
}

/**
 * 获取日志上下文
 */
function getLogContext(componentId, lineNumber, before = 10, after = 10) {
  const info = COMPONENTS[componentId];
  if (!info) {
    return { error: 'Component not found', code: 404 };
  }

  try {
    const content = fs.readFileSync(info.file, 'utf-8');
    const context = getContext(content, lineNumber, before, after);
    
    return {
      component: componentId,
      name: info.name,
      ...context
    };
  } catch (e) {
    return { error: e.message, code: 500 };
  }
}

/**
 * 获取组件列表及状态
 */
function getComponents() {
  const components = [];
  
  for (const [id, info] of Object.entries(COMPONENTS)) {
    try {
      const stat = fs.statSync(info.file);
      components.push({
        id,
        name: info.name,
        file: info.file,
        size: stat.size,
        lastModified: stat.mtime.toISOString(),
        exists: true
      });
    } catch {
      components.push({
        id,
        name: info.name,
        file: info.file,
        size: 0,
        exists: false
      });
    }
  }
  
  return { components, total: components.length };
}

/**
 * 导出日志
 */
function exportLogs(componentId, format = 'json', options = {}) {
  const result = readLogFile(componentId, { ...options, maxLines: options.maxLines || 5000 });
  
  if (result.error) {
    return result;
  }

  if (format === 'csv') {
    const csv = logsToCSV(result.logs);
    return {
      data: csv,
      contentType: 'text/csv',
      filename: `logs-${componentId}-${Date.now()}.csv`
    };
  }

  // 默认 JSON
  return {
    data: JSON.stringify(result.logs, null, 2),
    contentType: 'application/json',
    filename: `logs-${componentId}-${Date.now()}.json`
  };
}

/**
 * 转换日志为 CSV
 */
function logsToCSV(logs) {
  if (logs.length === 0) return '';
  
  const headers = ['timestamp', 'level', 'message'];
  const rows = logs.map(log => [
    `"${log.timestamp}"`,
    `"${log.level}"`,
    `"${(log.message || '').replace(/"/g, '""')}"`
  ]);
  
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * 监控文件变化（用于实时日志）
 */
function watchFile(filepath, callback) {
  let lastSize = 0;
  let lastMtime = 0;
  
  try {
    const stat = fs.statSync(filepath);
    lastSize = stat.size;
    lastMtime = stat.mtime.getTime();
  } catch {
    // 文件不存在
  }

  const checkInterval = setInterval(() => {
    try {
      const stat = fs.statSync(filepath);
      if (stat.size > lastSize || stat.mtime.getTime() > lastMtime) {
        // 读取新增内容
        const fd = fs.openSync(filepath, 'r');
        const buffer = Buffer.alloc(stat.size - lastSize);
        fs.readSync(fd, buffer, 0, buffer.length, lastSize);
        fs.closeSync(fd);
        
        const newContent = buffer.toString('utf-8');
        callback(newContent, stat);
        
        lastSize = stat.size;
        lastMtime = stat.mtime.getTime();
      }
    } catch (e) {
      // 文件可能被删除或重命名
      if (e.code !== 'ENOENT') {
        console.error('Watch error:', e.message);
      }
    }
  }, 500);  // 每 500ms 检查一次

  return {
    stop: () => clearInterval(checkInterval),
    getLastPosition: () => lastSize
  };
}

module.exports = {
  readLogFile,
  getLogContext,
  getComponents,
  exportLogs,
  watchFile
};