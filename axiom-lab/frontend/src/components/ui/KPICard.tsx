import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface KPICardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  trend?: { value: string; positive?: boolean };
  accent?: 'cyan' | 'purple' | 'success' | 'warning' | 'danger';
  loading?: boolean;
}

const accentColors = {
  cyan: 'border-cyan/20 shadow-glow-cyan',
  purple: 'border-purple/20 shadow-glow-purple',
  success: 'border-success/20',
  warning: 'border-warning/20',
  danger: 'border-danger/20',
};

const iconColors = {
  cyan: 'bg-cyan/10 text-cyan',
  purple: 'bg-purple/10 text-purple',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

export default function KPICard({ label, value, sub, icon, trend, accent = 'cyan', loading }: KPICardProps) {
  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="h-3 w-24 bg-border rounded mb-3" />
        <div className="h-7 w-32 bg-border rounded mb-2" />
        <div className="h-3 w-16 bg-border rounded" />
      </div>
    );
  }

  return (
    <div className={cn('card border transition-all hover:border-opacity-50', accentColors[accent])}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-txt-secondary uppercase tracking-wider mb-2">{label}</p>
          <p className="text-xl font-bold text-txt-primary leading-tight truncate">{value}</p>
          {sub && <p className="text-xs text-txt-muted mt-1">{sub}</p>}
          {trend && (
            <p className={cn('text-xs mt-2 font-medium', trend.positive ? 'text-success' : 'text-danger')}>
              {trend.positive ? '▲' : '▼'} {trend.value}
            </p>
          )}
        </div>
        {icon && (
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconColors[accent])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
