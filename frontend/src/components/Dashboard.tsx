import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useLogStore } from '../stores/logStore';
import { getStats, getSystemOverview, deleteLogs } from '../services/api';
import type { SystemOverview, WorkerStatus } from '../services/api';
import type { StatsData } from '@/types';
import toast from 'react-hot-toast';
import SystemManager from './SystemManager';

export default function Dashboard() {
  const { selectedComponent, stats, setStats } = useLogStore();
  const [loading, setLoading] = useState(false);
  const [systemOverview, setSystemOverview] = useState<SystemOverview | null>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'system'>('system');

  // 加载统计数据
  useEffect(() => {
    const loadStats = async () => {
      if (!selectedComponent) return;
      
      setLoading(true);
      try {
        const data = await getStats(selectedComponent);
        setStats(data);
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadStats();
    const interval = setInterval(loadStats, 60000);
    return () => clearInterval(interval);
  }, [selectedComponent, setStats]);

  // 加载系统状态
  useEffect(() => {
    const loadSystemStatus = async () => {
      try {
        const data = await getSystemOverview();
        setSystemOverview(data);
      } catch (error) {
        console.error('Failed to load system status:', error);
      }
    };
    
    loadSystemStatus();
    const interval = setInterval(loadSystemStatus, 5000); // 每 5 秒刷新
    return () => clearInterval(interval);
  }, []);

  // 删除日志
  const handleDeleteLogs = async () => {
    if (!selectedComponent) return;
    
    if (!confirm(`确定要删除 ${selectedComponent} 的日志文件吗？此操作不可恢复！`)) {
      return;
    }
    
    try {
      const result = await deleteLogs(selectedComponent);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('删除失败: ' + (error as Error).message);
    }
  };

  return (
    <div className="h-full flex flex-col bg-dark-900">
      {/* Tab 切换 */}
      <div className="flex border-b border-dark-700/50">
        <button
          onClick={() => setActiveTab('system')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeTab === 'system'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          🖥️ 系统状态
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeTab === 'stats'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          📊 日志统计
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'system' ? (
          <SystemStatusPanel status={systemOverview} onDeleteLogs={handleDeleteLogs} />
        ) : (
          <LogStatsPanel stats={stats} loading={loading} />
        )}
      </div>
    </div>
  );
}

// 系统状态面板
function SystemStatusPanel({ 
  status, 
  onDeleteLogs 
}: { 
  status: SystemOverview | null;
  onDeleteLogs: () => void;
}) {
  if (!status) {
    return (
      <div className="text-center text-gray-500 py-8">
        <div className="animate-pulse">加载系统状态...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* OpenClaw 状态卡片 */}
      <StatusCard
        title="OpenClaw"
        icon="🦀"
        status={status.openclaw.running ? 'running' : 'stopped'}
        details={[
          { label: '版本', value: status.openclaw.version || '-' },
          { label: '运行时间', value: status.openclaw.uptime ? formatUptime(status.openclaw.uptime) : '-' },
          { label: 'PID', value: status.openclaw.pid?.toString() || '-' },
        ]}
      />

      {/* Manager 状态 - 假设 manager 正在运行 */}
      <StatusCard
        title="Manager"
        icon="🤖"
        status="running"
        details={[
          { label: '状态', value: '正常运行' },
        ]}
      />

      {/* Worker 列表 */}
      <div className="bg-dark-800/50 rounded-lg p-3">
        <h4 className="text-sm text-gray-400 mb-3 flex items-center gap-2">
          <span>👷</span>
          Workers ({status.workers.running}/{status.workers.total} 活跃, {status.workers.working} 工作中)
        </h4>
        <div className="space-y-2">
          {status.workers.workers.map((worker) => (
            <WorkerCard key={worker.name} worker={worker} />
          ))}
        </div>
      </div>

      {/* 系统资源 */}
      <div className="bg-dark-800/50 rounded-lg p-3">
        <h4 className="text-sm text-gray-400 mb-3 flex items-center gap-2">
          <span>📈</span>
          系统资源
        </h4>
        <div className="space-y-2">
          <ResourceBar 
            label="CPU" 
            value={Math.round(status.system.loadAverage[0] * 10)} 
            color="blue" 
          />
          <ResourceBar 
            label="内存" 
            value={Math.round((1 - status.system.freeMemory / status.system.totalMemory) * 100)} 
            color="green" 
          />
          <div className="text-xs text-gray-500 mt-2">
            主机: {status.system.hostname} | 运行时间: {formatUptime(status.system.uptime)}
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="pt-2">
        <button
          onClick={onDeleteLogs}
          className="w-full px-4 py-2 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors text-sm"
        >
          🗑️ 清空当前组件日志
        </button>
      </div>

      {/* 系统管理 - 升级/卸载 */}
      <SystemManager />
    </div>
  );
}

// 状态卡片
function StatusCard({
  title,
  icon,
  status,
  details,
}: {
  title: string;
  icon: string;
  status: 'running' | 'stopped' | 'error';
  details: Array<{ label: string; value: string }>;
}) {
  const statusColors = {
    running: 'bg-green-500',
    stopped: 'bg-gray-500',
    error: 'bg-red-500',
  };

  const statusTexts = {
    running: '运行中',
    stopped: '已停止',
    error: '错误',
  };

  return (
    <div className="bg-dark-800/50 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <span>{icon}</span>
          {title}
        </h4>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusColors[status]} ${status === 'running' ? 'animate-pulse' : ''}`} />
          <span className="text-xs text-gray-400">{statusTexts[status]}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {details.map((detail, idx) => (
          <div key={idx}>
            <span className="text-gray-500">{detail.label}:</span>
            <span className="text-gray-300 ml-1">{detail.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Worker 卡片
function WorkerCard({ worker }: { worker: WorkerStatus }) {
  const statusConfig = {
    idle: { color: 'bg-green-500', text: '空闲', animate: false },
    working: { color: 'bg-blue-500', text: '工作中', animate: true },
    offline: { color: 'bg-red-500', text: '离线', animate: false },
  };

  // 判断状态
  let status: 'idle' | 'working' | 'offline' = 'offline';
  if (worker.running) {
    status = worker.isWorking ? 'working' : 'idle';
  }

  const config = statusConfig[status];

  return (
    <div className="flex items-center justify-between py-2 px-2 bg-dark-700/30 rounded">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${config.color} ${config.animate ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium">{worker.displayName || worker.name}</span>
      </div>
      
      {status === 'working' ? (
        <div className="flex items-center gap-2">
          {worker.currentTask && (
            <span className="text-xs text-gray-400 truncate max-w-20" title={worker.currentTask.title}>
              {worker.currentTask.id?.slice(0, 8) || '...'}
            </span>
          )}
          <span className="text-xs text-blue-400 animate-pulse">{config.text}</span>
        </div>
      ) : (
        <span className="text-xs text-gray-400">{config.text}</span>
      )}
    </div>
  );
}

// 资源进度条
function ResourceBar({ label, value, color }: { label: string; value: number; color: 'blue' | 'green' | 'yellow' }) {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
  };

  const displayValue = Math.min(100, Math.max(0, value));

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-12">{label}</span>
      <div className="flex-1 h-2 bg-dark-600 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colors[color]} transition-all duration-500`}
          style={{ width: `${displayValue}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-10 text-right">{displayValue}%</span>
    </div>
  );
}

// 日志统计面板
function LogStatsPanel({ stats, loading }: { stats: StatsData | null; loading: boolean }) {
  if (loading && !stats) {
    return (
      <div className="text-center text-gray-500 py-8">
        加载统计数据...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-gray-500 py-8">
        暂无统计数据
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 概览卡片 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="总日志" value={stats.summary.total} color="blue" icon="📊" />
        <StatCard title="错误" value={stats.summary.byLevel.ERROR || 0} color="red" icon="🔴" />
        <StatCard title="警告" value={stats.summary.byLevel.WARN || 0} color="yellow" icon="🟡" />
        <StatCard title="信息" value={stats.summary.byLevel.INFO || 0} color="green" icon="🔵" />
      </div>
      
      {/* 级别分布饼图 */}
      <div className="bg-dark-800/50 rounded-lg p-3">
        <h4 className="text-sm text-gray-400 mb-2">日志级别分布</h4>
        <LevelPieChart data={stats.summary.byLevel} />
      </div>
      
      {/* 趋势图 */}
      {stats.trend && stats.trend.length > 0 && (
        <div className="bg-dark-800/50 rounded-lg p-3">
          <h4 className="text-sm text-gray-400 mb-2">错误趋势（最近24小时）</h4>
          <TrendChart data={stats.trend} />
        </div>
      )}
      
      {/* Top 错误 */}
      {stats.topErrors && stats.topErrors.length > 0 && (
        <div className="bg-dark-800/50 rounded-lg p-3">
          <h4 className="text-sm text-gray-400 mb-2">高频错误 Top 5</h4>
          <div className="space-y-2">
            {stats.topErrors.slice(0, 5).map((error: { message: string; count: number }, index: number) => (
              <div key={index} className="flex items-start gap-2 text-xs">
                <span className="text-red-400 font-mono">{error.count}x</span>
                <span className="text-gray-300 truncate flex-1" title={error.message}>
                  {error.message.slice(0, 40)}...
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 统计卡片
function StatCard({ title, value, color, icon }: { title: string; value: number; color: string; icon: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'from-blue-600/20 to-blue-900/20 border-blue-600/30',
    red: 'from-red-600/20 to-red-900/20 border-red-600/30',
    yellow: 'from-yellow-600/20 to-yellow-900/20 border-yellow-600/30',
    green: 'from-green-600/20 to-green-900/20 border-green-600/30',
  };
  
  const textColors: Record<string, string> = {
    blue: 'text-blue-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-lg p-3`}>
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-xs">{title}</span>
        <span>{icon}</span>
      </div>
      <div className={`text-2xl font-bold ${textColors[color]} mt-1`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

// 级别分布饼图
function LevelPieChart({ data }: { data: Record<string, number> }) {
  const option = {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc' },
    },
    legend: { show: false },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 4,
        borderColor: '#0f172a',
        borderWidth: 2,
      },
      label: { show: false },
      data: [
        { value: data.ERROR || 0, name: 'ERROR', itemStyle: { color: '#ef4444' } },
        { value: data.WARN || 0, name: 'WARN', itemStyle: { color: '#f59e0b' } },
        { value: data.INFO || 0, name: 'INFO', itemStyle: { color: '#3b82f6' } },
        { value: data.DEBUG || 0, name: 'DEBUG', itemStyle: { color: '#a855f7' } },
      ].filter(d => d.value > 0),
    }],
  };

  return <ReactECharts option={option} style={{ height: 120 }} opts={{ renderer: 'svg' }} />;
}

// 趋势图
function TrendChart({ data }: { data: Array<{ hour: string; error: number; warn: number; info: number }> }) {
  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f8fafc' },
    },
    grid: {
      left: '3%', right: '4%', bottom: '3%', top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map(d => d.hour),
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#94a3b8', fontSize: 10 },
    },
    series: [{
      name: '错误',
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: data.map(d => d.error),
      lineStyle: { color: '#ef4444', width: 2 },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
            { offset: 1, color: 'rgba(239, 68, 68, 0)' },
          ],
        },
      },
    }],
  };

  return <ReactECharts option={option} style={{ height: 100 }} opts={{ renderer: 'svg' }} />;
}

// 格式化运行时间
function formatUptime(seconds: number): string {
  if (!seconds || seconds < 0) return '-';
  if (seconds < 60) return `${Math.floor(seconds)}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时`;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return `${days}天${hours}小时`;
}