import { clsx, type ClassValue } from 'clsx';
import type { LogLevel } from '@/types';

// 类名合并
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// 格式化文件大小
export function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

// 格式化时间
export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// 格式化日期时间
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// 格式化相对时间
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
  return formatDateTime(date);
}

// 格式化数字
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}

// 日志级别颜色
export const levelColors: Record<LogLevel, { bg: string; text: string; border: string }> = {
  ERROR: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-l-red-500',
  },
  WARN: {
    bg: 'bg-yellow-950/50',
    text: 'text-yellow-400',
    border: 'border-l-yellow-500',
  },
  INFO: {
    bg: 'bg-blue-950/50',
    text: 'text-blue-400',
    border: 'border-l-blue-500',
  },
  DEBUG: {
    bg: 'bg-purple-950/50',
    text: 'text-purple-400',
    border: 'border-l-purple-500',
  },
};

// 日志级别图标
export const levelIcons: Record<LogLevel, string> = {
  ERROR: '🔴',
  WARN: '🟡',
  INFO: '🔵',
  DEBUG: '🟣',
};

// 日志级别排序权重
export const levelPriority: Record<LogLevel, number> = {
  ERROR: 4,
  WARN: 3,
  INFO: 2,
  DEBUG: 1,
};

// 转义 HTML
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 解析 JSON 日志
export function tryParseJsonLog(message: string): { isJson: boolean; parsed?: Record<string, unknown> } {
  try {
    // 尝试解析为 JSON
    const jsonMatch = message.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { isJson: true, parsed };
    }
  } catch {
    // 不是有效的 JSON
  }
  return { isJson: false };
}

// 生成唯一 ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 防抖
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// 节流
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

// 复制到剪贴板
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}

// 下载文件
export function downloadFile(content: string, filename: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 快捷键
export const shortcuts = {
  search: { key: '/', modifier: [] },
  refresh: { key: 'r', modifier: [] },
  pause: { key: ' ', modifier: [] },
  export: { key: 'e', modifier: ['ctrlKey'] },
  theme: { key: 't', modifier: [] },
  help: { key: '?', modifier: ['shiftKey'] },
};