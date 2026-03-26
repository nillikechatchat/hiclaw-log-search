/**
 * WebSocket 实时日志监控服务
 */

const fs = require('fs');
const { COMPONENTS, WS_CONFIG } = require('../config');
const { parseLine } = require('./logParser');

class LogWatcher {
  constructor() {
    this.clients = new Map();      // clientId -> { ws, subscriptions }
    this.watchers = new Map();     // componentId -> { interval, lastSize, subscribers }
    this.clientCounter = 0;
  }

  /**
   * 添加客户端
   */
  addClient(ws) {
    const clientId = ++this.clientCounter;
    this.clients.set(clientId, {
      ws,
      subscriptions: new Set(),
      paused: false
    });

    // 发送欢迎消息
    this.sendToClient(ws, {
      type: 'connected',
      clientId,
      message: 'WebSocket connected to HiClaw Log Stream'
    });

    // 设置心跳
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        this.sendToClient(ws, { type: 'heartbeat', time: Date.now() });
      } else {
        clearInterval(heartbeatInterval);
      }
    }, WS_CONFIG.heartbeatInterval);

    return clientId;
  }

  /**
   * 移除客户端
   */
  removeClient(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // 取消所有订阅
    for (const componentId of client.subscriptions) {
      this.unsubscribe(componentId, clientId);
    }

    this.clients.delete(clientId);
  }

  /**
   * 订阅组件日志
   */
  subscribe(componentId, clientId, filters = {}) {
    const client = this.clients.get(clientId);
    if (!client) return { error: 'Client not found' };

    const info = COMPONENTS[componentId];
    if (!info) return { error: 'Component not found' };

    // 添加到客户端订阅列表
    client.subscriptions.add(componentId);
    client.filters = { ...client.filters, [componentId]: filters };

    // 启动或增加组件监控
    if (!this.watchers.has(componentId)) {
      this.startWatcher(componentId);
    } else {
      const watcher = this.watchers.get(componentId);
      watcher.subscribers.add(clientId);
    }

    // 发送最近几条日志作为初始数据
    this.sendInitialLogs(componentId, client.ws, filters);

    return { success: true, componentId };
  }

  /**
   * 取消订阅
   */
  unsubscribe(componentId, clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions.delete(componentId);
      delete client.filters?.[componentId];
    }

    const watcher = this.watchers.get(componentId);
    if (watcher) {
      watcher.subscribers.delete(clientId);
      
      // 没有订阅者了，停止监控
      if (watcher.subscribers.size === 0) {
        this.stopWatcher(componentId);
      }
    }
  }

  /**
   * 暂停接收
   */
  pause(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.paused = true;
      return { success: true };
    }
    return { error: 'Client not found' };
  }

  /**
   * 恢复接收
   */
  resume(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.paused = false;
      return { success: true };
    }
    return { error: 'Client not found' };
  }

  /**
   * 启动组件监控
   */
  startWatcher(componentId) {
    const info = COMPONENTS[componentId];
    if (!info) return;

    let lastSize = 0;
    let lastMtime = 0;

    try {
      const stat = fs.statSync(info.file);
      lastSize = stat.size;
      lastMtime = stat.mtime.getTime();
    } catch {
      // 文件不存在，稍后检查
    }

    const watcher = {
      interval: setInterval(() => {
        this.checkFileChanges(componentId);
      }, 500),
      lastSize,
      lastMtime,
      subscribers: new Set()
    };

    this.watchers.set(componentId, watcher);
  }

  /**
   * 停止组件监控
   */
  stopWatcher(componentId) {
    const watcher = this.watchers.get(componentId);
    if (watcher) {
      clearInterval(watcher.interval);
      this.watchers.delete(componentId);
    }
  }

  /**
   * 检查文件变化
   */
  checkFileChanges(componentId) {
    const info = COMPONENTS[componentId];
    const watcher = this.watchers.get(componentId);
    if (!info || !watcher) return;

    try {
      const stat = fs.statSync(info.file);
      
      // 检查是否有新内容
      if (stat.size > watcher.lastSize) {
        // 读取新增内容
        const fd = fs.openSync(info.file, 'r');
        const buffer = Buffer.alloc(stat.size - watcher.lastSize);
        fs.readSync(fd, buffer, 0, buffer.length, watcher.lastSize);
        fs.closeSync(fd);

        const newContent = buffer.toString('utf-8');
        const newLines = newContent.split('\n').filter(l => l.trim());

        // 解析并发送新日志
        for (const line of newLines) {
          const parsed = parseLine(line, watcher.lastSize);
          if (parsed) {
            this.broadcastLog(componentId, parsed);
          }
        }

        watcher.lastSize = stat.size;
        watcher.lastMtime = stat.mtime.getTime();
      } else if (stat.mtime.getTime() > watcher.lastMtime) {
        // 文件可能被截断或轮转
        watcher.lastSize = stat.size;
        watcher.lastMtime = stat.mtime.getTime();
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.error(`Watch error for ${componentId}:`, e.message);
      }
    }
  }

  /**
   * 广播日志到订阅者
   */
  broadcastLog(componentId, log) {
    for (const [clientId, client] of this.clients) {
      if (client.paused) continue;
      if (!client.subscriptions.has(componentId)) continue;

      // 应用过滤器
      const filters = client.filters?.[componentId] || {};
      if (filters.level && filters.level !== 'ALL' && log.level !== filters.level) {
        continue;
      }
      if (filters.search && !log.message.toLowerCase().includes(filters.search.toLowerCase())) {
        continue;
      }

      this.sendToClient(client.ws, {
        type: 'log',
        component: componentId,
        data: log
      });
    }
  }

  /**
   * 发送初始日志
   */
  sendInitialLogs(componentId, ws, filters) {
    const info = COMPONENTS[componentId];
    if (!info) return;

    try {
      const stat = fs.statSync(info.file);
      const fd = fs.openSync(info.file, 'r');
      const bufferSize = Math.min(stat.size, 100 * 1024);  // 最多读取 100KB
      const start = Math.max(0, stat.size - bufferSize);
      const buffer = Buffer.alloc(bufferSize);
      
      fs.readSync(fd, buffer, 0, bufferSize, start);
      fs.closeSync(fd);

      const content = buffer.toString('utf-8');
      const lines = content.split('\n').filter(l => l.trim()).slice(-20);  // 最近 20 行

      for (const line of lines) {
        const parsed = parseLine(line, 0);
        if (parsed) {
          // 应用过滤器
          if (filters.level && filters.level !== 'ALL' && parsed.level !== filters.level) {
            continue;
          }
          if (filters.search && !parsed.message.toLowerCase().includes(filters.search.toLowerCase())) {
            continue;
          }

          this.sendToClient(ws, {
            type: 'log',
            component: componentId,
            data: parsed
          });
        }
      }
    } catch (e) {
      // 文件不存在或读取错误
    }
  }

  /**
   * 发送消息到客户端
   */
  sendToClient(ws, data) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * 处理客户端消息
   */
  handleMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    let data;
    try {
      data = JSON.parse(message);
    } catch {
      this.sendToClient(client.ws, { type: 'error', message: 'Invalid JSON' });
      return;
    }

    switch (data.action) {
      case 'subscribe':
        const subResult = this.subscribe(data.component, clientId, data.filters || {});
        this.sendToClient(client.ws, { type: 'subscribed', ...subResult });
        break;

      case 'unsubscribe':
        this.unsubscribe(data.component, clientId);
        this.sendToClient(client.ws, { type: 'unsubscribed', component: data.component });
        break;

      case 'pause':
        const pauseResult = this.pause(clientId);
        this.sendToClient(client.ws, { type: 'paused', ...pauseResult });
        break;

      case 'resume':
        const resumeResult = this.resume(clientId);
        this.sendToClient(client.ws, { type: 'resumed', ...resumeResult });
        break;

      default:
        this.sendToClient(client.ws, { type: 'error', message: 'Unknown action' });
    }
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      clients: this.clients.size,
      watchers: Array.from(this.watchers.entries()).map(([id, w]) => ({
        component: id,
        subscribers: w.subscribers.size,
        lastSize: w.lastSize
      }))
    };
  }

  /**
   * 关闭所有连接
   */
  close() {
    for (const [componentId] of this.watchers) {
      this.stopWatcher(componentId);
    }
    for (const [clientId, client] of this.clients) {
      client.ws.close();
    }
    this.clients.clear();
    this.watchers.clear();
  }
}

// 单例
const logWatcher = new LogWatcher();

module.exports = {
  LogWatcher,
  logWatcher
};