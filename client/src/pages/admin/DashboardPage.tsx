import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import {
  DollarSign, Package, MessageSquare, TrendingUp,
  AlertTriangle, CheckCircle, Clock, AlertCircle,
  Layers, ArrowRight, UserPlus, PlusCircle, ShieldCheck,
  Sparkles, X, BarChart2, Users,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import api from '../../api/axios';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { DashboardStats } from '../../types';
import Spinner from '../../components/ui/Spinner';

// ── Utility ───────────────────────────────────────────────────────────────────

const periodOptions = [
  { id: '3d', label: '3 Days' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '3m', label: '3 Months' },
  { id: '6m', label: '6 Months' },
  { id: '1y', label: '1 Year' },
] as const;

const salesPeriodOptions = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: '3m', label: '3 Months' },
  { id: 'all', label: 'All Time' },
] as const;

function getPeriodDates(period: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  let from = new Date();
  if (period === 'today') { /* same day */ }
  else if (period === 'week') from.setDate(now.getDate() - 7);
  else if (period === 'month') from.setMonth(now.getMonth() - 1);
  else if (period === '3m') from.setMonth(now.getMonth() - 3);
  else if (period === 'all') from = new Date('2020-01-01');
  return { dateFrom: from.toISOString().split('T')[0], dateTo: today };
}

// ── Overlay wrapper ───────────────────────────────────────────────────────────

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:rounded-2xl sm:max-w-2xl max-h-[90vh] flex flex-col shadow-2xl rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Sales Report Modal ────────────────────────────────────────────────────────

