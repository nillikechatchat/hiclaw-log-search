import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LogEntry, LogComponent, SearchFilter, SearchHistory, Bookmark, UserPreferences, StatsData } from '@/types';

// 默认搜索过滤器
const defaultFilter: SearchFilter = {
  component: '',
  level: 'ALL',
  keyword: '',
  regex: '',
  startTime: null,
  endTime: null,
};

// 默认用户偏好
const defaultPreferences: UserPreferences = {
  theme: 'dark',
  autoRefresh: false,
  refreshInterval: 3000,
  maxLines: 500,
  fontSize: 'medium',
  showTimestamp: true,
  wrapLines: true,
};

// 日志存储
interface LogStore {
  // 日志数据
  logs: LogEntry[];
  components: LogComponent[];
  selectedComponent: string;
  stats: StatsData | null;
  
  // 过滤器
  filter: SearchFilter;
  
  // 加载状态
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;
  
  // 认证状态
  isAuthenticated: boolean;
  
  // Actions
  setLogs: (logs: LogEntry[]) => void;
  appendLogs: (logs: LogEntry[]) => void;
  clearLogs: () => void;
  setComponents: (components: LogComponent[]) => void;
  setSelectedComponent: (component: string) => void;
  setFilter: (filter: Partial<SearchFilter>) => void;
  resetFilter: () => void;
  setStats: (stats: StatsData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setHasMore: (hasMore: boolean) => void;
  setPage: (page: number) => void;
  setAuthenticated: (authenticated: boolean) => void;
  logout: () => void;
}

export const useLogStore = create<LogStore>((set) => ({
  logs: [],
  components: [],
  selectedComponent: '',
  stats: null,
  filter: defaultFilter,
  isLoading: false,
  error: null,
  hasMore: false,
  page: 1,
  isAuthenticated: false,
  
  setLogs: (logs) => set({ logs }),
  appendLogs: (logs) => set((state) => ({ logs: [...state.logs, ...logs] })),
  clearLogs: () => set({ logs: [], page: 1 }),
  setComponents: (components) => set({ components }),
  setSelectedComponent: (component) => set({ selectedComponent: component }),
  setFilter: (filter) => set((state) => ({ filter: { ...state.filter, ...filter } })),
  resetFilter: () => set({ filter: defaultFilter }),
  setStats: (stats) => set({ stats }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setHasMore: (hasMore) => set({ hasMore }),
  setPage: (page) => set({ page }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  logout: () => set({ isAuthenticated: false }),
}));

// 搜索历史存储
interface HistoryStore {
  history: SearchHistory[];
  addHistory: (item: Omit<SearchHistory, 'id' | 'timestamp'>) => void;
  removeHistory: (id: string) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set) => ({
      history: [],
      addHistory: (item) =>
        set((state) => ({
          history: [
            { ...item, id: crypto.randomUUID(), timestamp: new Date().toISOString() },
            ...state.history,
          ].slice(0, 50),
        })),
      removeHistory: (id) =>
        set((state) => ({
          history: state.history.filter((h) => h.id !== id),
        })),
      clearHistory: () => set({ history: [] }),
    }),
    { name: 'log-search-history' }
  )
);

// 书签存储
interface BookmarkStore {
  bookmarks: Bookmark[];
  addBookmark: (bookmark: Omit<Bookmark, 'id' | 'createdAt'>) => void;
  removeBookmark: (id: string) => void;
  clearBookmarks: () => void;
}

export const useBookmarkStore = create<BookmarkStore>()(
  persist(
    (set) => ({
      bookmarks: [],
      addBookmark: (bookmark) =>
        set((state) => ({
          bookmarks: [
            { ...bookmark, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
            ...state.bookmarks,
          ],
        })),
      removeBookmark: (id) =>
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.id !== id),
        })),
      clearBookmarks: () => set({ bookmarks: [] }),
    }),
    { name: 'log-bookmarks' }
  )
);

// 用户偏好存储
interface PreferencesStore {
  preferences: UserPreferences;
  setPreferences: (prefs: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      setPreferences: (prefs) =>
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        })),
      resetPreferences: () => set({ preferences: defaultPreferences }),
    }),
    { name: 'log-preferences' }
  )
);