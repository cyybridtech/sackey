import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import toast from 'react-hot-toast';
import { AlertTriangle, CreditCard, ShoppingBag, DollarSign } from 'lucide-react';

type Tab = 'overview' | 'purchases' | 'credits' | 'payments';

export default function CustomerDetailModal({ customer, onClose }: { customer: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [payForm, setPayForm] = useState<{ creditId: number; amount: string; notes: string } | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['customer-detail', customer.id],
    queryFn: async () => {
      const res = await api.get(`/customers/${customer.id}`);
      return res.data.data;
    },
  });

  const paymentMutation = useMutation({
    mutationFn: () =>
      api.post(`/customers/${customer.id}/payment`, {
        creditLedgerId: payForm!.creditId,
        amountPaid: parseFloat(payForm!.amount),
        notes: payForm!.notes,
      }),
    onSuccess: () => {
      toast.success('Payment recorded');
      setPayForm(null);
      qc.invalidateQueries({ queryKey: ['customer-detail', customer.id] });
      qc.invalidateQueries({ queryKey: ['credits'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { key: 'purchases', label: 'Purchases', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { key: 'credits', label: 'Credit/Debt', icon: <CreditCard className="w-3.5 h-3.5" /> },
    { key: 'payments', label: 'Payments', icon: <DollarSign className="w-3.5 h-3.5" /> },
  ];

  const confirmedDebt = parseFloat(profile?.confirmedDebt ?? profile?.totalDebt ?? '0');
  const pendingDebt = parseFloat(profile?.pendingCreditDebt ?? '0');
  const totalPotential = parseFloat(profile?.totalPotentialDebt ?? (confirmedDebt + pendingDebt));

  return (
    <Modal title={customer.name} onClose={onClose} size="xl">
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="space-y-4">
          {/* Header Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl">
            <div><p className="text-xs text-slate-400">Phone</p><p className="font-medium text-sm">{profile?.phone || '—'}</p></div>
            <div><p className="text-xs text-slate-400">Customer Type</p><Badge variant="blue">{profile?.customerType}</Badge></div>
            <div>
              <p className="text-xs text-slate-400">Confirmed Debt</p>
              <p className={`font-bold text-sm ${confirmedDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {confirmedDebt > 0 ? formatCurrency(confirmedDebt) : 'GH₵ 0.00'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Pending Credit Sales</p>
              <p className={`font-bold text-sm ${pendingDebt > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                {pendingDebt > 0 ? formatCurrency(pendingDebt) : 'GH₵ 0.00'}
              </p>
            </div>
          </div>

          {/* Pending Credit Warning Alert */}
          {pendingDebt > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <p className="font-bold">Flagged / Unconfirmed Credit Exposure: {formatCurrency(pendingDebt)}</p>
                <p className="mt-0.5 text-amber-800">
                  This customer was issued goods on credit that are currently awaiting dual-confirmation match. Total potential exposure: <strong>{formatCurrency(totalPotential)}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition flex items-center gap-1.5 ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Purchases', value: profile?.sales?.length || 0 },
                  { label: 'Cash & Carry', value: profile?.sales?.filter((s: any) => s.paymentMode === 'CC').length || 0 },
                  { label: 'On Credit', value: profile?.sales?.filter((s: any) => s.paymentMode === 'CREDIT').length || 0 },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
              {profile?.address && (
                <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Address:</span> {profile.address}
                </div>
              )}
              {profile?.notes && (
                <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                  <span className="font-semibold text-slate-700">Notes:</span> {profile.notes}
                </div>
              )}
            </div>
          )}

          {tab === 'purchases' && (
            <div className="overflow-y-auto max-h-72">
              {!profile?.sales?.length ? (
                <p className="text-slate-400 text-sm text-center py-8">No purchases yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b border-slate-200">
                    <tr>
                      {['Date', 'Items Summary', 'Total', 'Payment Mode', 'Status'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profile.sales.map((s: any) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500 text-xs">{formatDate(s.saleDate)}</td>
                        <td className="px-3 py-2">
                          <span className="font-medium text-slate-800">{s.saleItems?.length} item(s)</span>
                          <span className="block text-xs text-slate-400 truncate max-w-xs">
                            {s.saleItems?.map((i: any) =>
                              `${i.quantity}x ${i.product?.name || `Item #${i.productId}`}`
                            ).join(', ')}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{formatCurrency(parseFloat(s.finalTotal))}</td>
                        <td className="px-3 py-2">
                          <Badge variant={s.paymentMode === 'CC' ? 'green' : 'orange'}>
                            {s.paymentMode === 'CC' ? 'Cash & Carry' : 'Credit'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          <Badge variant={s.status === 'GREEN' ? 'green' : s.status === 'FLAGGED' ? 'orange' : 'blue'}>
                            {s.status === 'GREEN' ? 'Confirmed' : s.status === 'FLAGGED' ? 'Flagged' : 'Pending Match'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'credits' && (
            <div className="overflow-y-auto max-h-80 space-y-4">
              {/* Pending Credit Section */}
              {profile?.pendingCreditSales?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Pending / Unconfirmed Credit Sales ({profile.pendingCreditSales.length})
                  </h4>
                  {profile.pendingCreditSales.map((ps: any) => (
                    <div key={ps.id} className="border border-amber-200 bg-amber-50/50 rounded-xl p-3 text-xs space-y-1">
                      <div className="flex justify-between font-semibold text-amber-900">
                        <span>Sale #{ps.id} · {formatDate(ps.saleDate)}</span>
                        <span>Amount: {formatCurrency(parseFloat(ps.finalTotal))}</span>
                      </div>
                      <p className="text-slate-500">Items: {ps.saleItems?.map((i: any) =>
                        `${i.quantity}x ${i.product?.name || `Item #${i.productId}`}`
                      ).join(', ')}</p>
                      <div className="flex justify-between items-center text-[11px] text-amber-700 pt-1">
                        <span>
                          Status: {ps.status === 'FLAGGED'
                            ? ps.workerAId && ps.workerBId
                              ? '⚠ Worker entries mismatch'
                              : `⚠ Awaiting ${ps.workerAId ? 'Worker B' : 'Worker A'}`
                            : 'Awaiting second confirmation'}
                        </span>
                        <span>(Not yet finalized into credit ledger)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirmed Credit Ledger */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Confirmed Credit Ledger
                </h4>
                {!profile?.creditLedger?.length ? (
                  <p className="text-slate-400 text-xs text-center py-4">No confirmed credit ledgers.</p>
                ) : (
                  profile.creditLedger.map((cl: any) => (
                    <div key={cl.id} className="border border-slate-200 rounded-xl p-4 bg-white">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-xs text-slate-400">Sale #{cl.saleId} · {formatDate(cl.createdAt)}</p>
                          <p className="font-bold text-slate-800 text-sm">Invoice Amount: {formatCurrency(parseFloat(cl.totalAmount))}</p>
                        </div>
                        <Badge variant={cl.status === 'OUTSTANDING' ? 'red' : cl.status === 'PARTIAL' ? 'orange' : 'green'}>{cl.status}</Badge>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <div><p className="text-xs text-slate-400">Paid So Far</p><p className="text-green-700 font-semibold">{formatCurrency(parseFloat(cl.amountPaid))}</p></div>
                        <div><p className="text-xs text-slate-400">Remaining Balance</p><p className="text-red-700 font-bold">{formatCurrency(parseFloat(cl.balance))}</p></div>
                      </div>
                      {cl.status !== 'PAID' && (
                        <button onClick={() => setPayForm({ creditId: cl.id, amount: '', notes: '' })}
                          className="mt-3 w-full py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition shadow-sm">
                          Record Repayment
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'payments' && (
            <div className="overflow-y-auto max-h-72">
              {!profile?.allPayments?.length ? (
                <p className="text-slate-400 text-sm text-center py-8">No payment history.</p>
              ) : (
                <div className="space-y-2">
                  {profile.allPayments.map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center py-2 border-b border-slate-100">
                      <div>
                        <p className="text-sm font-semibold text-green-700">+{formatCurrency(parseFloat(p.amountPaid))}</p>
                        {p.notes && <p className="text-xs text-slate-400">{p.notes}</p>}
                      </div>
                      <p className="text-xs text-slate-400">{formatDateTime(p.paymentDate)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payment form inline */}
          {payForm && (
            <div className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-green-800 text-sm">Record Payment</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount (GH₵)</label>
                  <input type="number" step="0.01" min="0.01" value={payForm.amount}
                    onChange={(e) => setPayForm(f => f ? { ...f, amount: e.target.value } : f)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <input value={payForm.notes}
                    onChange={(e) => setPayForm(f => f ? { ...f, notes: e.target.value } : f)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPayForm(null)} className="flex-1 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={() => paymentMutation.mutate()} disabled={!payForm.amount || paymentMutation.isPending}
                  className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60">
                  {paymentMutation.isPending ? 'Saving...' : 'Save Payment'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
