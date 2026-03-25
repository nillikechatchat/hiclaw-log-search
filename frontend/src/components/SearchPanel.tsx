import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useLogStore, useHistoryStore } from '../stores/logStore';
import { getLogs, exportLogs, downloadExport } from '../services/api';
import type { LogLevel, ExportFormat } from '../types';

export default function SearchPanel() {
  const { filter, setFilter, selectedComponent, setLogs, setLoading, setError } = useLogStore();
  const { history, addHistory } = useHistoryStore();
  
  const [showHistory, setShowHistory] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // 执行搜索
  const handleSearch = useCallback(async () => {
    if (!selectedComponent) {
      toast.error('请先选择组件');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await getLogs({ ...filter, component: selectedComponent });
      setLogs(data.logs);
      
      // 添加到历史
      if (filter.keyword) {
        addHistory({ query: filter.keyword, filter });
      }
      
      toast.success(`找到 ${data.total} 条日志`);
    } catch (error) {
      setError((error as Error).message);
      toast.error('搜索失败');
    } finally {
      setLoading(false);
    }
  }, [filter, selectedComponent, setLogs, setLoading, setError, addHistory]);
  
  // 导出
  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!selectedComponent) {
      toast.error('请先选择组件');
      return;
    }
    
    try {
      const blob = await exportLogs({ ...filter, component: selectedComponent }, format);
      const filename = `logs-${selectedComponent}-${new Date().toISOString().slice(0, 10)}.${format}`;
      downloadExport(blob, filename);
      toast.success(`已导出 ${filename}`);
    } catch (error) {
      toast.error('导出失败');
    }
  }, [filter, selectedComponent]);
  
  // 快捷键处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="glass border-b border-dark-700/50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* 搜索框 */}
        <div className="relative flex-1 min-w-64">
          <input
            id="search-input"
            type="text"
            placeholder="🔍 搜索关键词... (支持正则)"
            value={filter.keyword}
            onChange={(e) => setFilter({ keyword: e.target.value })}
            onKeyDown={handleKeyDown}
            className="w-full px-4 py-2 rounded-lg pr-20"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {filter.keyword && (
              <button
                onClick={() => setFilter({ keyword: '' })}
                className="p-1 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-1 text-gray-400 hover:text-white"
              title="搜索历史"
            >
              📜
            </button>
          </div>
          
          {/* 搜索历史下拉 */}
          {showHistory && history.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-dark-800 rounded-lg border border-dark-600 shadow-xl z-10 max-h-60 overflow-auto">
              {history.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setFilter({ keyword: item.query, ...item.filter });
                    setShowHistory(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-dark-700 text-sm truncate"
                >
                  {item.query}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* 级别选择 */}
        <select
          value={filter.level}
          onChange={(e) => setFilter({ level: e.target.value as LogLevel | 'ALL' })}
          className="px-3 py-2 rounded-lg min-w-32"
        >
          <option value="ALL">全部级别</option>
          <option value="ERROR">🔴 ERROR</option>
          <option value="WARN">🟡 WARN</option>
          <option value="INFO">🔵 INFO</option>
          <option value="DEBUG">🟣 DEBUG</option>
        </select>
        
        {/* 搜索按钮 */}
        <button
          onClick={handleSearch}
          className="btn-gradient px-4 py-2 rounded-lg font-medium flex items-center gap-2"
        >
          🔍 搜索
        </button>
        
        {/* 高级搜索 */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-3 py-2 rounded-lg transition-colors ${
            showAdvanced ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-dark-700/50'
          }`}
        >
          ⚙️ 高级
        </button>
        
        {/* 导出 */}
        <div className="relative group">
          <button className="px-3 py-2 rounded-lg hover:bg-dark-700/50 transition-colors">
            📥 导出
          </button>
          <div className="absolute right-0 top-full mt-1 bg-dark-800 rounded-lg border border-dark-600 shadow-xl z-10 hidden group-hover:block">
            <button
              onClick={() => handleExport('json')}
              className="block w-full text-left px-4 py-2 hover:bg-dark-700 text-sm"
            >
              导出 JSON
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="block w-full text-left px-4 py-2 hover:bg-dark-700 text-sm"
            >
              导出 CSV
            </button>
          </div>
        </div>
      </div>
      
      {/* 高级搜索面板 */}
      {showAdvanced && (
        <div className="mt-3 p-3 bg-dark-800/50 rounded-lg animate-slide-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 正则表达式 */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">正则表达式</label>
              <input
                type="text"
                placeholder="例: error.*timeout"
                value={filter.regex}
                onChange={(e) => setFilter({ regex: e.target.value })}
                className="w-full px-3 py-1.5 rounded text-sm"
              />
            </div>
            
            {/* 开始时间 */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">开始时间</label>
              <input
                type="datetime-local"
                value={filter.startTime || ''}
                onChange={(e) => setFilter({ startTime: e.target.value || null })}
                className="w-full px-3 py-1.5 rounded text-sm"
              />
            </div>
            
            {/* 结束时间 */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">结束时间</label>
              <input
                type="datetime-local"
                value={filter.endTime || ''}
                onChange={(e) => setFilter({ endTime: e.target.value || null })}
                className="w-full px-3 py-1.5 rounded text-sm"
              />
            </div>
            
            {/* 重置 */}
            <div className="flex items-end">
              <button
                onClick={() => setFilter({ keyword: '', regex: '', startTime: null, endTime: null, level: 'ALL' })}
                className="px-3 py-1.5 rounded hover:bg-dark-700 text-sm text-gray-400 hover:text-white transition-colors"
              >
                🔄 重置条件
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}