import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, UserPlus, Eye, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, formatDate } from '../../lib/utils';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import AddCustomerModal from '../../components/admin/AddCustomerModal';

export default function WorkerACustomersPage() {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [viewCustomer, setViewCustomer] = useState<any>(null);

  const { data: customers = [], isLoading, refetch } = useQuery({
    queryKey: ['customers-worker', search],
    queryFn: async () => {
      const res = await api.get('/customers', { params: search ? { search } : {} });
      return res.data.data;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ['customer-profile', viewCustomer?.id],
    queryFn: async () => {
      const res = await api.get(`/customers/${viewCustomer.id}`);
      return res.data.data;
    },
    enabled: !!viewCustomer,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
          <p className="text-slate-500 text-sm">View and add customers</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <UserPlus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Name', 'Phone', 'Type', 'Debt', 'Joined', 'View'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c: any) => {
                const debt = parseFloat(c.totalDebt || '0');
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                    <td className="px-4 py-3 text-slate-500">{c.phone || '—'}</td>
                    <td className="px-4 py-3"><Badge variant="blue">{c.customerType}</Badge></td>
                    <td className="px-4 py-3">
                      {debt > 0 ? (
                        <span className="flex items-center gap-1 text-red-600 font-semibold text-xs">
                          <AlertTriangle className="w-3 h-3" />{formatCurrency(debt)}
                        </span>
                      ) : <span className="text-green-600 text-xs">No debt</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setViewCustomer(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Simple Customer View Modal */}
      {viewCustomer && (
        <Modal title={viewCustomer.name} onClose={() => setViewCustomer(null)}>
          {profile ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-slate-500">Phone:</span> {profile.phone || '—'}</div>
                <div><span className="text-slate-500">Email:</span> {profile.email || '—'}</div>
                <div><span className="text-slate-500">Type:</span> {profile.customerType}</div>
                <div><span className="text-slate-500">Total Debt:</span> <strong className={parseFloat(profile.totalDebt || 0) > 0 ? 'text-red-600' : 'text-green-600'}>{formatCurrency(parseFloat(profile.totalDebt || 0))}</strong></div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-700 mb-2">Recent Purchases</h4>
                {profile.sales?.length === 0 ? <p className="text-slate-400 text-xs">No purchases yet.</p> : (
                  <div className="space-y-2">
                    {profile.sales?.slice(0, 5).map((s: any) => (
                      <div key={s.id} className="flex justify-between items-center py-1.5 border-b border-slate-100">
                        <span>{formatDate(s.saleDate)}</span>
                        <span className="font-semibold">{formatCurrency(parseFloat(s.finalTotal))}</span>
                        <Badge variant={s.paymentMode === 'CC' ? 'green' : 'orange'}>{s.paymentMode}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : <Spinner />}
        </Modal>
      )}

      {showAdd && <AddCustomerModal onClose={() => { setShowAdd(false); refetch(); }} />}
    </div>
  );
}
