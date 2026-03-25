import type { LogComponent, LogsResponse, StatsData, LogContext, SearchFilter, ExportFormat } from '@/types';

const API_BASE = '/log-search/api';

// 通用请求函数
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  // 获取 token
  const token = localStorage.getItem('log-auth-token');
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    // 401 表示未授权，需要重新登录
    if (response.status === 401) {
      localStorage.removeItem('log-auth-token');
      window.location.reload();
    }
    
    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// ========== 认证相关 ==========

// 验证秘钥
export async function verifyToken(token: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const response = await fetch(`${API_BASE}/auth/verify?token=${encodeURIComponent(token)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  const data = await response.json();
  
  if (response.ok && data.success) {
    localStorage.setItem('log-auth-token', token);
    return { success: true, message: data.message };
  }
  
  return { success: false, error: data.error || '验证失败' };
}

// 检查是否已认证
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('log-auth-token');
}

// ========== 日志相关 ==========

// 获取组件列表
export async function getComponents(): Promise<{ components: LogComponent[]; total: number }> {
  return request<{ components: LogComponent[]; total: number }>(`${API_BASE}/components`);
}

// 获取日志
export async function getLogs(filter: SearchFilter, lines = 500): Promise<LogsResponse> {
  const params = new URLSearchParams();
  params.set('component', filter.component);
  params.set('lines', String(lines));
  
  if (filter.level && filter.level !== 'ALL') {
    params.set('level', filter.level);
  }
  if (filter.keyword) {
    params.set('search', filter.keyword);
  }
  if (filter.regex) {
    params.set('regex', filter.regex);
  }
  if (filter.startTime) {
    params.set('startTime', filter.startTime);
  }
  if (filter.endTime) {
    params.set('endTime', filter.endTime);
  }

  return request<LogsResponse>(`${API_BASE}/logs?${params}`);
}

// 获取统计数据
export async function getStats(component: string, hours = 24): Promise<StatsData> {
  const params = new URLSearchParams();
  params.set('component', component);
  params.set('hours', String(hours));

  return request<StatsData>(`${API_BASE}/stats?${params}`);
}

// 获取概览统计（所有组件）
export async function getOverviewStats(): Promise<{ components: StatsData[] }> {
  return request<{ components: StatsData[] }>(`${API_BASE}/stats`);
}

// 获取日志上下文
export async function getLogContext(
  component: string,
  lineNumber: number,
  before = 10,
  after = 10
): Promise<LogContext> {
  const params = new URLSearchParams();
  params.set('component', component);
  params.set('line', String(lineNumber));
  params.set('before', String(before));
  params.set('after', String(after));

  return request<LogContext>(`${API_BASE}/context?${params}`);
}

// 导出日志
export async function exportLogs(filter: SearchFilter, format: ExportFormat): Promise<Blob> {
  const token = localStorage.getItem('log-auth-token');
  
  const params = new URLSearchParams();
  params.set('component', filter.component);
  params.set('format', format);
  
  if (filter.level && filter.level !== 'ALL') {
    params.set('level', filter.level);
  }
  if (filter.keyword) {
    params.set('search', filter.keyword);
  }

  const response = await fetch(`${API_BASE}/export?${params}`, {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  
  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }
  return response.blob();
}

// 下载导出文件
export function downloadExport(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 删除日志
export async function deleteLogs(component: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`${API_BASE}/logs?component=${component}`, {
    method: 'DELETE',
  });
}

// 健康检查
export async function healthCheck(): Promise<{ status: string; time: string }> {
  return request<{ status: string; time: string }>(`${API_BASE}/health`);
}

// ========== 系统状态 API ==========

// Worker 状态类型
export interface WorkerStatus {
  name: string;
  displayName: string;
  running: boolean;
  isWorking: boolean;
  currentTask: {
    id: string;
    title: string;
    startedAt: string;
  } | null;
  pid: number | null;
  uptime: number | null;
  lastActivity: string | null;
}

// OpenClaw 状态类型
export interface OpenClawStatus {
  name: string;
  running: boolean;
  version: string | null;
  uptime: number | null;
  startTime: string | null;
  pid: number | null;
  memory: number | null;
  cpu: string | null;
}

// 系统概览类型
export interface SystemOverview {
  openclaw: OpenClawStatus;
  workers: {
    total: number;
    running: number;
    working: number;
    workers: WorkerStatus[];
  };
  system: {
    hostname: string;
    platform: string;
    arch: string;
    uptime: number;
    totalMemory: number;
    freeMemory: number;
    loadAverage: number[];
  };
  timestamp: string;
}

// 获取 OpenClaw 状态
export async function getOpenClawStatus(): Promise<OpenClawStatus> {
  return request<OpenClawStatus>(`${API_BASE}/status/openclaw`);
}

// 获取 Worker 列表状态
export async function getWorkersStatus(): Promise<{ total: number; running: number; working: number; workers: WorkerStatus[] }> {
  return request(`${API_BASE}/status/workers`);
}

// 获取系统概览
export async function getSystemOverview(): Promise<SystemOverview> {
  return request<SystemOverview>(`${API_BASE}/status/overview`);
}

// 兼容旧接口
export async function getSystemStatus(): Promise<SystemOverview> {
  return getSystemOverview();
}

export async function getWorkers(): Promise<{ workers: WorkerStatus[] }> {
  const data = await getWorkersStatus();
  return { workers: data.workers };
}