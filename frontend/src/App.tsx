import { useEffect, useCallback, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LogStream from './components/LogStream';
import SearchPanel from './components/SearchPanel';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import { useLogStore, usePreferencesStore } from './stores/logStore';
import { getComponents, isAuthenticated } from './services/api';

function App() {
  const { setComponents, setSelectedComponent, selectedComponent, isAuthenticated: isAuth } = useLogStore();
  const { preferences, setPreferences } = usePreferencesStore();
  const [showLogin, setShowLogin] = useState(true);
  
  // 检查认证状态
  useEffect(() => {
    const auth = isAuthenticated();
    setShowLogin(!auth);
  }, [isAuth]);

  // 加载组件列表
  useEffect(() => {
    if (!showLogin) {
      const loadComponents = async () => {
        try {
          const data = await getComponents();
          setComponents(data.components);
          if (data.components.length > 0 && !selectedComponent) {
            setSelectedComponent(data.components[0].id);
          }
        } catch (error) {
          console.error('Failed to load components:', error);
        }
      };
      loadComponents();
    }
  }, [showLogin, setComponents, setSelectedComponent, selectedComponent]);
  
  // 主题切换
  useEffect(() => {
    document.documentElement.classList.toggle('dark', preferences.theme === 'dark');
  }, [preferences.theme]);

  // 快捷键
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl/Cmd + K 聚焦搜索
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('search-input');
      searchInput?.focus();
    }
    // T 切换主题
    if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const activeElement = document.activeElement;
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') return;
      setPreferences({ theme: preferences.theme === 'dark' ? 'light' : 'dark' });
    }
  }, [preferences.theme, setPreferences]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 登录成功回调
  const handleLoginSuccess = useCallback(() => {
    setShowLogin(false);
  }, []);

  // 显示登录页面
  if (showLogin) {
    return (
      <>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            },
          }}
        />
        <LoginPage onSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-dark-950 text-gray-100">
      {/* Toast 提示 */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid rgba(59, 130, 246, 0.3)',
          },
        }}
      />
      
      {/* 侧边栏 */}
      <Sidebar />
      
      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 头部 */}
        <Header />
        
        {/* 搜索面板 */}
        <SearchPanel />
        
        {/* 内容区域 - Dashboard 和日志流 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧：仪表盘 - 始终显示 */}
          <div className="w-80 border-r border-dark-700/50 overflow-hidden flex-shrink-0">
            <Dashboard />
          </div>
          
          {/* 右侧：日志流 */}
          <div className="flex-1 overflow-hidden">
            <LogStream />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;