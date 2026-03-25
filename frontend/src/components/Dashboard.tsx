import { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useLogStore } from '../stores/logStore';
import { getStats } from '../services/api';
import type { StatsData } from '../types';

export default function Dashboard() {
  const { selectedComponent, stats, setStats } = useLogStore();
  const [loading, setLoading] = useState(false);

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
    // 定期刷新统计
    const interval = setInterval(loadStats, 60000);
    return () => clearInterval(interval);
  }, [selectedComponent, setStats]);

  if (loading && !stats) {
    return (
      <div className="p-4 flex items-center justify-center h-full">
        <div className="text-gray-500">加载统计数据...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-4">
        <div className="text-gray-500 text-center py-8">
          暂无统计数据
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 overflow-auto h-full">
      {/* 标题 */}
      <h3 className="font-semibold text-gray-300 flex items-center gap-2">
        <span>📈</span>
        日志统计
      </h3>
      
      {/* 概览卡片 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          title="总日志"
          value={stats.summary.total}
          color="blue"
          icon="📊"
        />
        <StatCard
          title="错误"
          value={stats.summary.byLevel.ERROR || 0}
          color="red"
          icon="🔴"
        />
        <StatCard
          title="警告"
          value={stats.summary.byLevel.WARN || 0}
          color="yellow"
          icon="🟡"
        />
        <StatCard
          title="信息"
          value={stats.summary.byLevel.INFO || 0}
          color="green"
          icon="🔵"
        />
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
            {stats.topErrors.slice(0, 5).map((error, index) => (
              <div
                key={index}
                className="flex items-start gap-2 text-xs"
              >
                <span className="text-red-400 font-mono">{error.count}x</span>
                <span className="text-gray-300 truncate flex-1" title={error.message}>
                  {error.message.slice(0, 60)}...
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
    legend: {
      show: false,
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#0f172a',
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        data: [
          { value: data.ERROR || 0, name: 'ERROR', itemStyle: { color: '#ef4444' } },
          { value: data.WARN || 0, name: 'WARN', itemStyle: { color: '#f59e0b' } },
          { value: data.INFO || 0, name: 'INFO', itemStyle: { color: '#3b82f6' } },
          { value: data.DEBUG || 0, name: 'DEBUG', itemStyle: { color: '#a855f7' } },
        ].filter(d => d.value > 0),
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 150 }}
      opts={{ renderer: 'svg' }}
    />
  );
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
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '10%',
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
    series: [
      {
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
      },
      {
        name: '警告',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: data.map(d => d.warn),
        lineStyle: { color: '#f59e0b', width: 2 },
      },
    ],
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: 120 }}
      opts={{ renderer: 'svg' }}
    />
  );
}