import { useLogStore } from '../stores/logStore';
import { formatSize } from '../utils/helpers';

export default function Sidebar() {
  const { components, selectedComponent, setSelectedComponent, clearLogs } = useLogStore();
  
  // 按类型分组组件
  const groupedComponents = components.reduce((acc, comp) => {
    let group = 'other';
    if (comp.id.includes('higress')) group = 'higress';
    else if (comp.id.includes('nginx')) group = 'nginx';
    else if (comp.id.includes('minio') || comp.id.includes('mc-')) group = 'storage';
    else if (comp.id.includes('tuwunel') || comp.id.includes('matrix')) group = 'matrix';
    else if (comp.id.includes('manager') || comp.id.includes('supervisor')) group = 'system';
    
    if (!acc[group]) acc[group] = [];
    acc[group].push(comp);
    return acc;
  }, {} as Record<string, typeof components>);
  
  const groupLabels: Record<string, string> = {
    higress: '🌐 Higress',
    nginx: '📡 Nginx',
    storage: '💾 存储',
    matrix: '💬 Matrix',
    system: '⚙️ 系统',
    other: '📁 其他',
  };
  
  const handleSelect = (id: string) => {
    setSelectedComponent(id);
    clearLogs();
  };

  return (
    <aside className="w-64 glass border-r border-dark-700/50 flex flex-col overflow-hidden">
      {/* 标题 */}
      <div className="p-4 border-b border-dark-700/50">
        <h2 className="font-semibold text-gray-300 flex items-center gap-2">
          <span>📋</span>
          日志组件
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {components.length} 个组件可用
        </p>
      </div>
      
      {/* 组件列表 */}
      <div className="flex-1 overflow-auto p-2">
        {Object.entries(groupedComponents).map(([group, comps]) => (
          <div key={group} className="mb-4">
            <div className="text-xs text-gray-500 px-2 py-1 uppercase tracking-wider">
              {groupLabels[group] || group}
            </div>
            <div className="space-y-1">
              {comps.map(comp => (
                <button
                  key={comp.id}
                  onClick={() => handleSelect(comp.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 ${
                    selectedComponent === comp.id
                      ? 'bg-blue-600/20 text-blue-400 border-l-2 border-blue-500'
                      : 'hover:bg-dark-700/50 text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate text-sm">{comp.name}</span>
                    {comp.exists ? (
                      <span className="text-xs text-green-400">✓</span>
                    ) : (
                      <span className="text-xs text-red-400">✗</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {formatSize(comp.size)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* 底部状态 */}
      <div className="p-3 border-t border-dark-700/50 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>快捷键</span>
          <span className="text-gray-400">?</span>
        </div>
      </div>
    </aside>
  );
}