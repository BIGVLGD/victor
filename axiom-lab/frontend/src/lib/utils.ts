export function formatIDR(amount: number): string {
  if (isNaN(amount)) return 'IDR 0';
  return 'IDR ' + Math.round(amount).toLocaleString('id-ID');
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('id-ID');
}

export function formatPercent(n: number): string {
  return n.toFixed(1) + '%';
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getStockStatus(stock: number, threshold: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (stock === 0) return 'out_of_stock';
  if (stock <= threshold) return 'low_stock';
  return 'in_stock';
}

export function stockLabel(stock: number, threshold: number): string {
  const s = getStockStatus(stock, threshold);
  if (s === 'out_of_stock') return 'OUT OF STOCK';
  if (s === 'low_stock') return 'LOW STOCK';
  return 'IN STOCK';
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export const PAYMENT_METHODS = ['Cash', 'PayPal', 'Revolut', 'Wise', 'Crypto', 'Bank Transfer'];
export const PAYMENT_STATUSES = ['Paid', 'Pending', 'Partial', 'Refunded'];
export const ORDER_STATUSES = ['Processing', 'Packed', 'Sent', 'Delivered', 'Cancelled'];
export const CHANNELS = ['WhatsApp', 'Instagram', 'Google Maps', 'TikTok', 'Telegram', 'Affiliate', 'Other'];
export const SALE_TYPES = ['Individual', 'Bundle', 'Bulk', 'Affiliate'];
export const CUSTOMER_TYPES = ['Regular', 'VIP', 'Affiliate', 'Wholesale'];
export const BALI_AREAS = ['Canggu', 'Seminyak', 'Ubud', 'Kuta', 'Pererenan', 'Sanur', 'Other'];
export const SUPPLIER_STATUSES = ['Ordered', 'Shipped', 'Partially Delivered', 'Received', 'Cancelled'];

export const PAYMENT_ICONS: Record<string, string> = {
  Cash: '💵',
  PayPal: '💙',
  Revolut: '🔵',
  Wise: '🟢',
  Crypto: '🟡',
  'Bank Transfer': '🏦',
};
