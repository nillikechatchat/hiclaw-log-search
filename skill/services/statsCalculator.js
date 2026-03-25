/**
 * 日志统计计算服务
 */

const fs = require('fs');
const { COMPONENTS } = require('../config');
const { parseLine, detectLevel } = require('./logParser');

/**
 * 计算日志统计
 */
function calculateStats(componentId, options = {}) {
  const info = COMPONENTS[componentId];
  if (!info) {
    return { error: 'Component not found', code: 404 };
  }

  const { hours = 24 } = options;
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

  try {
    const content = fs.readFileSync(info.file, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());

    // 初始化统计数据
    const stats = {
      component: componentId,
      name: info.name,
      period: {
        start: startTime.toISOString(),
        end: new Date().toISOString(),
        hours
      },
      summary: {
        total: 0,
        byLevel: { ERROR: 0, WARN: 0, INFO: 0, DEBUG: 0 }
      },
      trend: initTrend(hours),
      topErrors: [],
      errorPatterns: new Map()
    };

    // 分析每条日志
    for (const line of lines) {
      const parsed = parseLine(line, 0);
      if (!parsed) continue;

      // 时间过滤
      const logTime = new Date(parsed.timestamp);
      if (logTime < startTime) continue;

      stats.summary.total++;
      stats.summary.byLevel[parsed.level] = (stats.summary.byLevel[parsed.level] || 0) + 1;

      // 更新趋势（按小时）
      const hourIndex = Math.floor((Date.now() - logTime.getTime()) / (60 * 60 * 1000));
      if (hourIndex >= 0 && hourIndex < stats.trend.length) {
        const trendItem = stats.trend[stats.trend.length - 1 - hourIndex];
        if (trendItem) {
          trendItem[parsed.level.toLowerCase()] = (trendItem[parsed.level.toLowerCase()] || 0) + 1;
        }
      }

      // 收集错误模式
      if (parsed.level === 'ERROR') {
        // 简化错误消息（移除变量部分）
        const pattern = simplifyErrorMessage(parsed.message);
        stats.errorPatterns.set(pattern, (stats.errorPatterns.get(pattern) || 0) + 1);
      }
    }

    // 提取 Top 错误
    stats.topErrors = Array.from(stats.errorPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([message, count]) => ({ message: message.substring(0, 200), count }));

    delete stats.errorPatterns;  // 不返回原始 Map

    return stats;
  } catch (e) {
    return { error: e.message, code: 500 };
  }
}

/**
 * 初始化趋势数据
 */
function initTrend(hours) {
  const trend = [];
  const now = new Date();
  
  for (let i = hours - 1; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
    trend.push({
      hour: hour.toISOString().substring(11, 16),  // HH:mm
      time: hour.toISOString(),
      error: 0,
      warn: 0,
      info: 0,
      debug: 0
    });
  }
  
  return trend;
}

/**
 * 简化错误消息（移除变量部分）
 */
function simplifyErrorMessage(message) {
  return message
    // 移除 UUID
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
    // 移除数字
    .replace(/\b\d+\b/g, '<NUM>')
    // 移除 IP 地址
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '<IP>')
    // 移除时间戳
    .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/g, '<TIME>')
    // 移除路径中的文件名
    .replace(/\/[\w\-\.]+\.\w+/g, '<FILE>')
    // 压缩空格
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
}

/**
 * 获取所有组件的概览统计
 */
function getOverviewStats() {
  const overviews = [];
  
  for (const [id, info] of Object.entries(COMPONENTS)) {
    try {
      const stat = fs.statSync(info.file);
      const quickStats = getQuickStats(info.file);
      
      overviews.push({
        id,
        name: info.name,
        size: stat.size,
        lastModified: stat.mtime.toISOString(),
        ...quickStats
      });
    } catch {
      overviews.push({
        id,
        name: info.name,
        size: 0,
        exists: false,
        error: 0,
        warn: 0,
        info: 0
      });
    }
  }
  
  return {
    components: overviews,
    total: overviews.length,
    generated: new Date().toISOString()
  };
}

/**
 * 快速统计（只统计最后 N 行）
 */
function getQuickStats(filepath, lines = 1000) {
  try {
    const fd = fs.openSync(filepath, 'r');
    const stat = fs.statSync(filepath);
    const bufferSize = Math.min(stat.size, 100 * 1024);
    const buffer = Buffer.alloc(bufferSize);
    
    fs.readSync(fd, buffer, 0, bufferSize, Math.max(0, stat.size - bufferSize));
    fs.closeSync(fd);

    const content = buffer.toString('utf-8');
    const logLines = content.split('\n').filter(l => l.trim()).slice(-lines);

    const counts = { error: 0, warn: 0, info: 0, debug: 0, total: logLines.length };
    
    for (const line of logLines) {
      const level = detectLevel(line);
      counts[level.toLowerCase()] = (counts[level.toLowerCase()] || 0) + 1;
    }

    return counts;
  } catch {
    return { error: 0, warn: 0, info: 0, debug: 0, total: 0 };
  }
}

module.exports = {
  calculateStats,
  getOverviewStats,
  getQuickStats
};