import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Search, AlertTriangle, Eye, Pencil, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, formatDate } from '../../lib/utils';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import CustomerDetailModal from '../../components/admin/CustomerDetailModal';
import AddCustomerModal from '../../components/admin/AddCustomerModal';
import toast from 'react-hot-toast';

export default function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editCustomer, setEditCustomer] = useState<any>(null);

  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ['customers', search],
    queryFn: async () => {
      const res = await api.get('/customers', { params: search ? { search } : {} });
      return res.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/customers/${id}`),
    onSuccess: () => {
      toast.success('Customer deleted');
      void qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to delete customer'),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
          <p className="text-slate-500 text-sm">Manage your customer database</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
          <UserPlus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : customers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">No customers found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Customer Name', 'Phone', 'Type', 'Confirmed Debt', 'Flagged Credit Exposure', 'Joined', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c: any) => {
                  const debt = parseFloat(c.totalDebt ?? c.totalOutstandingDebt ?? '0');
                  const pendingDebt = parseFloat(c.pendingDebt ?? '0');
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomer(c)}
                      className="hover:bg-slate-50 transition cursor-pointer"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">{c.name}</td>
                      <td className="px-4 py-3 text-slate-600">{c.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={c.customerType === 'REGISTERED' ? 'blue' : 'gray'}>
                          {c.customerType}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {debt > 0 ? (
                          <span className="flex items-center gap-1 text-red-600 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {formatCurrency(debt)}
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium text-xs">No Confirmed Debt</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {pendingDebt > 0 ? (
                          <span className="inline-flex items-center gap-1 text-orange-800 bg-orange-50 border border-orange-300 px-2 py-0.5 rounded text-xs font-semibold">
                            <AlertTriangle className="w-3 h-3" />
                            {formatCurrency(pendingDebt)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(c.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            title="View customer"
                            onClick={(e) => { e.stopPropagation(); setSelectedCustomer(c); }}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            title="Edit customer"
                            onClick={(e) => { e.stopPropagation(); setEditCustomer(c); }}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            title="Delete customer (only if there is no history)"
                            disabled={deleteMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete ${c.name}? Customers with sales or debt history cannot be deleted.`)) {
                                deleteMutation.mutate(c.id);
                              }
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedCustomer && (
        <CustomerDetailModal customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
      {showAdd && <AddCustomerModal onClose={() => { setShowAdd(false); refetch(); }} />}
      {editCustomer && <AddCustomerModal customer={editCustomer} onClose={() => { setEditCustomer(null); refetch(); }} />}
    </div>
  );
}
