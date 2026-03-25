import { useCallback } from 'react';
import { useLogStore, usePreferencesStore } from '../stores/logStore';
import { formatSize } from '../utils/helpers';

export default function Header() {
  const { components, selectedComponent, logs, isAuthenticated, logout } = useLogStore();
  const { preferences, setPreferences } = usePreferencesStore();
  
  const selectedComp = components.find(c => c.id === selectedComponent);
  
  const toggleTheme = useCallback(() => {
    setPreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' });
  }, [preferences.theme, setPreferences]);

  return (
    <header className="glass border-b border-dark-700/50 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* 左侧：标题 */}
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              HiClaw Log Analyzer
            </span>
          </h1>
        </div>
        
        {/* 中间：统计信息 */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">组件:</span>
            <span className="text-blue-400 font-medium">{selectedComp?.name || '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">日志数:</span>
            <span className="text-green-400 font-bold">{logs.length.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">文件大小:</span>
            <span className="text-yellow-400">{formatSize(selectedComp?.size || 0)}</span>
          </div>
        </div>
        
        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-3">
          {/* 主题切换 */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-dark-700/50 transition-colors"
            title="切换主题 (T)"
          >
            {preferences.theme === 'dark' ? '🌙' : '☀️'}
          </button>
          
          {/* 设置 */}
          <button
            className="p-2 rounded-lg hover:bg-dark-700/50 transition-colors"
            title="设置"
          >
            ⚙️
          </button>
          
          {/* 登出 */}
          {isAuthenticated && (
            <button
              onClick={logout}
              className="px-3 py-1.5 rounded-lg hover:bg-red-600/20 text-red-400 transition-colors text-sm"
            >
              🚪 登出
            </button>
          )}
        </div>
      </div>
    </header>
  );
}