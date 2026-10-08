// Frontend representations of the POS API's JSON contracts.

export type Role = 'ADMIN' | 'WORKER_A' | 'WORKER_B';
export type CustomerType = 'WALK_IN' | 'REGISTERED';
export type SaleStatus = 'BLUE' | 'RED' | 'GREEN' | 'FLAGGED';
export type PaymentMode = 'CC' | 'CREDIT';
export type SaleType = 'WHOLESALE' | 'RETAIL';
export type CreditStatus = 'OUTSTANDING' | 'PARTIAL' | 'PAID';
export type SmsStatus = 'PENDING' | 'APPROVED' | 'SENT' | 'REJECTED';
export type Money = number | string;

export interface User {
  id: number;
  name: string;
  username: string;
  role: Role;
  isActive?: boolean;
  createdAt?: string;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address?: string | null;
  customerType: CustomerType;
  notes?: string | null;
  totalDebt?: Money;
  totalOutstandingDebt?: Money;
  pendingDebt?: Money;
  totalPotentialDebt?: Money;
  salesCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Product {
  id: number;
  name: string;
  brand: string | null;
  category: string;
  colours: string[] | null;
  sizes: string[] | null;
  quantity: number;
  price: Money;
  imageUrl: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  product?: Product;
  size: string | null;
  colour: string | null;
  quantity: number;
  originalPrice: Money;
  unitPrice: Money;
  subtotal: Money;
}

export interface Sale {
  id: number;
  customerId: number;
  customer?: Customer;
  workerAId: number | null;
  workerA?: User | null;
  workerBId: number | null;
  workerB?: User | null;
  status: SaleStatus;
  paymentMode: PaymentMode;
  saleType: SaleType;
  originalTotal: Money;
  discountAmount: Money;
  finalTotal: Money;
  adminVerified: boolean;
  saleItems: SaleItem[];
  notes: string | null;
  saleDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreditPayment {
  id: number;
  creditLedgerId: number;
  amountPaid: Money;
  paymentDate: string;
  recordedById: number;
  recordedBy?: User;
  notes: string | null;
  createdAt: string;
}

export interface Credit {
  id: number;
  customerId: number;
  customer?: Customer;
  saleId: number;
  sale?: Sale;
  totalAmount: Money;
  amountPaid: Money;
  balance: Money;
  status: CreditStatus;
  payments: CreditPayment[];
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SmsQueueItem {
  id: number;
  customerId: number;
  customer?: Customer;
  saleId: number;
  message: string;
  status: SmsStatus;
  adminApprovedAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  userId: number;
  user?: User;
  action: string;
  entityType: string;
  entityId: number | null;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface DashboardStats {
  todaySalesTotal: number;
  totalOutstandingDebt: number;
  totalProducts: number;
  deletedSaleCount: number;
  totalStockUnits: number;
  pendingSms: number;
  salesLast7Days: { date: string; total: number; count: number }[];
  saleStatusCounts: Record<SaleStatus, number>;
  lowStockProducts: Product[];
  recentActivity: AuditLog[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface Notification {
  id: number;
  type: string;
  message: string;
  isRead: boolean;
  targetRole: Role | null;
  targetUserId: number | null;
  relatedEntity: string | null;
  relatedId: number | null;
  createdAt: string;
}

export interface CartItem {
  productId: number;
  product: Product;
  size: string;
  colour: string;
  quantity: number;
  originalPrice: number;
  unitPrice: number;
}
