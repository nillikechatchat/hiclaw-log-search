import { useEffect, useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLogStore, usePreferencesStore } from '../stores/logStore';
import { getLogs } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { levelColors, formatTime, copyToClipboard } from '../utils/helpers';
import type { LogEntry } from '../types';

export default function LogStream() {
  const {
    logs, setLogs, clearLogs, appendLogs,
    selectedComponent, filter, isLoading, wsConnected, isStreaming,
    setIsStreaming, setWsConnected
  } = useLogStore();
  const { preferences } = usePreferencesStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // WebSocket 连接
  const wsUrl = `ws://${window.location.host}/log-search/ws`;
  const { connect, disconnect, subscribe, unsubscribe } = useWebSocket({
    url: wsUrl,
    onLog: (log) => {
      if (filter.level === 'ALL' || filter.level === log.level) {
        appendLogs([log]);
      }
    },
    onStatusChange: (status) => {
      setWsConnected(status === 'connected');
    },
  });
  
  // 加载日志
  const loadLogs = useCallback(async () => {
    if (!selectedComponent) return;
    
    try {
      const data = await getLogs({ ...filter, component: selectedComponent }, preferences.maxLines);
      setLogs(data.logs);
    } catch (error) {
      toast.error('加载日志失败');
    }
  }, [selectedComponent, filter, preferences.maxLines, setLogs]);
  
  // 初始加载
  useEffect(() => {
    if (selectedComponent) {
      loadLogs();
    }
  }, [selectedComponent, loadLogs]);
  
  // 级别切换后重新加载
  useEffect(() => {
    if (selectedComponent && filter.level) {
      loadLogs();
    }
  }, [filter.level, selectedComponent, loadLogs]);
  
  // WebSocket 连接管理
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);
  
  // 订阅组件
  useEffect(() => {
    if (wsConnected && selectedComponent) {
      const wsFilter = filter.level !== 'ALL' ? { level: filter.level } : {};
      subscribe(selectedComponent, wsFilter);
    }
    return () => {
      if (wsConnected) {
        unsubscribe();
      }
    };
  }, [wsConnected, selectedComponent, filter.level, subscribe, unsubscribe]);
  
  // 自动刷新
  useEffect(() => {
    if (preferences.autoRefresh && !wsConnected) {
      intervalRef.current = setInterval(loadLogs, preferences.refreshInterval);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [preferences.autoRefresh, preferences.refreshInterval, wsConnected, loadLogs]);
  
  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);
  
  // 检测滚动位置
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  }, []);
  
  // 复制日志
  const handleCopy = useCallback(async (log: LogEntry) => {
    const success = await copyToClipboard(log.rawLine || log.message);
    if (success) {
      toast.success('已复制到剪贴板');
    }
  }, []);
  
  // 切换实时流
  const toggleStreaming = useCallback(() => {
    if (wsConnected) {
      setIsStreaming(!isStreaming);
      if (!isStreaming) {
        toast.success('实时日志流已开启');
      } else {
        toast.success('实时日志流已暂停');
      }
    } else {
      toast.error('WebSocket 未连接，无法开启实时流');
    }
  }, [wsConnected, isStreaming, setIsStreaming]);

  return (
    <div className="flex flex-col h-full bg-dark-900">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-dark-700/50 bg-dark-800/50">
        <div className="flex items-center gap-3">
          {/* 刷新按钮 */}
          <button
            onClick={loadLogs}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg hover:bg-dark-700/50 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? '⏳ 加载中...' : '🔄 刷新'}
          </button>
          
          {/* 实时流按钮 */}
          <button
            onClick={toggleStreaming}
            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 ${
              isStreaming
                ? 'bg-red-600/20 text-red-400 animate-pulse'
                : 'hover:bg-dark-700/50'
            }`}
          >
            {isStreaming ? '⏸ 暂停实时流' : '▶ 开启实时流'}
          </button>
          
          {/* 自动滚动 */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              autoScroll ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-dark-700/50'
            }`}
          >
            {autoScroll ? '📌 自动跟随' : '📍 停止跟随'}
          </button>
          
          {/* 清空 */}
          <button
            onClick={() => {
              clearLogs();
              toast.success('日志已清空');
            }}
            className="px-3 py-1.5 rounded-lg hover:bg-dark-700/50 text-sm"
          >
            🗑 清空
          </button>
        </div>
        
        <div className="text-sm text-gray-400">
          {logs.length.toLocaleString()} 条日志
        </div>
      </div>
      
      {/* 日志列表 */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-3 space-y-1"
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-6xl mb-4">📊</div>
            <div className="text-lg">暂无日志</div>
            <div className="text-sm mt-2">选择组件并点击刷新查看日志</div>
          </div>
        ) : (
          logs.map((log, index) => (
            <LogLine
              key={log.id || index}
              log={log}
              isExpanded={expandedLog === log.id}
              onToggle={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              onCopy={() => handleCopy(log)}
              fontSize={preferences.fontSize}
              showTimestamp={preferences.showTimestamp}
              wrapLines={preferences.wrapLines}
            />
          ))
        )}
      </div>
      
      {/* 回到底部按钮 */}
      {!autoScroll && (
        <button
          onClick={() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
            setAutoScroll(true);
          }}
          className="absolute bottom-20 right-6 px-3 py-2 bg-blue-600 rounded-full shadow-lg hover:bg-blue-500 transition-colors"
        >
          ⬇ 回到底部
        </button>
      )}
    </div>
  );
}

