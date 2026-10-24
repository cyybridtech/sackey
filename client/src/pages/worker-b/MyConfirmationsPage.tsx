import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Trash2,
  Pencil,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  CreditCard,
  Tag,
  X,
  Calendar,
  ChevronRight,
  Save,
} from 'lucide-react';
import api from '../../api/axios';
import { formatDateTime } from '../../lib/utils';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import DeleteConfirmModal from '../../components/ui/DeleteConfirmModal';
import toast from 'react-hot-toast';

const todayStr = () => new Date().toISOString().split('T')[0];
const nDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

function EditDispatchModal({
  sale,
  onClose,
  onSaved,
}: {
  sale: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saleDate, setSaleDate] = useState(
    sale.saleDate ? new Date(sale.saleDate).toISOString().slice(0, 16) : '',
  );
  const [paymentMode, setPaymentMode] = useState(sale.paymentMode || 'CC');
  const [saleType, setSaleType] = useState(sale.saleType || 'WHOLESALE');
  const [notes, setNotes] = useState(sale.notes || '');
  const [dispatchItems, setDispatchItems] = useState(
    (sale.workerBData?.items || sale.saleItems || []).map((item: any) => ({
      productId: item.productId,
      name: item.product?.name || `Product #${item.productId}`,
      quantity: String(item.quantity ?? 1),
    })),
  );

  const updateMutation = useMutation({
    mutationFn: () =>
      api.put(`/sales/${sale.id}`, {
        saleDate: saleDate ? new Date(saleDate).toISOString() : sale.saleDate,
        paymentMode,
        saleType,
        notes,
        dispatchItems: dispatchItems.map((item: any) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity),
        })),
      }),
    onSuccess: () => {
      toast.success('Dispatch updated successfully');
      onSaved();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Dispatch could not be updated');
    },
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-900 to-indigo-900 px-5 py-4 text-white">
          <div>
            <h2 className="text-base font-bold">Edit Dispatch #{sale.id}</h2>
            <p className="text-xs text-blue-200">Correct the recorded dispatch information</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl bg-white/10 p-2 hover:bg-white/20" aria-label="Close edit dispatch dialog">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            updateMutation.mutate();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Sale date and time</span>
            <input
              type="datetime-local"
              value={saleDate}
              onChange={(event) => setSaleDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Payment</span>
              <select
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="CC">Cash &amp; Carry</option>
                <option value="CREDIT">Credit</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Sale type</span>
              <select
                value={saleType}
                onChange={(event) => setSaleType(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="WHOLESALE">Wholesale</option>
                <option value="RETAIL">Retail</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-600">Notes</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Dispatched quantities</p>
            <div className="space-y-2">
              {dispatchItems.map((item: any, index: number) => (
                <label key={item.productId} className="flex items-center justify-between gap-3 text-xs font-medium text-slate-700">
                  <span className="min-w-0 truncate">{item.name}</span>
                  <input
                    required
                    min="1"
                    step="1"
                    type="number"
                    value={item.quantity}
                    onChange={(event) => setDispatchItems((current: any[]) => current.map((entry, i) => i === index ? { ...entry, quantity: event.target.value } : entry))}
                    className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={updateMutation.isPending} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── History Drawer ─────────────────────────────────────────────────────────

function DispatchHistoryDrawer({ onClose, onEdit }: { onClose: () => void; onEdit: (sale: any) => void }) {
  const [dateFrom, setDateFrom] = useState(nDaysAgo(30));
  const [dateTo, setDateTo] = useState(todayStr());
  const [applied, setApplied] = useState({ from: nDaysAgo(30), to: todayStr() });

  const { data: historyDispatches = [], isFetching } = useQuery({
    queryKey: ['my-dispatch-history', applied.from, applied.to],
    queryFn: async () => {
      const res = await api.get('/sales/my-sales', {
        params: { dateFrom: applied.from, dateTo: applied.to },
      });
      return res.data.data;
    },
  });

  const periodUnits = useMemo(
    () =>
      historyDispatches.reduce(
        (s: number, d: any) =>
          s + (d.saleItems?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0),
        0
      ),
    [historyDispatches]
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0 bg-gradient-to-r from-slate-900 to-indigo-900 text-white">
          <div>
            <h2 className="text-base font-bold">Dispatch History</h2>
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
          ) : historyDispatches.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <Calendar className="w-12 h-12 mx-auto text-slate-300" />
              <p className="text-sm font-medium">No dispatches in this period.</p>
            </div>
          ) : (
            <div className="p-4 space-y-2.5">
              {historyDispatches.map((sale: any) => (
                <div
                  key={sale.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg">
                      Dispatch #{sale.id}
                    </span>
                    <span className="text-xs text-slate-400">{formatDateTime(sale.saleDate)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">
                      {sale.customer?.name || 'Walk-in Customer'}
                    </span>
                    <span className="text-xs font-bold text-slate-600">
                      {sale.saleItems?.reduce((s: number, i: any) => s + i.quantity, 0)} pcs
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {sale.saleItems?.map((i: any, idx: number) => (
                      <span key={idx}>
                        {idx > 0 && ', '}
                        {i.quantity}x {i.product?.name || `#${i.productId}`}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={sale.paymentMode === 'CC' ? 'green' : 'orange'}>
                      {sale.paymentMode === 'CC' ? 'Cash & Carry' : 'Credit'}
                    </Badge>
                    <span className="text-xs text-slate-500 font-semibold">{sale.saleType}</span>
                    {sale.adminVerified ? (
                      <span className="ml-auto rounded-lg bg-green-100 px-2 py-1 text-xs font-bold text-green-700">Verified</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEdit(sale)}
                        className="ml-auto flex items-center gap-1 rounded-lg border border-indigo-100 px-2 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary Footer */}
        {historyDispatches.length > 0 && (
          <div className="shrink-0 border-t border-slate-200 px-5 py-4 bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
                  {historyDispatches.length} dispatch{historyDispatches.length !== 1 ? 'es' : ''}
                </p>
                <p className="text-xs text-slate-400">
                  {applied.from} → {applied.to}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Total Units</p>
                <p className="text-xl font-black text-indigo-700">{periodUnits} pcs</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MyConfirmationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CC' | 'CREDIT'>('ALL');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['my-confirmations'],
    queryFn: async () => {
      const res = await api.get('/sales/my-sales');
      return res.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sales/${id}`),
    onSuccess: () => {
      toast.success('Dispatch removed; the store owner can review the retained record');
      void queryClient.invalidateQueries({ queryKey: ['my-confirmations'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog-b'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Dispatch could not be deleted'),
  });

  const refreshAfterEdit = async () => {
    setEditTarget(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-confirmations'] }),
      queryClient.invalidateQueries({ queryKey: ['my-sales'] }),
      queryClient.invalidateQueries({ queryKey: ['my-dispatch-history'] }),
      queryClient.invalidateQueries({ queryKey: ['products-catalog'] }),
      queryClient.invalidateQueries({ queryKey: ['products-catalog-b'] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] }),
    ]);
  };

  const todayDate = todayStr();

  const stats = useMemo(() => {
    const totalCount = sales.length;
    let todayUnits = 0;
    let allUnits = 0;
    let ccCount = 0;
    let creditCount = 0;

    sales.forEach((s: any) => {
      const units = s.saleItems?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
      allUnits += units;
      if (String(s.saleDate).startsWith(todayDate)) {
        todayUnits += units;
      }
      if (s.paymentMode === 'CC') ccCount++;
      else if (s.paymentMode === 'CREDIT') creditCount++;
    });

    return { totalCount, todayUnits, allUnits, ccCount, creditCount };
  }, [sales, todayDate]);

  const filteredDispatches = useMemo(() => {
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
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-blue-200 border border-white/10 mb-2">
              <Package className="w-3.5 h-3.5" />
              <span>Warehouse Dispatch History</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black">Dispatch Log</h1>
            <p className="text-blue-100/80 text-xs sm:text-sm mt-0.5">
              Track goods confirmed and issued from the warehouse
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Today's Units — clickable */}
        <button
          onClick={() => setShowHistory(true)}
          className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-sm flex items-center gap-3 hover:border-indigo-400 hover:shadow-md transition-all active:scale-95 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Units</p>
            <p className="text-xl font-bold text-indigo-700">{stats.todayUnits} <span className="text-xs font-semibold text-slate-500">pcs</span></p>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span>Resets daily</span>
              <ChevronRight className="w-3 h-3" />
            </p>
          </div>
        </button>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Dispatches</p>
            <p className="text-xl font-bold text-slate-900">{stats.totalCount}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Units Issued</p>
            <p className="text-xl font-bold text-slate-900">{stats.allUnits} pcs</p>
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
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm space-y-3">
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {[
              { id: 'ALL', label: 'All Dispatches' },
              { id: 'CC', label: 'Cash & Carry' },
              { id: 'CREDIT', label: 'Credit' },
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
              placeholder="Search by customer or dispatch #..."
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
        ) : filteredDispatches.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-2">
            <Package className="w-12 h-12 mx-auto text-slate-300" />
            <p className="text-sm font-medium">No dispatch records found matching your filter.</p>
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="md:hidden p-3 space-y-3 bg-slate-50/50">
              {filteredDispatches.map((sale: any) => (
                <div
                  key={sale.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-700 text-xs px-2 py-0.5 bg-slate-100 rounded-lg">
                      Dispatch #{sale.id}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDateTime(sale.saleDate)}
                    </span>
                  </div>

                  <div className="border-t border-slate-100 pt-2.5 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {sale.customer?.name?.charAt(0).toUpperCase() || 'C'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{sale.customer?.name || 'Walk-in'}</p>
                      <p className="text-[11px] text-slate-400">{sale.customer?.phone || 'Walk-in Customer'}</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-700 border border-slate-100 space-y-1.5">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>Issued Items</span>
                    </div>
                    {sale.saleItems?.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="font-medium text-slate-800">
                          {item.quantity} pcs {item.product?.name || `Product #${item.productId}`}
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
                    {sale.adminVerified ? (
                      <span className="rounded-lg bg-green-100 px-2 py-1 text-xs font-bold text-green-700">Verified</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title="Edit this dispatch entry"
                          onClick={() => setEditTarget(sale)}
                          className="flex items-center gap-1 rounded-xl border border-indigo-100 p-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          title="Delete this dispatch entry"
                          disabled={deleteMutation.isPending}
                          onClick={() => setDeleteTarget(sale)}
                          className="flex items-center gap-1 rounded-xl border border-red-100 p-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Dispatch #', 'Date & Time', 'Customer', 'Items Dispatched', 'Payment Mode', 'Type', 'Action'].map(
                      (h) => (
                        <th key={h} className="text-left px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDispatches.map((sale: any) => (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-5 py-3.5 font-mono font-bold text-xs text-slate-700">#{sale.id}</td>
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{formatDateTime(sale.saleDate)}</td>
                      <td className="px-5 py-3.5 font-bold text-slate-900">{sale.customer?.name || 'Walk-in'}</td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 max-w-xs truncate">
                        {sale.saleItems
                          ?.map((i: any) => `${i.quantity} pcs ${i.product?.name || `Item #${i.productId}`}`)
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
                      <td className="px-5 py-3.5">
                        {sale.adminVerified ? (
                          <span className="rounded-lg bg-green-100 px-2 py-1 text-xs font-bold text-green-700">Verified</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditTarget(sale)}
                              className="rounded-lg p-1.5 text-indigo-600 transition hover:bg-indigo-50"
                              title="Edit dispatch"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={deleteMutation.isPending}
                              onClick={() => setDeleteTarget(sale)}
                              className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"
                              title="Delete dispatch"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
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
        title="Delete Dispatch Entry"
        itemName={deleteTarget ? `Dispatch #${deleteTarget.id}` : undefined}
        message="Remove this dispatch? The store owner will retain and be able to review its details in the dispatch log."
        loading={deleteMutation.isPending}
      />

      {showHistory && (
        <DispatchHistoryDrawer
          onClose={() => setShowHistory(false)}
          onEdit={setEditTarget}
        />
      )}
      {editTarget && (
        <EditDispatchModal
          sale={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={refreshAfterEdit}
        />
      )}
    </div>
  );
}