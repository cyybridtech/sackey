import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardList,
  Trash2,
  Search,
  ShoppingCart,
  DollarSign,
  CreditCard,
  Layers,
  Clock,
  Calendar,
  Tag,
  X,
  ChevronRight,
} from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import DeleteConfirmModal from '../../components/ui/DeleteConfirmModal';
import toast from 'react-hot-toast';

// ── helpers ──────────────────────────────────────────────────────────────────

const todayStr = () => new Date().toISOString().split('T')[0];

const nDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

// ── History Drawer ─────────────────────────────────────────────────────────

function SalesHistoryDrawer({ onClose }: { onClose: () => void }) {
  const [dateFrom, setDateFrom] = useState(nDaysAgo(30));
  const [dateTo, setDateTo] = useState(todayStr());
  const [applied, setApplied] = useState({ from: nDaysAgo(30), to: todayStr() });

  const { data: historySales = [], isFetching } = useQuery({
    queryKey: ['my-sales-history', applied.from, applied.to],
    queryFn: async () => {
      const res = await api.get('/sales/my-sales', {
        params: { dateFrom: applied.from, dateTo: applied.to },
      });
      return res.data.data;
    },
  });

  const periodTotal = useMemo(
    () => historySales.reduce((s: number, sale: any) => s + parseFloat(sale.finalTotal || '0'), 0),
    [historySales]
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel — slides in from right */}
      <div className="relative ml-auto w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0 bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
          <div>
            <h2 className="text-base font-bold">Sales History</h2>
            <p className="text-xs text-blue-200">Select a date range to explore</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Filter */}
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={todayStr()}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setApplied({ from: dateFrom, to: dateTo })}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition whitespace-nowrap"
            >
              Apply
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {isFetching ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : historySales.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <Calendar className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-sm font-medium">No sales in this period.</p>
            </div>
          ) : (
            <div className="p-4 space-y-2.5">
              {historySales.map((sale: any) => (
                <div
                  key={sale.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                      Sale #{sale.id}
                    </span>
                    <span className="text-xs text-slate-400">{formatDateTime(sale.saleDate)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">
                      {sale.customer?.name || 'Walk-in Customer'}
                    </span>
                    <span className="font-black text-slate-900">
                      {formatCurrency(parseFloat(sale.finalTotal))}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={sale.paymentMode === 'CC' ? 'green' : 'orange'}>
                      {sale.paymentMode === 'CC' ? 'Cash & Carry' : 'Credit'}
                    </Badge>
                    <span className="text-xs text-slate-500 font-semibold">{sale.saleType}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary Footer */}
        {historySales.length > 0 && (
          <div className="shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  {historySales.length} transaction{historySales.length !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-slate-400">
                  {applied.from} → {applied.to}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Period Total</p>
                <p className="text-xl font-black text-blue-700">{formatCurrency(periodTotal)}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MySalesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CC' | 'CREDIT'>('ALL');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['my-sales'],
    queryFn: async () => {
      const res = await api.get('/sales/my-sales');
      return res.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sales/${id}`),
    onSuccess: () => {
      toast.success('Sale removed; the store owner can review the retained record');
      void queryClient.invalidateQueries({ queryKey: ['my-sales'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog-b'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Sale could not be deleted'),
  });

  // Today's sales total (all sales today regardless of status for this worker's view)
  const todayDate = todayStr();
  const stats = useMemo(() => {
    const totalCount = sales.length;
    let todayTotal = 0;
    let allTimeTotal = 0;
    let ccCount = 0;
    let creditCount = 0;

    sales.forEach((s: any) => {
      const amount = parseFloat(s.finalTotal || '0');
      allTimeTotal += amount;
      if (String(s.saleDate).startsWith(todayDate)) {
        todayTotal += amount;
      }
      if (s.paymentMode === 'CC') ccCount++;
      else if (s.paymentMode === 'CREDIT') creditCount++;
    });

    return { totalCount, todayTotal, allTimeTotal, ccCount, creditCount };
  }, [sales, todayDate]);

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((sale: any) => {
      const customerName = sale.customer?.name?.toLowerCase() || '';
      const saleId = String(sale.id);
      const matchesSearch =
        !search || customerName.includes(search.toLowerCase()) || saleId.includes(search);
      const matchesPayment = paymentFilter === 'ALL' || sale.paymentMode === paymentFilter;
      return matchesSearch && matchesPayment;
    });
  }, [sales, search, paymentFilter]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-blue-200 border border-white/10 mb-2">
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Sales Desk Log</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black">Sales History</h1>
            <p className="text-blue-100/80 text-xs sm:text-sm mt-0.5">
              Review and track customer transactions recorded from your desk
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Today's Sales — clickable */}
        <button
          onClick={() => setShowHistory(true)}
          className="bg-white p-4 rounded-2xl border border-blue-200 shadow-sm flex items-center gap-3 hover:border-blue-400 hover:shadow-md transition-all active:scale-95 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Sales</p>
            <p className="text-xl font-bold text-blue-700 truncate">{formatCurrency(stats.todayTotal)}</p>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span>Resets daily</span>
              <ChevronRight className="w-3 h-3" />
            </p>
          </div>
        </button>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Sales</p>
            <p className="text-xl font-bold text-slate-900">{stats.totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cash & Carry</p>
            <p className="text-xl font-bold text-slate-900">{stats.ccCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Credit Sales</p>
            <p className="text-xl font-bold text-slate-900">{stats.creditCount}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'ALL', label: 'All Transactions' },
              { id: 'CC', label: 'Cash & Carry' },
              { id: 'CREDIT', label: 'Credit Sales' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPaymentFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                  paymentFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer or sale #..."
              className="w-full pl-9 pr-3.5 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition"
            />
          </div>
        </div>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-2">
            <ClipboardList className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-sm font-medium">No sales recorded matching your filter.</p>
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="md:hidden p-3 space-y-3 bg-slate-50/50">
              {filteredSales.map((sale: any) => (
                <div
                  key={sale.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-700 text-xs px-2 py-0.5 bg-slate-100 rounded-lg">
                      Sale #{sale.id}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDateTime(sale.saleDate)}
                    </span>
                  </div>

                  <div className="flex items-start justify-between border-t border-slate-100 pt-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {sale.customer?.name?.charAt(0).toUpperCase() || 'C'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{sale.customer?.name || 'Walk-in'}</p>
                        <p className="text-[11px] text-slate-400">{sale.customer?.phone || 'Walk-in Customer'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Final Total</p>
                      <p className="font-black text-slate-900 text-base">
                        {formatCurrency(parseFloat(sale.finalTotal))}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-700 border border-slate-100 space-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>Items Purchased</span>
                    </div>
                    {sale.saleItems?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="font-medium text-slate-800">
                          {item.quantity}x {item.product?.name || `Product #${item.productId}`}
                        </span>
                        <span className="text-slate-500 font-mono">
                          {formatCurrency(parseFloat(item.subtotal))}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant={sale.paymentMode === 'CC' ? 'green' : 'orange'}>
                        {sale.paymentMode === 'CC' ? 'Cash & Carry' : 'Credit'}
                      </Badge>
                      <span className="text-slate-600 font-bold px-2 py-0.5 bg-slate-100 rounded text-[11px]">
                        {sale.saleType}
                      </span>
                    </div>

                    <button
                      type="button"
                      title="Delete this sale entry"
                      disabled={deleteMutation.isPending}
                      onClick={() => setDeleteTarget(sale)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl disabled:opacity-50 flex items-center gap-1 text-xs font-bold border border-red-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Sale #', 'Date & Time', 'Customer', 'Items Summary', 'Payment', 'Type', 'Total Amount', 'Action'].map(
                      (h) => (
                        <th key={h} className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.map((sale: any) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5 font-mono font-bold text-xs text-slate-700">#{sale.id}</td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{formatDateTime(sale.saleDate)}</td>
                      <td className="px-5 py-3.5 font-bold text-slate-900">{sale.customer?.name || 'Walk-in'}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 max-w-xs truncate">
                        {sale.saleItems
                          ?.map((i: any) => `${i.quantity}x ${i.product?.name || `Item #${i.productId}`}`)
                          .join(', ') || `${sale.saleItems?.length} item(s)`}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={sale.paymentMode === 'CC' ? 'green' : 'orange'}>
                          {sale.paymentMode === 'CC' ? 'Cash & Carry' : 'Credit'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {sale.saleType}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-extrabold text-slate-900">
                        {formatCurrency(parseFloat(sale.finalTotal))}
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeleteTarget(sale)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete sale"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        title="Delete Sale Entry"
        itemName={deleteTarget ? `Sale #${deleteTarget.id}` : undefined}
        message="Remove this sale? The store owner will retain and be able to review its details in the sales log."
        loading={deleteMutation.isPending}
      />

      {showHistory && <SalesHistoryDrawer onClose={() => setShowHistory(false)} />}
    </div>
  );
}
