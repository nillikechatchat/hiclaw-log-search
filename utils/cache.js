/**
 * LRU 缓存工具
 */

class LRUCache {
  constructor(maxSize = 100 * 1024 * 1024, ttl = 60000) {
    this.maxSize = maxSize;  // 最大缓存大小（字节）
    this.ttl = ttl;          // 缓存时间（毫秒）
    this.cache = new Map();  // 缓存数据
    this.currentSize = 0;    // 当前缓存大小
  }

  /**
   * 获取缓存
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // 检查是否过期
    if (Date.now() - item.time > this.ttl) {
      this.delete(key);
      return null;
    }

    // 移到最后（最近使用）
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.data;
  }

  /**
   * 设置缓存
   */
  set(key, data) {
    const size = this.estimateSize(data);
    
    // 如果单个数据超过最大大小的一半，不缓存
    if (size > this.maxSize / 2) return;

    // 清理空间
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value;
      this.delete(oldestKey);
    }

    // 删除旧数据（如果存在）
    if (this.cache.has(key)) {
      const oldItem = this.cache.get(key);
      this.currentSize -= oldItem.size;
    }

    // 添加新数据
    this.cache.set(key, {
      data,
      size,
      time: Date.now()
    });
    this.currentSize += size;
  }

  /**
   * 删除缓存
   */
  delete(key) {
    const item = this.cache.get(key);
    if (item) {
      this.currentSize -= item.size;
      this.cache.delete(key);
    }
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * 获取缓存统计
   */
  stats() {
    return {
      entries: this.cache.size,
      currentSize: this.currentSize,
      maxSize: this.maxSize,
      usagePercent: ((this.currentSize / this.maxSize) * 100).toFixed(2)
    };
  }

  /**
   * 估算数据大小
   */
  estimateSize(data) {
    if (typeof data === 'string') {
      return data.length * 2;  // UTF-16
    }
    if (Buffer.isBuffer(data)) {
      return data.length;
    }
    // 对象序列化估算
    try {
      return JSON.stringify(data).length * 2;
    } catch {
      return 1000;  // 默认估算
    }
  }
}

// 文件状态缓存（用于检测文件变化）
class FileStateCache {
  constructor() {
    this.states = new Map();  // filepath -> { size, mtime, lastRead }
  }

  /**
   * 检查文件是否有变化
   */
  hasChanged(filepath, stat) {
    const cached = this.states.get(filepath);
    if (!cached) return true;

    return cached.size !== stat.size || cached.mtime !== stat.mtime.getTime();
  }

  /**
   * 更新文件状态
   */
  update(filepath, stat) {
    this.states.set(filepath, {
      size: stat.size,
      mtime: stat.mtime.getTime(),
      lastRead: Date.now()
    });
  }

  /**
   * 获取文件最后读取时间
   */
  getLastRead(filepath) {
    const cached = this.states.get(filepath);
    return cached ? cached.lastRead : 0;
  }

  /**
   * 清理旧记录
   */
  cleanup(maxAge = 3600000) {  // 默认 1 小时
    const now = Date.now();
    for (const [filepath, state] of this.states.entries()) {
      if (now - state.lastRead > maxAge) {
        this.states.delete(filepath);
      }
    }
  }
}

// 全局缓存实例
const logCache = new LRUCache(100 * 1024 * 1024, 60000);
const fileStateCache = new FileStateCache();

module.exports = {
  LRUCache,
  FileStateCache,
  logCache,
  fileStateCache
};