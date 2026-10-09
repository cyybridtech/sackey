import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, DollarSign, Filter, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import toast from 'react-hot-toast';

function PaymentModal({ credit, onClose }: { credit: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/customers/${credit.customerId}/payment`, {
        creditLedgerId: credit.id,
        amountPaid: parseFloat(amount),
        notes,
      });
      toast.success('Payment recorded successfully');
      qc.invalidateQueries({ queryKey: ['credits'] });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Record Payment" onClose={onClose}>
      <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm space-y-1">
        <p><span className="text-slate-500">Customer:</span> <strong>{credit.customer?.name}</strong></p>
        <p><span className="text-slate-500">Total Owed:</span> <strong className="text-red-600">{formatCurrency(parseFloat(credit.balance))}</strong></p>
      </div>
      <form onSubmit={handlePay} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Amount Paid (GH₵) *</label>
          <input required type="number" step="0.01" min="0.01" max={credit.balance}
            value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function CreditsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedCredit, setSelectedCredit] = useState<any>(null);
  const [payCredit, setPayCredit] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['credits', statusFilter],
    queryFn: async () => {
      const res = await api.get('/credits', { params: statusFilter ? { status: statusFilter } : {} });
      return res.data.data;
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['credits-summary'],
    queryFn: async () => {
      const res = await api.get('/credits/summary');
      return res.data.data;
    },
  });

  const { data: flaggedSales = [] } = useQuery({
    queryKey: ['credits-flagged-sales'],
    queryFn: async () => {
      const res = await api.get('/sales', { params: { paymentMode: 'CREDIT', status: 'FLAGGED' } });
      return res.data.data;
    },
  });

  const credits = data || [];
  const STATUS_VARIANT: Record<string, any> = { OUTSTANDING: 'red', PARTIAL: 'orange', PAID: 'green' };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Credit & Debt</h1>
        <p className="text-slate-500 text-sm">Track all outstanding credits and payments</p>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-600 mb-1"><CreditCard className="w-4 h-4" /><span className="text-xs font-medium">Total Outstanding</span></div>
            <p className="text-lg sm:text-xl xl:text-2xl font-bold text-red-700 break-words tracking-tight leading-snug">{formatCurrency(summary.totalOutstandingDebt)}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-orange-600 mb-1"><DollarSign className="w-4 h-4" /><span className="text-xs font-medium">Customers in Debt</span></div>
            <p className="text-lg sm:text-xl xl:text-2xl font-bold text-orange-700 break-words tracking-tight leading-snug">{summary.customersWithDebt}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-green-600 mb-1"><DollarSign className="w-4 h-4" /><span className="text-xs font-medium">Total Collected</span></div>
            <p className="text-lg sm:text-xl xl:text-2xl font-bold text-green-700 break-words tracking-tight leading-snug">{formatCurrency(summary.totalCollected || 0)}</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Status</option>
          <option value="OUTSTANDING">Outstanding</option>
          <option value="PARTIAL">Partial</option>
          <option value="PAID">Paid</option>
        </select>
      </div>

      <section className="bg-orange-50 border border-orange-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-orange-200">
          <h2 className="font-semibold text-orange-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Flagged Credit Exposure ({flaggedSales.length})
          </h2>
          <p className="text-xs text-orange-800 mt-1">
            These credit sales are not posted to the debt ledger and cannot accept payments until both workers confirm them.
          </p>
        </div>
        {flaggedSales.length === 0 ? (
          <p className="p-4 text-sm text-orange-800">No flagged credit sales.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-orange-100/70">
                <tr>
                  {['Sale', 'Customer', 'Date', 'Exposure', 'Flag reason'].map((heading) => (
                    <th key={heading} className="text-left px-4 py-2 text-xs font-semibold text-orange-900 uppercase">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-100">
                {flaggedSales.map((sale: any) => (
                  <tr key={sale.id}>
                    <td className="px-4 py-3 font-mono">#{sale.id}</td>
                    <td className="px-4 py-3 font-medium">{sale.customer?.name}</td>
                    <td className="px-4 py-3">{formatDate(sale.saleDate)}</td>
                    <td className="px-4 py-3 font-bold text-orange-900">{formatCurrency(Number(sale.finalTotal))}</td>
                    <td className="px-4 py-3">
                      <Badge variant="orange">
                        {sale.workerAId && sale.workerBId
                          ? 'Worker entries mismatch'
                          : sale.workerAId
                            ? 'Awaiting Dispatch'
                            : 'Awaiting Sales Desk'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : credits.length === 0 ? (
          <div className="text-center py-16 text-slate-400">No credit records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Customer', 'Sale Date', 'Total Amount', 'Paid', 'Balance', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {credits.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {c.customer?.name}
                      <p className="text-xs text-slate-400">{c.customer?.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(c.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(parseFloat(c.totalAmount))}</td>
                    <td className="px-4 py-3 text-green-700">{formatCurrency(parseFloat(c.amountPaid))}</td>
                    <td className="px-4 py-3 font-bold text-red-700">{formatCurrency(parseFloat(c.balance))}</td>
                    <td className="px-4 py-3"><Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge></td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => setSelectedCredit(c)} className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50">View</button>
                      {c.status !== 'PAID' && (
                        <button onClick={() => setPayCredit(c)} className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700">Pay</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Credit Detail Modal */}
      {selectedCredit && (
        <Modal title={`Credit — ${selectedCredit.customer?.name}`} onClose={() => setSelectedCredit(null)}>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-slate-500">Total:</span> <strong>{formatCurrency(parseFloat(selectedCredit.totalAmount))}</strong></div>
              <div><span className="text-slate-500">Paid:</span> <strong className="text-green-700">{formatCurrency(parseFloat(selectedCredit.amountPaid))}</strong></div>
              <div><span className="text-slate-500">Balance:</span> <strong className="text-red-700">{formatCurrency(parseFloat(selectedCredit.balance))}</strong></div>
              <div><span className="text-slate-500">Status:</span> <Badge variant={STATUS_VARIANT[selectedCredit.status]}>{selectedCredit.status}</Badge></div>
            </div>
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Payment History</h4>
              {selectedCredit.payments?.length === 0 ? (
                <p className="text-slate-400 text-xs">No payments made yet.</p>
              ) : (
                <div className="space-y-2">
                  {selectedCredit.payments?.map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center py-2 border-b border-slate-100">
                      <div>
                        <p className="font-medium text-green-700">+{formatCurrency(parseFloat(p.amountPaid))}</p>
                        {p.notes && <p className="text-xs text-slate-400">{p.notes}</p>}
                      </div>
                      <p className="text-xs text-slate-400">{formatDateTime(p.paymentDate)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {payCredit && <PaymentModal credit={payCredit} onClose={() => setPayCredit(null)} />}
    </div>
  );
}