// 日志行组件
interface LogLineProps {
  log: LogEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  fontSize: 'small' | 'medium' | 'large';
  showTimestamp: boolean;
  wrapLines: boolean;
}

function LogLine({ log, isExpanded, onToggle, onCopy, fontSize, showTimestamp, wrapLines }: LogLineProps) {
  const colors = levelColors[log.level];
  
  const fontSizeClass = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  }[fontSize];

  return (
    <div
      className={`log-line ${log.level.toLowerCase()} ${colors.bg} ${colors.border} transition-all duration-200 cursor-pointer group`}
      onClick={onToggle}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* 时间戳和级别 */}
          <div className="flex items-center gap-2 mb-1">
            {showTimestamp && (
              <span className="text-gray-500 text-xs font-mono">
                {formatTime(log.timestamp)}
              </span>
            )}
            <span className={`badge badge-${log.level.toLowerCase()}`}>
              {log.level}
            </span>
            {log.traceId && (
              <span className="text-xs text-gray-500 font-mono">
                trace: {log.traceId.slice(0, 8)}
              </span>
            )}
          </div>
          
          {/* 消息内容 */}
          <div
            className={`font-mono ${fontSizeClass} ${colors.text} ${wrapLines ? 'break-all whitespace-pre-wrap' : 'truncate'}`}
          >
            {log.message}
          </div>
          
          {/* 展开的详细信息 */}
          {isExpanded && (
            <div className="mt-2 pt-2 border-t border-dark-600/50 text-xs animate-fade-in">
              <div className="grid grid-cols-2 gap-2 text-gray-400">
                {log.method && <div>方法: <span className="text-white">{log.method}</span></div>}
                {log.path && <div>路径: <span className="text-white">{log.path}</span></div>}
                {log.statusCode && <div>状态码: <span className={log.statusCode >= 400 ? 'text-red-400' : 'text-green-400'}>{log.statusCode}</span></div>}
                {log.duration && <div>耗时: <span className="text-white">{log.duration}ms</span></div>}
              </div>
              
              {/* 原始日志 */}
              {log.rawLine && (
                <div className="mt-2 p-2 bg-dark-900/50 rounded text-xs font-mono text-gray-300 overflow-auto max-h-40">
                  <pre className="whitespace-pre-wrap break-all">{log.rawLine}</pre>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* 操作按钮 */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            className="p-1 text-gray-400 hover:text-white text-xs"
            title="复制"
          >
            📋
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // 查看上下文
            }}
            className="p-1 text-gray-400 hover:text-white text-xs"
            title="查看上下文"
          >
            🔍
          </button>
        </div>
      </div>
    </div>
  );
}