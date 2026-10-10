import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  Layers,
  CreditCard,
  Tag,
} from 'lucide-react';
import api from '../../api/axios';
import { formatDateTime } from '../../lib/utils';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';

export default function MyConfirmationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'CC' | 'CREDIT'>('ALL');

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

  // Filtered dispatches
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

  // Summary Metrics
  const stats = useMemo(() => {
    const totalCount = sales.length;
    let totalUnits = 0;
    let ccCount = 0;
    let creditCount = 0;

    sales.forEach((s: any) => {
      s.saleItems?.forEach((item: any) => {
        totalUnits += item.quantity || 0;
      });
      if (s.paymentMode === 'CC') ccCount++;
      else if (s.paymentMode === 'CREDIT') creditCount++;
    });

    return { totalCount, totalUnits, ccCount, creditCount };
  }, [sales]);

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
            <p className="text-xl font-bold text-slate-900">{stats.totalUnits} pcs</p>
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
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Credit Dispatch</p>
            <p className="text-xl font-bold text-slate-900">{stats.creditCount}</p>
          </div>
        </div>
      </div>

      {/* Filter & Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Payment filter pills */}
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

          {/* Search Box */}
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
            {/* Mobile View: High Polish Cards */}
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
                      <p className="font-bold text-slate-900 text-sm">{sale.customer?.name}</p>
                      <p className="text-[11px] text-slate-400">{sale.customer?.phone || 'Walk-in Customer'}</p>
                    </div>
                  </div>

                  {/* Dispatched Items */}
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

                    <button
                      type="button"
                      title="Delete this dispatch entry"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Remove this dispatch? The store owner will retain and be able to review its details.'
                          )
                        ) {
                          deleteMutation.mutate(sale.id);
                        }
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-xl disabled:opacity-50 flex items-center gap-1 text-xs font-bold border border-red-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Clean Table */}
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
                      <td className="px-5 py-3.5 font-bold text-slate-900">{sale.customer?.name}</td>
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
                        <button
                          type="button"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                'Remove this dispatch? The store owner will retain and be able to review its details.'
                              )
                            ) {
                              deleteMutation.mutate(sale.id);
                            }
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete dispatch"
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
    </div>
  );
}
