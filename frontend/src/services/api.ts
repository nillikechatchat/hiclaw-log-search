import type { LogComponent, LogsResponse, StatsData, LogContext, SearchFilter, ExportFormat } from '@/types';

const API_BASE = '/log-search/api';

// 通用请求函数
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

// 获取组件列表
export async function getComponents(): Promise<{ components: LogComponent[] }> {
  return request<{ components: LogComponent[] }>(`${API_BASE}/components`);
}

// 获取日志
export async function getLogs(filter: SearchFilter, lines = 500, page = 1): Promise<LogsResponse> {
  const params = new URLSearchParams();
  params.set('component', filter.component);
  params.set('lines', String(lines));
  params.set('page', String(page));
  
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
export async function getStats(component: string, startTime?: string, endTime?: string): Promise<StatsData> {
  const params = new URLSearchParams();
  params.set('component', component);
  if (startTime) params.set('startTime', startTime);
  if (endTime) params.set('endTime', endTime);

  return request<StatsData>(`${API_BASE}/stats?${params}`);
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
  params.set('lineNumber', String(lineNumber));
  params.set('before', String(before));
  params.set('after', String(after));

  return request<LogContext>(`${API_BASE}/context?${params}`);
}

// 导出日志
export async function exportLogs(filter: SearchFilter, format: ExportFormat): Promise<Blob> {
  const params = new URLSearchParams();
  params.set('component', filter.component);
  params.set('format', format);
  
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

  const response = await fetch(`${API_BASE}/export?${params}`);
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

// 健康检查
export async function healthCheck(): Promise<{ status: string; time: string }> {
  return request<{ status: string; time: string }>(`${API_BASE}/health`);
}