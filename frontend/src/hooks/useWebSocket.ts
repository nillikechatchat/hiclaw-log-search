import { useCallback, useEffect, useRef, useState } from 'react';
import type { LogEntry, StatsData, LogLevel } from '@/types';

// WebSocket URL
const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/log-search/ws`;

type WSStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// WebSocket 消息类型（来自后端）
interface WSMessage {
  type: 'connected' | 'log' | 'stats' | 'heartbeat' | 'subscribed' | 'unsubscribed' | 'paused' | 'resumed' | 'error';
  data?: LogEntry | StatsData;
  component?: string;
  message?: string;
  clientId?: number;
  time?: number;
}

// WebSocket 订阅消息（发送到后端）
interface WSSubscribe {
  action: 'subscribe' | 'unsubscribe' | 'pause' | 'resume';
  component?: string;
  filters?: {
    level?: LogLevel;
    search?: string;
  };
}

interface UseWebSocketOptions {
  onLog?: (log: LogEntry, component?: string) => void;
  onStats?: (stats: StatsData) => void;
  onStatusChange?: (status: WSStatus) => void;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export function useWebSocket({
  onLog,
  onStats,
  onStatusChange,
  reconnectAttempts = 5,
  reconnectInterval = 3000,
}: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WSStatus>('disconnected');
  const [clientId, setClientId] = useState<number | null>(null);
  const reconnectCountRef = useRef(0);
  const pauseRef = useRef(false);
  const subscriptionsRef = useRef<Set<string>>(new Set());

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
      const url = WS_URL;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connecting...');
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'connected':
              updateStatus('connected');
              reconnectCountRef.current = 0;
              if (message.clientId) {
                setClientId(message.clientId);
              }
              console.log('WebSocket connected:', message.message);
              // 重新订阅之前的组件
              subscriptionsRef.current.forEach(component => {
                const msg: WSSubscribe = { action: 'subscribe', component };
                ws.send(JSON.stringify(msg));
              });
              break;
              
            case 'log':
              if (!pauseRef.current && message.data) {
                onLog?.(message.data as LogEntry, message.component);
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
              
            case 'subscribed':
              console.log('Subscribed to:', message.component);
              break;
              
            case 'unsubscribed':
              console.log('Unsubscribed from:', message.component);
              break;
              
            case 'error':
              console.error('WebSocket error:', message.message);
              break;
          }
        } catch (e) {
          console.error('Failed to parse WS message:', e);
        }
      };

      ws.onclose = () => {
        updateStatus('disconnected');
        setClientId(null);
        
        // 自动重连
        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          setTimeout(connect, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateStatus('error');
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      updateStatus('error');
    }
  }, [onLog, onStats, updateStatus, reconnectAttempts, reconnectInterval]);

  // 断开连接
  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    subscriptionsRef.current.clear();
    updateStatus('disconnected');
  }, [updateStatus]);

  // 订阅组件
  const subscribe = useCallback((component: string, filters?: { level?: LogLevel; search?: string }) => {
    subscriptionsRef.current.add(component);
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
  const unsubscribe = useCallback((component: string) => {
    subscriptionsRef.current.delete(component);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const msg: WSSubscribe = { action: 'unsubscribe', component };
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

  // 初始化连接 - 组件挂载时自动连接
  useEffect(() => {
    // 自动连接 WebSocket
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    status,
    clientId,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    pause,
    resume,
    isPaused: pauseRef.current,
  };
}