import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { checkUpdate, getVersion, upgrade, uninstall } from '../services/api';

interface VersionInfo {
  current: string;
  latest: string;
  hasUpdate: boolean;
  releaseNotes?: string;
}

export default function SystemManager() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);

  // 获取版本信息
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const version = await getVersion();
        setVersionInfo({
          current: version.version || '2.1.0',
          latest: version.version || '2.1.0',
          hasUpdate: false,
        });
      } catch (error) {
        console.error('Failed to get version:', error);
        setVersionInfo({
          current: '2.1.0',
          latest: '2.1.0',
          hasUpdate: false,
        });
      }
    };
    fetchVersion();
  }, []);

  // 检查更新
  const handleCheckUpdate = useCallback(async () => {
    setChecking(true);
    try {
      const result = await checkUpdate();
      setVersionInfo({
        current: result.current,
        latest: result.latest,
        hasUpdate: result.hasUpdate,
        releaseNotes: result.releaseNotes,
      });
      
      if (result.hasUpdate) {
        toast.success(`发现新版本 ${result.latest}！`);
      } else {
        toast.success('已是最新版本');
      }
    } catch (error) {
      toast.error('检查更新失败: ' + (error as Error).message);
    } finally {
      setChecking(false);
    }
  }, []);

  // 执行升级
  const handleUpgrade = useCallback(async () => {
    if (!confirm('确定要升级到最新版本吗？升级过程中服务会短暂中断。')) {
      return;
    }

    setLoading(true);
    toast.loading('正在升级...', { id: 'upgrade' });
    
    try {
      const result = await upgrade();
      if (result.success) {
        toast.success('升级成功！页面将在 3 秒后刷新...', { id: 'upgrade' });
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        toast.error(result.message || '升级失败', { id: 'upgrade' });
      }
    } catch (error) {
      toast.error('升级失败: ' + (error as Error).message, { id: 'upgrade' });
    } finally {
      setLoading(false);
    }
  }, []);

  // 执行卸载
  const handleUninstall = useCallback(async () => {
    setLoading(true);
    toast.loading('正在卸载...', { id: 'uninstall' });
    
    try {
      const result = await uninstall();
      if (result.success) {
        toast.success('卸载成功！', { id: 'uninstall' });
        setShowUninstallConfirm(false);
        // 显示卸载成功页面
        document.body.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #020617; color: #f8fafc; font-family: system-ui;">
            <div style="text-align: center;">
              <div style="font-size: 64px; margin-bottom: 16px;">🗑️</div>
              <h1 style="font-size: 24px; margin-bottom: 8px;">HiClaw Log Analyzer 已卸载</h1>
              <p style="color: #94a3b8;">感谢使用！</p>
            </div>
          </div>
        `;
      } else {
        toast.error(result.message || '卸载失败', { id: 'uninstall' });
      }
    } catch (error) {
      toast.error('卸载失败: ' + (error as Error).message, { id: 'uninstall' });
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="bg-dark-800/50 rounded-lg p-3">
      <h4 className="text-sm text-gray-400 mb-3 flex items-center gap-2">
        <span>🔧</span>
        系统管理
      </h4>
      
      {/* 版本信息 */}
      <div className="flex items-center justify-between py-2 px-2 bg-dark-700/30 rounded mb-3">
        <div>
          <span className="text-xs text-gray-500">当前版本</span>
          <div className="text-sm font-medium">v{versionInfo?.current || '...'}</div>
        </div>
        
        {/* 检查更新按钮 */}
        <button
          onClick={handleCheckUpdate}
          disabled={checking || loading}
          className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-sm disabled:opacity-50"
        >
          {checking ? '检查中...' : '🔍 检查更新'}
        </button>
      </div>

      {/* 有新版本时显示升级按钮 */}
      {versionInfo?.hasUpdate && (
        <div className="mb-3 p-2 bg-green-600/10 border border-green-600/30 rounded">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-green-400">🆕 新版本 {versionInfo.latest} 可用</div>
              {versionInfo.releaseNotes && (
                <div className="text-xs text-gray-400 mt-1">{versionInfo.releaseNotes}</div>
              )}
            </div>
            <button
              onClick={handleUpgrade}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 hover:bg-green-600/30 text-sm disabled:opacity-50"
            >
              {loading ? '升级中...' : '⬆️ 立即升级'}
            </button>
          </div>
        </div>
      )}

      {/* 卸载区域 */}
      <div className="border-t border-dark-600/50 pt-3">
        {!showUninstallConfirm ? (
          <button
            onClick={() => setShowUninstallConfirm(true)}
            disabled={loading}
            className="w-full px-3 py-2 rounded-lg bg-red-600/10 border border-red-600/30 text-red-400 hover:bg-red-600/20 text-sm disabled:opacity-50"
          >
            🗑️ 卸载 Log Analyzer
          </button>
        ) : (
          <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-3">
            <div className="text-sm text-red-400 mb-2">
              ⚠️ 确定要卸载吗？此操作不可恢复！
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowUninstallConfirm(false)}
                disabled={loading}
                className="flex-1 px-3 py-1.5 rounded-lg bg-dark-700/50 text-gray-400 hover:bg-dark-700 text-sm disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleUninstall}
                disabled={loading}
                className="flex-1 px-3 py-1.5 rounded-lg bg-red-600/30 text-red-400 hover:bg-red-600/40 text-sm disabled:opacity-50"
              >
                {loading ? '卸载中...' : '确认卸载'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}