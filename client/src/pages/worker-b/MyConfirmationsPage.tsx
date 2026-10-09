import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { formatDateTime } from '../../lib/utils';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

export default function MyConfirmationsPage() {
  const queryClient = useQueryClient();
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
      toast.success('Dispatch removed; the admin can review its retained details');
      void queryClient.invalidateQueries({ queryKey: ['my-confirmations'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog-b'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Dispatch could not be deleted'),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dispatch History</h1>
        <p className="text-slate-500 text-sm">Log of goods dispatched and issued to customers</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : sales.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No dispatch records found.</p>
          </div>
        ) : (
          <>
            {/* Mobile View: Cards */}
            <div className="md:hidden p-3 space-y-3 bg-slate-50/50">
              {sales.map((sale: any) => (
                <div key={sale.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-700 text-sm">Dispatch #{sale.id}</span>
                    <span className="text-xs text-slate-400">{formatDateTime(sale.saleDate)}</span>
                  </div>

                  <div className="border-t border-slate-100 pt-2">
                    <p className="font-bold text-slate-800 text-sm">{sale.customer?.name}</p>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-2 text-xs text-slate-600 border border-slate-100">
                    <span className="font-semibold text-slate-700 block mb-0.5">Dispatched Items:</span>
                    <p className="line-clamp-2">
                      {sale.saleItems?.map((i: any) => `${i.quantity}x ${i.product?.name || `Item #${i.productId}`}`).join(', ') || `${sale.saleItems?.length} item(s)`}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700 font-semibold bg-slate-100 px-2 py-0.5 rounded text-xs">
                        {sale.paymentMode === 'CC' ? 'Cash & Carry' : 'Credit'}
                      </span>
                      <span className="text-slate-600 font-medium px-2 py-0.5 bg-slate-100 rounded text-xs">{sale.saleType}</span>
                    </div>

                    <button
                      type="button"
                      title="Delete this dispatch entry"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm('Remove this dispatch? The admin will retain and be able to review its details.')) {
                          deleteMutation.mutate(sale.id);
                        }
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50 flex items-center gap-1 text-xs font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {['Dispatch #', 'Date & Time', 'Customer', 'Items Dispatched', 'Payment Mode', 'Issue Type', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.map((sale: any) => (
                    <tr key={sale.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-semibold text-slate-600">#{sale.id}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(sale.saleDate)}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{sale.customer?.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {sale.saleItems?.map((i: any) =>
                          `${i.quantity}x ${i.product?.name || `Item #${i.productId}`}`
                        ).join(', ') || `${sale.saleItems?.length} item(s)`}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs font-medium">{sale.paymentMode === 'CC' ? 'Cash & Carry' : 'Credit'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs font-medium">{sale.saleType}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          title="Delete this dispatch entry"
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (window.confirm('Remove this dispatch? The admin will retain and be able to review its details.')) {
                              deleteMutation.mutate(sale.id);
                            }
                          }}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
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
