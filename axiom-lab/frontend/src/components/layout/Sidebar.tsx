import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, DollarSign, ShoppingCart, Users, FlaskConical, Package, Truck, Smartphone, Settings, ChevronLeft, ChevronRight, LogOut, TestTube, CheckSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/finance', icon: DollarSign, label: 'Finance', financeOnly: true },
  { to: '/sales', icon: ShoppingCart, label: 'Sales' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/products', icon: FlaskConical, label: 'Products' },
  { to: '/orders', icon: Package, label: 'Supplier Orders' },
  { to: '/suppliers', icon: Truck, label: 'Suppliers' },
  { to: '/platforms', icon: Smartphone, label: 'Platforms' },
  { to: '/todo', icon: CheckSquare, label: 'To-Do', badge: true },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [todoCount, setTodoCount] = useState(0);

  useEffect(() => {
    const fetchCount = () => {
      api.get<{ open: number }>('/todos/meta/counts').then(d => setTodoCount(d.open)).catch(() => {});
    };
    fetchCount();
    const iv = setInterval(fetchCount, 30000);
    return () => clearInterval(iv);
  }, []);

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-full bg-card border-r border-border flex flex-col transition-all duration-300 z-40',
      collapsed ? 'w-16' : 'w-56'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-border', collapsed && 'justify-center px-2')}>
        <div className="w-8 h-8 rounded-lg bg-cyan/10 border border-cyan/30 flex items-center justify-center shrink-0">
          <TestTube size={16} className="text-cyan" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-xs font-bold text-cyan tracking-widest uppercase leading-tight">The Axiom Lab</p>
            <p className="text-[10px] text-txt-muted tracking-wider">Bali · Research Compounds</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(item => {
          if (item.financeOnly && user?.role === 'employee') return null;
          const active = isActive(item.to);
          const count = item.badge ? todoCount : 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg mb-0.5 transition-all text-sm font-medium group',
                active
                  ? 'bg-cyan/10 text-cyan border border-cyan/20'
                  : 'text-txt-secondary hover:text-txt-primary hover:bg-white/[0.04]',
                collapsed && 'justify-center px-2'
              )}
            >
              <div className="relative shrink-0">
                <item.icon size={17} className={cn(active ? 'text-cyan' : 'group-hover:text-txt-primary')} />
                {count > 0 && collapsed && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-cyan rounded-full text-[8px] text-bg font-bold flex items-center justify-center">
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </div>
              {!collapsed && (
                <>
                  <span className="truncate flex-1">{item.label}</span>
                  {count > 0 && (
                    <span className="bg-cyan/20 text-cyan text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                      {count}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border p-2">
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="w-6 h-6 rounded-full bg-purple/20 border border-purple/30 flex items-center justify-center shrink-0">
              <span className="text-[10px] text-purple font-bold">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-txt-primary truncate">{user?.name}</p>
              <p className="text-[10px] text-txt-muted capitalize">{user?.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          title="Logout"
          className={cn('flex items-center gap-2 w-full px-3 py-2 rounded-lg text-txt-muted hover:text-danger hover:bg-danger/10 transition-all text-xs', collapsed && 'justify-center')}
        >
          <LogOut size={15} />
          {!collapsed && 'Logout'}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-txt-muted hover:text-cyan hover:border-cyan transition-all z-50"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  );
}
