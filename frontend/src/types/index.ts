// 日志级别
export type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

// 日志条目
export interface LogEntry {
  id: string;
  lineNumber: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  rawLine: string;
  component?: string;
  // 可选的解析字段
  traceId?: string;
  userId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
}

// 日志组件
export interface LogComponent {
  id: string;
  name: string;
  file: string;
  size: number;
  exists: boolean;
  lastModified?: string;
}

// 搜索过滤器
export interface SearchFilter {
  component: string;
  level: LogLevel | 'ALL';
  keyword: string;
  regex: string;
  startTime: string | null;
  endTime: string | null;
}

// 搜索历史
export interface SearchHistory {
  id: string;
  query: string;
  timestamp: string;
  filter: Partial<SearchFilter>;
}

// 统计数据
export interface StatsData {
  component: string;
  period: {
    start: string;
    end: string;
  };
  summary: {
    total: number;
    byLevel: Record<LogLevel, number>;
  };
  trend: Array<{
    hour: string;
    error: number;
    warn: number;
    info: number;
    debug: number;
  }>;
  topErrors: Array<{
    message: string;
    count: number;
  }>;
}

// API 响应
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 日志查询响应
export interface LogsResponse {
  component: string;
  name: string;
  total: number;
  logs: LogEntry[];
  hasMore?: boolean;
}

// 导出格式
export type ExportFormat = 'json' | 'csv';

// 主题
export type Theme = 'dark' | 'light';

// 用户偏好
export interface UserPreferences {
  theme: Theme;
  autoRefresh: boolean;
  refreshInterval: number;
  maxLines: number;
  fontSize: 'small' | 'medium' | 'large';
  showTimestamp: boolean;
  wrapLines: boolean;
}

// 书签
export interface Bookmark {
  id: string;
  logId: string;
  component: string;
  note: string;
  createdAt: string;
}

// 上下文查询结果
export interface LogContext {
  target: LogEntry;
  before: LogEntry[];
  after: LogEntry[];
}