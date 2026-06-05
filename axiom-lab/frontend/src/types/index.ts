export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'partner' | 'employee';
}

export interface Category {
  id: number;
  name: string;
  emoji: string;
  sort_order: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number;
  category_name: string;
  category_emoji: string;
  dose: string;
  sell_price: number;
  cost_price: number;
  stock: number;
  threshold: number;
  active: number;
  supplier_cat_no: string;
  units_sold: number;
  revenue_total: number;
  profit_total: number;
  shipping_fee_per_unit: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  name: string;
  whatsapp: string;
  instagram: string;
  area: string;
  type: 'Regular' | 'VIP' | 'Affiliate' | 'Wholesale';
  acquisition_channel: string;
  referral_code: string;
  commission_rate: number;
  notes: string;
  tags: string;
  total_orders: number;
  total_units: number;
  total_spent: number;
  first_order_date: string;
  last_order_date: string;
  orders?: Sale[];
}

export interface Supplier {
  id: number;
  name: string;
  aka: string;
  country: string;
  website: string;
  contact_name: string;
  whatsapp: string;
  email: string;
  bank_details: string;
  payment_methods: string;
  min_order: string;
  avg_delivery: string;
  rating: number;
  notes: string;
  total_spent: number;
  orders?: SupplierOrder[];
}

export interface SupplierOrder {
  id: number;
  order_ref: string;
  date: string;
  supplier_id: number;
  supplier_name: string;
  status: 'Ordered' | 'Shipped' | 'Partially Delivered' | 'Received' | 'Cancelled';
  total_idr: number;
  payment_method: string;
  shipping_cost_usd: number;
  notes: string;
  item_count?: number;
  items?: SupplierOrderItem[];
}

export interface SupplierOrderItem {
  id: number;
  order_id: number;
  product_name: string;
  product_id: number | null;
  qty: number;
  unit_cost_usd: number;
}

export interface SaleItem {
  id?: number;
  sale_id?: number;
  product_id: number;
  product_name: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
  line_total?: number;
  sku?: string;
}

export interface Sale {
  id: number;
  sale_ref: string;
  date: string;
  customer_id: number;
  customer_name: string;
  sale_type: 'Individual' | 'Bundle' | 'Bulk' | 'Affiliate';
  channel: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total_revenue: number;
  total_cost: number;
  profit: number;
  margin: number;
  payment_method: string;
  payment_status: 'Paid' | 'Pending' | 'Partial' | 'Refunded';
  order_status: 'Processing' | 'Packed' | 'Sent' | 'Delivered' | 'Cancelled';
  notes: string;
  items?: SaleItem[];
  items_summary?: string;
  units?: number;
}

export interface Settings {
  usd_idr_rate: string;
  default_delivery_fee: string;
  business_name: string;
  business_address: string;
  business_phone: string;
  business_email: string;
  business_website: string;
  instagram_followers: string;
  telegram_members: string;
  gmaps_rating: string;
  gmaps_reviews: string;
}

export interface Expense {
  id: number;
  expense_ref: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  amount_usd: number;
  payment_method: string;
  paid_by: string;
  status: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}
