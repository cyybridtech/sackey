import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  DollarSign,
  Package,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  AlertCircle,
  Layers,
  ArrowRight,
  UserPlus,
  PlusCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { DashboardStats } from '../../types';
import Spinner from '../../components/ui/Spinner';

export default function DashboardPage() {
  const navigate = useNavigate();
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

  return (
    <div className="space-y-6">
      {/* Dynamic Greeting & Live Store Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
        {/* Background decorative glow */}
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

          {/* Action Pills */}
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

        {/* Action Alerts */}
        {(data.deletedSaleCount > 0 || flaggedCount > 0) && (
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
          </div>
        )}
      </div>

      {/* Top Essential Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Today's Sales */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Today's Sales</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">
            {formatCurrency(data.todaySalesTotal)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Confirmed matched transactions</p>
        </div>

        {/* Total Debt */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Outstanding Debt</span>
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-red-600 mt-2">
            {formatCurrency(data.totalOutstandingDebt)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Customer credit balance owed</p>
        </div>

        {/* Physical Stock Units */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Warehouse Stock</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">
            {data.totalStockUnits.toLocaleString()} <span className="text-xs font-semibold text-slate-500">pcs</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Physical units in inventory</p>
        </div>

        {/* Product Catalog */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Product Lines</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">
            {data.totalProducts ?? 0} <span className="text-xs font-semibold text-slate-500">items</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Active registered inventory</p>
        </div>

        {/* Pending SMS */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending SMS</span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-amber-600 mt-2">
            {data.pendingSms.toString()}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting owner approval</p>
        </div>
      </div>

      {/* Dual Confirmation Pipeline Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Worker Verification Pipeline (Click to Inspect)
            </h3>
          </div>
          <span className="text-xs text-slate-400">Independent check system</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[
            {
              label: 'Sales Logged (Pending Dispatch)',
              key: 'BLUE',
              cardBg: 'bg-blue-50/70 hover:bg-blue-100/80 border-blue-200 text-blue-950',
              icon: <Clock className="w-4 h-4 text-blue-600" />,
              desc: 'Worker A recorded sale; awaiting Worker B warehouse dispatch',
            },
            {
              label: 'Dispatch Logged (Pending Sales)',
              key: 'RED',
              cardBg: 'bg-red-50/70 hover:bg-red-100/80 border-red-200 text-red-950',
              icon: <AlertCircle className="w-4 h-4 text-red-600" />,
              desc: 'Worker B dispatched goods; awaiting Worker A sales log',
            },
            {
              label: 'Confirmed & Matched',
              key: 'GREEN',
              cardBg: 'bg-emerald-50/70 hover:bg-emerald-100/80 border-emerald-200 text-emerald-950',
              icon: <CheckCircle className="w-4 h-4 text-emerald-600" />,
              desc: 'Both worker logs verified; stock deducted & receipt final',
            },
            {
              label: 'Flagged / Conflicted',
              key: 'FLAGGED',
              cardBg: 'bg-amber-50/80 hover:bg-amber-100 border-amber-300 text-amber-950 ring-2 ring-amber-400/20',
              icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
              desc: 'Quantity, price, or item mismatch detected between workers',
            },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(`/admin/sales?status=${item.key}`)}
              className={`${item.cardBg} border rounded-2xl p-4 text-left transition-all hover:scale-[1.01] shadow-sm cursor-pointer space-y-2`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 opacity-50" />
              </div>
              <p className="text-3xl font-black">
                {data.saleStatusCounts?.[item.key as keyof typeof data.saleStatusCounts] ?? 0}
              </p>
              <p className="text-[11px] text-slate-600 leading-snug">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Analytics & Low Stock Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
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
                        p.quantity === 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
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

      {/* Recent Activity Audit Trail */}
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
    </div>
  );
}
