import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, Package, MessageSquare, TrendingUp, AlertTriangle, CheckCircle, Clock, AlertCircle, Layers, ArrowRight } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { DashboardStats } from '../../types';
import StatCard from '../../components/ui/StatCard';
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

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (!data) return null;

  const flaggedCount = data.saleStatusCounts?.FLAGGED ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Live monitoring and business overview</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        {data.deletedSaleCount > 0 && (
          <button
            onClick={() => navigate('/admin/sales?deleted=true')}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs sm:text-sm font-semibold border border-red-200 transition"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{data.deletedSaleCount} Deleted Record{data.deletedSaleCount === 1 ? '' : 's'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
        {flaggedCount > 0 && (
          <button
            onClick={() => navigate('/admin/sales?status=FLAGGED')}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-sm transition animate-pulse"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{flaggedCount} Flagged Entr{flaggedCount === 1 ? 'y' : 'ies'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Today's Sales"
          value={formatCurrency(data.todaySalesTotal)}
          icon={<DollarSign className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Total Debt Outstanding"
          value={formatCurrency(data.totalOutstandingDebt)}
          icon={<TrendingUp className="w-5 h-5" />}
          color="red"
        />
        <StatCard
          title="Total Stock Units"
          value={`${data.totalStockUnits} pcs`}
          icon={<Layers className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Product Lines"
          value={`${data.totalProducts ?? 0} items`}
          icon={<Package className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Pending SMS"
          value={data.pendingSms.toString()}
          icon={<MessageSquare className="w-5 h-5" />}
          color="yellow"
        />
      </div>

      {/* Sale Verification Status Filter Row */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Sale Verification Flow (Click to Filter Sales)
          </h3>
          <span className="text-xs text-slate-400">Owner security monitor</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Pending Dispatch (Sales Logged)', key: 'BLUE', color: 'bg-blue-50 hover:bg-blue-100 border-blue-200', text: 'text-blue-700', icon: <Clock className="w-4 h-4" />, desc: 'Waiting for a matching dispatch log' },
            { label: 'Pending Sales (Dispatch Logged)', key: 'RED', color: 'bg-red-50 hover:bg-red-100 border-red-200', text: 'text-red-700', icon: <AlertCircle className="w-4 h-4" />, desc: 'Waiting for a matching sales log' },
            { label: 'Confirmed Matched', key: 'GREEN', color: 'bg-green-50 hover:bg-green-100 border-green-200', text: 'text-green-700', icon: <CheckCircle className="w-4 h-4" />, desc: 'Both workers matched' },
            { label: 'Flagged / Unpaired', key: 'FLAGGED', color: 'bg-orange-50 hover:bg-orange-100 border-orange-300 ring-2 ring-orange-400/30', text: 'text-orange-700', icon: <AlertTriangle className="w-4 h-4" />, desc: 'A matching entry is missing or details conflict' },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => navigate(`/admin/sales?status=${item.key}`)}
              className={`${item.color} border rounded-xl p-4 text-left transition-all hover:scale-[1.02] shadow-sm cursor-pointer`}
            >
              <div className={`flex items-center justify-between ${item.text} mb-1`}>
                <div className="flex items-center gap-1.5 font-medium text-xs">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              </div>
              <p className={`text-2xl font-bold ${item.text}`}>
                {data.saleStatusCounts?.[item.key as keyof typeof data.saleStatusCounts] ?? 0}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Sales — Last 7 Days</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.salesLast7Days || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Low Stock Products
          </h3>
          {(data.lowStockProducts || []).length === 0 ? (
            <p className="text-slate-400 text-sm">All products are well stocked.</p>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {(data.lowStockProducts || []).map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.category}</p>
                  </div>
                  <span className={`text-sm font-bold ${p.quantity === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                    {p.quantity} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Recent Activity</h3>
        {(data.recentActivity || []).length === 0 ? (
          <p className="text-slate-400 text-sm">No recent activity.</p>
        ) : (
          <div className="space-y-3">
            {(data.recentActivity || []).map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">{log.user?.name}</span>{' '}
                    <span className="text-slate-500">{log.action.toLowerCase().replace(/_/g, ' ')}</span>{' '}
                    <span className="text-slate-600">{log.entityType}</span>
                    {log.entityId ? <span className="text-slate-400"> #{log.entityId}</span> : null}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDate(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
