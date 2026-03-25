import { useCallback, useEffect, useRef, useState } from 'react';
import type { WSMessage, WSSubscribe, LogEntry, StatsData } from '@/types';

type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseWebSocketOptions {
  url: string;
  onLog?: (log: LogEntry) => void;
  onStats?: (stats: StatsData) => void;
  onStatusChange?: (status: WSStatus) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export function useWebSocket({
  url,
  onLog,
  onStats,
  onStatusChange,
  reconnectAttempts = 5,
  reconnectInterval = 3000,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const reconnectCountRef = useRef(0);
  const pauseRef = useRef(false);

  // 更新状态
  const updateStatus = useCallback((newStatus: WSStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  // 连接 WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    updateStatus('connecting');
    
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        updateStatus('connected');
        reconnectCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'log':
              if (!pauseRef.current && message.data) {
                onLog?.(message.data as LogEntry);
              }
              break;
            case 'stats':
              if (message.data) {
                onStats?.(message.data as StatsData);
              }
              break;
            case 'heartbeat':
              // 心跳保活
              break;
          }
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };

      ws.onclose = () => {
        updateStatus('disconnected');
        
        // 自动重连
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          setTimeout(connect, reconnectInterval);
        }
      };

      ws.onerror = () => {
        updateStatus('error');
      };
    } catch (e) {
      updateStatus('error');
    }
  }, [url, onLog, onStats, updateStatus, reconnectAttempts, reconnectInterval]);

  // 断开连接
  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    updateStatus('disconnected');
  }, [updateStatus]);

  // 订阅组件
  const subscribe = useCallback((component: string, filters?: WSSubscribe['filters']) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: WSSubscribe = {
        action: 'subscribe',
        component,
        filters,
      };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // 取消订阅
  const unsubscribe = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: WSSubscribe = { action: 'unsubscribe' };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // 暂停
  const pause = useCallback(() => {
    pauseRef.current = true;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: WSSubscribe = { action: 'pause' };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // 恢复
  const resume = useCallback(() => {
    pauseRef.current = false;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: WSSubscribe = { action: 'resume' };
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // 初始化连接
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    status,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    pause,
    resume,
    isPaused: pauseRef.current,
  };
}