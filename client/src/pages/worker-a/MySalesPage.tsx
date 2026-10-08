import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import Spinner from '../../components/ui/Spinner';
import Badge from '../../components/ui/Badge';
import toast from 'react-hot-toast';

export default function MySalesPage() {
  const queryClient = useQueryClient();
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
      toast.success('Sale removed; the admin can review its retained details');
      void queryClient.invalidateQueries({ queryKey: ['my-sales'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog-b'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (error: any) => toast.error(error.response?.data?.error || 'Sale could not be deleted'),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Sales History</h1>
        <p className="text-slate-500 text-sm">Log of sales transactions recorded at your desk</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : sales.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No sales recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Invoice #', 'Date & Time', 'Customer', 'Items Summary', 'Total Amount', 'Payment Mode', 'Sale Type', ''].map(h => (
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
                        `${i.quantity}x ${i.product?.name}${i.size ? ` (${i.size})` : ''}${i.colour ? ` ${i.colour}` : ''}`
                      ).join(', ') || `${sale.saleItems?.length} item(s)`}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{formatCurrency(parseFloat(sale.finalTotal))}</td>
                    <td className="px-4 py-3">
                      <Badge variant={sale.paymentMode === 'CC' ? 'green' : 'orange'}>
                        {sale.paymentMode === 'CC' ? 'Cash & Carry' : 'Credit'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs font-medium">{sale.saleType}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        title="Delete this sale entry"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm('Remove this sale? The admin will retain and be able to review its details.')) {
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
        )}
      </div>
    </div>
  );
}
