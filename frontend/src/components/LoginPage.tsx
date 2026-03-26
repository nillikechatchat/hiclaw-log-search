import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useLogStore } from '../stores/logStore';
import { verifyToken } from '../services/api';

interface LoginPageProps {
  onSuccess: () => void;
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const { setAuthenticated } = useLogStore();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token.trim()) {
      toast.error('请输入访问秘钥');
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await verifyToken(token.trim());
      
      if (result.success) {
        setAuthenticated(true);
        toast.success('验证成功！');
        onSuccess();
      } else {
        toast.error('秘钥无效或已过期');
      }
    } catch (error) {
      toast.error('验证失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, setAuthenticated, onSuccess]);

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">📊</div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            HiClaw Log Analyzer
          </h1>
          <p className="text-gray-400 mt-2">请输入访问秘钥以继续</p>
        </div>
        
        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="glass rounded-xl p-6">
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              🔐 一次性访问秘钥
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="请输入秘钥..."
              className="w-full px-4 py-3 rounded-lg text-center text-lg tracking-widest"
              autoFocus
              disabled={loading}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full btn-gradient py-3 rounded-lg font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '⏳ 验证中...' : '验证并访问'}
          </button>
          
          <p className="text-center text-gray-500 text-sm mt-4">
            秘钥由系统管理员在宿主机生成
          </p>
        </form>
        
        {/* 帮助信息 */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>生成秘钥命令：</p>
          <code className="bg-dark-800 px-3 py-1 rounded mt-1 inline-block">
            copaw-token generate
          </code>
        </div>
      </div>
    </div>
  );
}