import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Grid3x3,
  LayoutGrid,
  Menu,
  Plug,
  Settings,
  Sparkles,
  Table2,
  X,
} from 'lucide-react';
import { api } from '../api.js';

const TYPE_NAV = [
  { type: 'docx', label: '云文档', icon: FileText },
  { type: 'sheet', label: '电子表格', icon: Table2 },
  { type: 'bitable', label: '多维表格', icon: Grid3x3 },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const statusQuery = useQuery({ queryKey: ['status'], queryFn: api.status });
  const statsQuery = useQuery({ queryKey: ['typeStats'], queryFn: api.typeStats });

  const stats = Object.fromEntries(
    (statsQuery.data?.items || []).map((item) => [item.type, item.count])
  );
  const total = TYPE_NAV.reduce((sum, item) => sum + (stats[item.type] || 0), 0);
  const status = statusQuery.data;

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, location.search]);

  const navLinkClass = ({ isActive }) => `nav-item${isActive ? ' active' : ''}`;

  return (
    <div className="app-shell">
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            文
          </div>
          <div>
            <div className="brand-title">文档台</div>
            <div className="brand-sub">飞书文档汇总</div>
          </div>
          <button
            type="button"
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="关闭导航"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="nav">
          <div className="nav-group">
            <div className="nav-group-title">汇总</div>
            <NavLink to="/" end className={navLinkClass}>
              <LayoutGrid size={16} className="nav-icon" />
              <span className="nav-label">全部文档</span>
              <span className="nav-count">{total}</span>
            </NavLink>
            {TYPE_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.type}
                  to={`/type/${item.type}`}
                  className={navLinkClass}
                  style={{ '--nav-tone': `var(--${item.type})` }}
                >
                  <Icon size={16} className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                  <span className="nav-count">{stats[item.type] || 0}</span>
                </NavLink>
              );
            })}
          </div>

          <div className="nav-group">
            <div className="nav-group-title">管理</div>
            <NavLink to="/sources" className={navLinkClass}>
              <Plug size={16} className="nav-icon" />
              <span className="nav-label">数据源</span>
              <span className="nav-count">{status?.counts?.sources ?? 0}</span>
            </NavLink>
            <NavLink to="/settings" className={navLinkClass}>
              <Settings size={16} className="nav-icon" />
              <span className="nav-label">设置</span>
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-foot">
          <NavLink to="/assistant" className="assistant-entry">
            <Sparkles size={16} />
            <span>AI 助手</span>
          </NavLink>
          <div className="connection">
            <span className={`status-dot ${status?.feishuConfigured ? 'ok' : 'idle'}`} />
            <span>{status?.feishuConfigured ? '飞书已连接' : '飞书未配置'}</span>
          </div>
          <div className="sidebar-meta">
            {status ? `同步间隔 ${status.syncIntervalMinutes || 0} 分钟` : '正在读取状态'}
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="sidebar-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="mobile-bar">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="打开导航"
        >
          <Menu size={18} />
        </button>
        <span className="mobile-brand">文档台</span>
      </div>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
