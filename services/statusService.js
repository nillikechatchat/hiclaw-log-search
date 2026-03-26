/**
 * 系统状态服务
 * 获取 OpenClaw 运行状态和 Worker 状态
 */

const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

/**
 * 获取 OpenClaw 运行状态
 */
function getOpenClawStatus() {
  const status = {
    name: 'OpenClaw',
    running: false,
    version: null,
    uptime: null,
    startTime: null,
    pid: null,
    memory: null,
    cpu: null,
  };

  try {
    // 检查主进程
    const pid = getProcessPid('openclaw');
    if (pid) {
      status.running = true;
      status.pid = pid;
      
      // 获取进程信息
      try {
        const stat = getProcessStat(pid);
        status.startTime = stat.startTime;
        status.uptime = stat.uptime;
        status.memory = stat.memory;
        status.cpu = stat.cpu;
      } catch {}
    }

    // 获取版本
    try {
      const packagePath = '/opt/openclaw/package.json';
      if (fs.existsSync(packagePath)) {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        status.version = pkg.version;
      }
    } catch {}
  } catch (e) {
    status.error = e.message;
  }

  return status;
}

/**
 * 获取 Worker 列表和状态
 */
function getWorkersStatus() {
  const workers = [];
  
  // 从配置获取 worker 列表
  const workerNames = [
    'adev',      // 前端开发
    'abackend',  // 后端开发
    'adocs',     // 文档
    'amail',     // 邮件
    'amarketing', // 营销
  ];

  for (const name of workerNames) {
    const workerStatus = getWorkerStatus(name);
    workers.push(workerStatus);
  }

  return {
    total: workers.length,
    running: workers.filter(w => w.running).length,
    working: workers.filter(w => w.isWorking).length,
    workers,
  };
}

/**
 * 获取单个 Worker 状态
 */
function getWorkerStatus(name) {
  const status = {
    name,
    displayName: getWorkerDisplayName(name),
    running: false,
    isWorking: false,
    currentTask: null,
    pid: null,
    uptime: null,
    lastActivity: null,
  };

  try {
    // 检查进程
    const pid = getProcessPid(`copaw-worker-${name}`);
    if (pid) {
      status.running = true;
      status.pid = pid;
      
      const stat = getProcessStat(pid);
      status.uptime = stat.uptime;
    }

    // 检查是否在工作（通过检查状态文件或日志）
    const statusFile = `/tmp/worker-${name}-status.json`;
    if (fs.existsSync(statusFile)) {
      try {
        const workerState = JSON.parse(fs.readFileSync(statusFile, 'utf-8'));
        status.isWorking = workerState.isWorking || false;
        status.currentTask = workerState.currentTask || null;
        status.lastActivity = workerState.lastActivity || null;
      } catch {}
    }

    // 检查内存中的任务状态文件
    const taskFile = `/root/.copaw-worker/${name}/.copaw/task-history.json`;
    if (fs.existsSync(taskFile)) {
      try {
        const tasks = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));
        const activeTask = tasks.find(t => t.status === 'in_progress');
        if (activeTask) {
          status.isWorking = true;
          status.currentTask = {
            id: activeTask.taskId,
            title: activeTask.title || 'Unknown task',
            startedAt: activeTask.startedAt,
          };
        }
      } catch {}
    }
  } catch (e) {
    status.error = e.message;
  }

  return status;
}

/**
 * 获取进程 PID
 */
function getProcessPid(processName) {
  try {
    const output = execSync(`pgrep -f "${processName}" | head -1`, { 
      encoding: 'utf-8',
      timeout: 5000 
    }).trim();
    return output ? parseInt(output) : null;
  } catch {
    return null;
  }
}

/**
 * 获取进程统计信息
 */
function getProcessStat(pid) {
  try {
    // 读取 /proc/[pid]/stat
    const statPath = `/proc/${pid}/stat`;
    const statContent = fs.readFileSync(statPath, 'utf-8');
    const parts = statContent.split(' ');
    
    // 解析启动时间 (第 22 个字段，单位是 jiffies)
    const startTimeJiffies = parseInt(parts[21]);
    const hz = 100; // 通常 100 Hz
    const startTimeMs = startTimeJiffies * (1000 / hz);
    
    // 系统启动时间
    const btime = parseInt(fs.readFileSync('/proc/stat', 'utf-8')
      .split('\n').find(l => l.startsWith('btime'))
      .split(' ')[1]);
    
    const startTime = new Date(btime * 1000 + startTimeMs);
    const uptime = Date.now() - startTime.getTime();
    
    // 内存使用
    const statusPath = `/proc/${pid}/status`;
    const statusContent = fs.readFileSync(statusPath, 'utf-8');
    const vmSizeMatch = statusContent.match(/VmSize:\s*(\d+)\s*kB/);
    const memory = vmSizeMatch ? parseInt(vmSizeMatch[1]) * 1024 : 0;
    
    // CPU 使用率（简单估算）
    const utime = parseInt(parts[13]);
    const stime = parseInt(parts[14]);
    const totalTime = utime + stime;
    const cpu = (totalTime / hz) / (uptime / 1000) * 100;

    return {
      startTime: startTime.toISOString(),
      uptime: Math.floor(uptime / 1000), // 秒
      memory,
      cpu: cpu.toFixed(1) + '%',
    };
  } catch {
    return { startTime: null, uptime: null, memory: null, cpu: null };
  }
}

/**
 * Worker 显示名称映射
 */
function getWorkerDisplayName(name) {
  const names = {
    'adev': '前端开发 (Adey)',
    'abackend': '后端开发 (Andy)',
    'adocs': '文档管理 (Amy)',
    'amail': '邮件助手',
    'amarketing': '营销助手',
  };
  return names[name] || name;
}

/**
 * 获取系统概览
 */
function getSystemOverview() {
  return {
    openclaw: getOpenClawStatus(),
    workers: getWorkersStatus(),
    system: {
      hostname: require('os').hostname(),
      platform: process.platform,
      arch: process.arch,
      uptime: Math.floor(require('os').uptime()),
      totalMemory: require('os').totalmem(),
      freeMemory: require('os').freemem(),
      loadAverage: require('os').loadavg(),
    },
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  getOpenClawStatus,
  getWorkersStatus,
  getWorkerStatus,
  getSystemOverview,
};