function SalesReportModal({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<string>('today');
  const dates = getPeriodDates(period);

  const { data, isLoading } = useQuery({
    queryKey: ['sales-report', dates.dateFrom, dates.dateTo],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard/sales-report', { params: dates });
      return res.data.data;
    },
  });

  return (
    <Overlay title="Sales Report" onClose={onClose}>
      {/* Period picker */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto scrollbar-none">
        {salesPeriodOptions.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriod(p.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              period === p.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">Total Sales</p>
              <p className="text-xl font-black text-blue-700">{formatCurrency(data?.totalRevenue || 0)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">Transactions</p>
              <p className="text-xl font-black text-slate-800">{data?.totalCount || 0}</p>
            </div>
          </div>

          {/* Table */}
          {(data?.dailyBreakdown || []).length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-sm">No sales in this period.</p>
          ) : (
            <div className="space-y-2">
              {(data?.dailyBreakdown || []).map((row: any) => (
                <div key={row.date} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-xl">
                  <span className="text-sm font-semibold text-slate-700">{formatDate(row.date)}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{formatCurrency(row.total)}</p>
                    <p className="text-xs text-slate-400">{row.count} sale{row.count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Overlay>
  );
}

// ── Debtors Modal ─────────────────────────────────────────────────────────────

function DebtorsModal({ debtors, onClose }: { debtors: any[]; onClose: () => void }) {
  return (
    <Overlay title="Outstanding Debts" onClose={onClose}>
      {debtors.length === 0 ? (
        <div className="text-center py-10">
          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No outstanding debts.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-xs text-slate-400 mb-3">{debtors.length} customer{debtors.length !== 1 ? 's' : ''} with outstanding balance</p>
          {debtors.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3 border border-red-100 bg-red-50 rounded-xl">
              <div>
                <p className="font-bold text-slate-900 text-sm">{d.name}</p>
                <p className="text-xs text-slate-400">{d.phone || '—'}</p>
              </div>
              <p className="font-black text-red-600 text-base">{formatCurrency(parseFloat(d.totalDebt || '0'))}</p>
            </div>
          ))}
        </div>
      )}
    </Overlay>
  );
}

// ── Stock Modal ───────────────────────────────────────────────────────────────

function StockModal({ products, onClose }: { products: any[]; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category?.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <Overlay title="Warehouse Stock" onClose={onClose}>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products..."
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="space-y-2">
        {filtered.map((p: any) => (
          <div key={p.id} className="flex items-center justify-between px-4 py-3 border border-slate-100 rounded-xl bg-slate-50">
            <div>
              <p className="font-semibold text-slate-900 text-sm">{p.name}</p>
              <p className="text-xs text-slate-400">{p.category}</p>
            </div>
            <div className="text-right">
              <p className={`font-bold text-sm ${p.quantity <= 0 ? 'text-red-600' : p.quantity < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {p.quantity} pcs
              </p>
              <p className="text-xs text-slate-500">{formatCurrency(parseFloat(p.price || '0'))}</p>
            </div>
          </div>
        ))}
      </div>
    </Overlay>
  );
}

// ── Analytics Panel ───────────────────────────────────────────────────────────

function AnalyticsPanel() {
  const [period, setPeriod] = useState<string>('7d');
  const [compareMonth, setCompareMonth] = useState('');

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['dashboard-analytics', period, compareMonth],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard/analytics', {
        params: { period, ...(compareMonth ? { compareMonth } : {}) },
      });
      return res.data.data;
    },
  });

  // Merge chartData + compareData for recharts dual-line
  const mergedData = (() => {
    if (!analytics) return [];
    const map = new Map<string, any>();
    (analytics.chartData || []).forEach((d: any) => {
      const label = (() => { try { return format(parseISO(d.date), 'MMM dd'); } catch { return d.date; } })();
      map.set(d.date, { date: label, current: d.total });
    });
    (analytics.compareData || []).forEach((d: any) => {
      const label = (() => { try { return format(parseISO(d.date), 'MMM dd'); } catch { return d.date; } })();
      const existing = map.get(d.date);
      if (existing) existing.compare = d.total;
      else map.set(d.date, { date: label, compare: d.total });
    });
    return Array.from(map.values());
  })();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-600" /> Sales Analytics
          </h3>
          <p className="text-xs text-slate-400">Performance trends — click a period or compare months</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period buttons */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {periodOptions.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                  period === p.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Compare month */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <label className="text-slate-500 font-semibold whitespace-nowrap">Compare with:</label>
        <input
          type="month"
          value={compareMonth}
          onChange={(e) => setCompareMonth(e.target.value)}
          className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {compareMonth && (
          <button
            onClick={() => setCompareMonth('')}
            className="p-1 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : mergedData.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <BarChart2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-sm">No sales data for this period.</p>
        </div>
      ) : (
        <>
          <div className="h-52 sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(v: number) => `GH₵${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [
                    formatCurrency(v),
                    name === 'current' ? 'Current Period' : `Compare (${compareMonth})`,
                  ]}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: 'none', fontSize: 12 }}
                />
                {compareMonth && <Legend />}
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  name="current"
                />
                {compareMonth && (
                  <Line
                    type="monotone"
                    dataKey="compare"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="compare"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Summary pills */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Grand Total</p>
              <p className="text-sm font-black text-blue-700">{formatCurrency(analytics?.grandTotal || 0)}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Transactions</p>
              <p className="text-sm font-black text-slate-800">{analytics?.totalCount || 0}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Avg / Day</p>
              <p className="text-sm font-black text-slate-800">
                {mergedData.length > 0
                  ? formatCurrency((analytics?.grandTotal || 0) / mergedData.length)
                  : formatCurrency(0)}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();

  // Modal states
  const [showSalesReport, setShowSalesReport] = useState(false);
  const [showDebtors, setShowDebtors] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [showProducts, setShowProducts] = useState(false);

  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard');
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-72">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!data) return null;

  const flaggedCount = data.saleStatusCounts?.FLAGGED ?? 0;
  const allProducts: any[] = (data as any).allProducts || [];
  const allDebtors: any[] = (data as any).allDebtors || [];

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-40 -top-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-blue-200 border border-white/10">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Store Owner Live Command Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Store Overview & Audit</h1>
            <p className="text-blue-100/80 text-xs sm:text-sm max-w-xl leading-relaxed">
              Real-time monitoring of wholesale & retail sales, independent stock balances, and worker verification flows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => navigate('/admin/products')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold backdrop-blur-md border border-white/20 transition shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Manage Products</span>
            </button>
            <button
              onClick={() => navigate('/admin/users')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-md"
            >
              <UserPlus className="w-4 h-4" />
              <span>Manage Staff</span>
            </button>
          </div>
        </div>

        {(data.deletedSaleCount > 0 || flaggedCount > 0 || (data.verifiedSaleCount ?? 0) > 0) && (
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap gap-2.5">
            {data.deletedSaleCount > 0 && (
              <button
                onClick={() => navigate('/admin/sales?deleted=true')}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-xl text-xs font-semibold border border-red-400/30 transition"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>{data.deletedSaleCount} Deleted Review Record{data.deletedSaleCount === 1 ? '' : 's'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {flaggedCount > 0 && (
              <button
                onClick={() => navigate('/admin/sales?status=FLAGGED')}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-xl text-xs font-semibold border border-amber-400/30 transition animate-pulse"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{flaggedCount} Mismatched / Flagged Log{flaggedCount === 1 ? '' : 's'} (Requires Review)</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {(data.verifiedSaleCount ?? 0) > 0 && (
              <button
                onClick={() => navigate('/admin/sales?verified=true')}
                className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 rounded-xl text-xs font-semibold border border-emerald-400/30 transition"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{data.verifiedSaleCount} Verified Sale{data.verifiedSaleCount === 1 ? '' : 's'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Top Metric Cards — 2-col on mobile ────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Today's Sales — clickable */}
        <button
          onClick={() => setShowSalesReport(true)}
          className="bg-white rounded-2xl p-3 sm:p-4 border border-blue-200 shadow-sm hover:shadow-md hover:border-blue-400 active:scale-95 transition text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 leading-tight">Today's Sales</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-blue-700 mt-1.5 break-all leading-tight">
            {formatCurrency(data.todaySalesTotal)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-0.5">
            <span>View report</span>
            <ArrowRight className="w-3 h-3" />
          </p>
        </button>

        {/* Outstanding Debt — clickable */}
        <button
          onClick={() => setShowDebtors(true)}
          className="bg-white rounded-2xl p-3 sm:p-4 border border-red-200 shadow-sm hover:shadow-md hover:border-red-400 active:scale-95 transition text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 leading-tight">Outstanding Debt</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-red-600 mt-1.5 break-all leading-tight">
            {formatCurrency(data.totalOutstandingDebt)}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-0.5">
            <span>View debtors</span>
            <ArrowRight className="w-3 h-3" />
          </p>
        </button>

        {/* Warehouse Stock — clickable */}
        <button
          onClick={() => setShowStock(true)}
          className="bg-white rounded-2xl p-3 sm:p-4 border border-emerald-200 shadow-sm hover:shadow-md hover:border-emerald-400 active:scale-95 transition text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 leading-tight">Warehouse Stock</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-slate-900 mt-1.5">
            {data.totalStockUnits.toLocaleString()} <span className="text-xs font-semibold text-slate-500">pcs</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-0.5">
            <span>View all stock</span>
            <ArrowRight className="w-3 h-3" />
          </p>
        </button>

        {/* Product Lines — clickable */}
        <button
          onClick={() => setShowProducts(true)}
          className="bg-white rounded-2xl p-3 sm:p-4 border border-indigo-200 shadow-sm hover:shadow-md hover:border-indigo-400 active:scale-95 transition text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 leading-tight">Product Lines</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-slate-900 mt-1.5">
            {data.totalProducts ?? 0} <span className="text-xs font-semibold text-slate-500">items</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-0.5">
            <span>Browse catalog</span>
            <ArrowRight className="w-3 h-3" />
          </p>
        </button>

        {/* Pending SMS — navigate */}
        <button
          onClick={() => navigate('/admin/sms-queue')}
          className="bg-white rounded-2xl p-3 sm:p-4 border border-amber-200 shadow-sm hover:shadow-md hover:border-amber-400 active:scale-95 transition text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 leading-tight">Pending SMS</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-amber-600 mt-1.5">
            {data.pendingSms.toString()}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-0.5">
            <span>Approve messages</span>
            <ArrowRight className="w-3 h-3" />
          </p>
        </button>

        {/* Verified Sales — navigate to verified registry */}
        <button
          onClick={() => navigate('/admin/sales?verified=true')}
          className="bg-white rounded-2xl p-3 sm:p-4 border border-teal-200 shadow-sm hover:shadow-md hover:border-teal-400 active:scale-95 transition text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 leading-tight">Verified Sales</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-teal-700 mt-1.5">
            {(data.verifiedSaleCount ?? 0).toString()}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-0.5">
            <span>View verified</span>
            <ArrowRight className="w-3 h-3" />
          </p>
        </button>
      </div>

      {/* ── Verification Pipeline ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Worker Verification Pipeline
            </h3>
          </div>
          <span className="text-xs text-slate-400">Independent check system</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: 'Sales Logged (Pending Dispatch)',
              key: 'BLUE',
              count: data.saleStatusCounts?.BLUE ?? 0,
              cardBg: 'bg-blue-50/70 hover:bg-blue-100/80 border-blue-200 text-blue-950',
              icon: <Clock className="w-4 h-4 text-blue-600" />,
              desc: 'Worker A recorded sale; awaiting Worker B warehouse dispatch',
              href: '/admin/sales?status=BLUE',
            },
            {
              label: 'Dispatch Logged (Pending Sales)',
              key: 'RED',
              count: data.saleStatusCounts?.RED ?? 0,
              cardBg: 'bg-red-50/70 hover:bg-red-100/80 border-red-200 text-red-950',
              icon: <AlertCircle className="w-4 h-4 text-red-600" />,
              desc: 'Worker B dispatched goods; awaiting Worker A sales log',
              href: '/admin/sales?status=RED',
            },
            {
              label: 'Confirmed & Matched',
              key: 'GREEN',
              count: data.saleStatusCounts?.GREEN ?? 0,
              cardBg: 'bg-emerald-50/70 hover:bg-emerald-100/80 border-emerald-200 text-emerald-950',
              icon: <CheckCircle className="w-4 h-4 text-emerald-600" />,
              desc: 'Both worker logs verified; ready for admin verification',
              href: '/admin/sales?status=GREEN',
            },
            {
              label: 'Flagged / Conflicted',
              key: 'FLAGGED',
              count: data.saleStatusCounts?.FLAGGED ?? 0,
              cardBg: 'bg-amber-50/80 hover:bg-amber-100 border-amber-300 text-amber-950 ring-2 ring-amber-400/20',
              icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
              desc: 'Quantity, price, or item mismatch detected between workers',
              href: '/admin/sales?status=FLAGGED',
            },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(item.href)}
              className={`${item.cardBg} border rounded-2xl p-3.5 text-left transition-all hover:scale-[1.01] shadow-sm cursor-pointer space-y-1.5`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  {item.icon}
                  <span className="leading-tight">{item.label}</span>
                </div>
                <ArrowRight className="w-3 h-3 opacity-50 shrink-0" />
              </div>
              <p className="text-3xl font-black">
                {item.count}
              </p>
              <p className="text-[11px] text-slate-600 leading-snug">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart + Low Stock ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Sales Trend — Last 7 Days</h3>
              <p className="text-xs text-slate-400">Daily revenue performance</p>
            </div>
            <button
              onClick={() => navigate('/admin/sales')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.salesLast7Days || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', border: 'none' }}
                />
                <Bar dataKey="total" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-800">Low Stock Inventory</h3>
              </div>
              <button
                onClick={() => navigate('/admin/products')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>Manage Stock</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {(data.lowStockProducts || []).length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">All products have healthy stock levels.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {(data.lowStockProducts || []).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-800">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.category}</p>
                    </div>
                    <span
                      className={`text-xs font-extrabold px-2.5 py-1 rounded-lg ${
                        p.quantity === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {p.quantity} pcs left
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Analytics Panel ───────────────────────────────────────────────── */}
      <AnalyticsPanel />

      {/* ── Recent Activity ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800">Recent System Activity</h3>
          <button
            onClick={() => navigate('/admin/audit-log')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>Full Audit Trail</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {(data.recentActivity || []).length === 0 ? (
          <p className="text-slate-400 text-sm">No recent activity recorded.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(data.recentActivity || []).map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100 text-xs"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 font-semibold truncate">
                    <span>{log.user?.name || 'Staff'}</span>{' '}
                    <span className="text-slate-500 font-normal">({log.action.toLowerCase().replace(/_/g, ' ')})</span>
                  </p>
                  <p className="text-slate-400 text-[11px] mt-0.5">{formatDate(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showSalesReport && <SalesReportModal onClose={() => setShowSalesReport(false)} />}
      {showDebtors && <DebtorsModal debtors={allDebtors} onClose={() => setShowDebtors(false)} />}
      {showStock && <StockModal products={allProducts} onClose={() => setShowStock(false)} />}
      {showProducts && (
        <Overlay title="Product Catalog" onClose={() => setShowProducts(false)}>
          <div className="space-y-2">
            {allProducts.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 border border-slate-100 rounded-xl bg-slate-50">
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.category}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${p.quantity < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {p.quantity} pcs
                  </p>
                  <p className="text-xs text-slate-500">{formatCurrency(parseFloat(p.price || '0'))}</p>
                </div>
              </div>
            ))}
          </div>
        </Overlay>
      )}
    </div>
  );
}
