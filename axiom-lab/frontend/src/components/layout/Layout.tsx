import { useState, ReactNode } from 'react';
import Sidebar from './Sidebar';
import { cn } from '../../lib/utils';

export default function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-bg flex">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main className={cn('flex-1 min-h-screen transition-all duration-300', collapsed ? 'ml-16' : 'ml-56')}>
        <div className="p-6 max-w-[1600px]">
          {children}
        </div>
      </main>
    </div>
  );
}
