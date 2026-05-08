import { cn } from '../../lib/utils';

type BadgeVariant = 'cyan' | 'purple' | 'success' | 'warning' | 'danger' | 'gray' | 'blue';

const variants: Record<BadgeVariant, string> = {
  cyan: 'bg-cyan/10 text-cyan border-cyan/20',
  purple: 'bg-purple/10 text-purple border-purple/20',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  danger: 'bg-danger/10 text-danger border-danger/20',
  gray: 'bg-white/5 text-txt-secondary border-border',
  blue: 'bg-info/10 text-info border-info/20',
};

export default function Badge({ children, variant = 'gray', className }: { children: React.ReactNode; variant?: BadgeVariant; className?: string }) {
  return (
    <span className={cn('badge border', variants[variant], className)}>
      {children}
    </span>
  );
}

export function StockBadge({ stock, threshold }: { stock: number; threshold: number }) {
  if (stock === 0) return <Badge variant="danger">OUT OF STOCK</Badge>;
  if (stock <= threshold) return <Badge variant="warning">LOW STOCK</Badge>;
  return <Badge variant="success">IN STOCK</Badge>;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = { Paid: 'success', Pending: 'warning', Partial: 'blue', Refunded: 'danger' };
  return <Badge variant={map[status] || 'gray'}>{status}</Badge>;
}

export function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = { Processing: 'blue', Packed: 'purple', Sent: 'cyan', Delivered: 'success', Cancelled: 'danger' };
  return <Badge variant={map[status] || 'gray'}>{status}</Badge>;
}

export function SupplierStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = { Ordered: 'blue', Shipped: 'cyan', 'Partially Delivered': 'warning', Received: 'success', Cancelled: 'danger' };
  return <Badge variant={map[status] || 'gray'}>{status}</Badge>;
}
