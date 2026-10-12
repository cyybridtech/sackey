import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import toast from 'react-hot-toast';
import {
  AlertTriangle,
  CreditCard,
  ShoppingBag,
  DollarSign,
  BookOpen,
  TrendingDown,
  Wallet,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type Tab = 'overview' | 'purchases' | 'credits' | 'payments';

export default function CustomerDetailModal({
  customer,
  onClose,
}: {
  customer: any;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [payForm, setPayForm] = useState<{ creditId: number; amount: string; notes: string } | null>(null);
  const [showBookDebtForm, setShowBookDebtForm] = useState(false);
  const [bookDebtAmount, setBookDebtAmount] = useState('');
  const [bookDebtNotes, setBookDebtNotes] = useState('');
  const [expandedLedger, setExpandedLedger] = useState<number | null>(null);

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
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const openingDebtMutation = useMutation({
    mutationFn: () =>
      api.post(`/customers/${customer.id}/opening-debt`, {
        amount: parseFloat(bookDebtAmount),
        notes: bookDebtNotes.trim() || undefined,
      }),
    onSuccess: (res: any) => {
      toast.success(res.data?.message || 'Paper book debt recorded successfully');
      setShowBookDebtForm(false);
      setBookDebtAmount('');
      setBookDebtNotes('');
      qc.invalidateQueries({ queryKey: ['customer-detail', customer.id] });
      qc.invalidateQueries({ queryKey: ['credits'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record paper book debt'),
  });

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { key: 'purchases', label: 'Purchases', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
    { key: 'credits', label: 'Credit / Debt', icon: <CreditCard className="w-3.5 h-3.5" /> },
    { key: 'payments', label: 'Payments', icon: <DollarSign className="w-3.5 h-3.5" /> },
  ];

  /* ── Derived totals ─────────────────────────────────────────────── */
  const confirmedDebt = parseFloat(String(profile?.confirmedDebt ?? profile?.totalDebt ?? 0));
  const pendingDebt = parseFloat(String(profile?.pendingCreditDebt ?? 0));
  const advanceBalance = parseFloat(String(profile?.advanceBalance ?? 0));
  const totalPotential = parseFloat(String(profile?.totalPotentialDebt ?? confirmedDebt + pendingDebt));

  // Split ledger into BBF vs sale entries for display
  const bbfEntries: any[] = (profile?.creditLedger ?? []).filter((cl: any) => !cl.saleId);
  const saleEntries: any[] = (profile?.creditLedger ?? []).filter((cl: any) => !!cl.saleId);

  const bbfTotal = bbfEntries.reduce((s: number, e: any) => s + parseFloat(String(e.balance)), 0);
  const saleDebtTotal = saleEntries
    .filter((e: any) => e.status !== 'PAID')
    .reduce((s: number, e: any) => s + parseFloat(String(e.balance)), 0);

  return (
    <Modal title={customer.name} onClose={onClose} size="xl">
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="space-y-4">

          {/* ── Balance Summary Banner ─────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

            {/* Outstanding Balance (confirmed) */}
            <div className={`rounded-xl p-3.5 border ${confirmedDebt > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className={`w-3.5 h-3.5 ${confirmedDebt > 0 ? 'text-red-500' : 'text-green-500'}`} />
                <p className={`text-[10px] font-bold uppercase tracking-wide ${confirmedDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  Outstanding Balance
                </p>
              </div>
              <p className={`font-extrabold text-base leading-tight ${confirmedDebt > 0 ? 'text-red-700' : 'text-green-700'}`}>
                {formatCurrency(confirmedDebt)}
              </p>
              {confirmedDebt > 0 && bbfTotal > 0 && (
                <p className="text-[10px] text-red-500 mt-0.5">
                  incl. BBF {formatCurrency(bbfTotal)}
                </p>
              )}
            </div>

            {/* Advance / Credit Balance */}
            <div className={`rounded-xl p-3.5 border ${advanceBalance > 0 ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet className={`w-3.5 h-3.5 ${advanceBalance > 0 ? 'text-blue-500' : 'text-slate-400'}`} />
                <p className={`text-[10px] font-bold uppercase tracking-wide ${advanceBalance > 0 ? 'text-blue-600' : 'text-slate-500'}`}>
                  Advance Balance
                </p>
              </div>
              <p className={`font-extrabold text-base leading-tight ${advanceBalance > 0 ? 'text-blue-700' : 'text-slate-400'}`}>
                {formatCurrency(advanceBalance)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Available credit</p>
            </div>

            {/* Pending Credit Exposure */}
            <div className={`rounded-xl p-3.5 border ${pendingDebt > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className={`w-3.5 h-3.5 ${pendingDebt > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
                <p className={`text-[10px] font-bold uppercase tracking-wide ${pendingDebt > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                  Unconfirmed Credit
                </p>
              </div>
              <p className={`font-extrabold text-base leading-tight ${pendingDebt > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                {pendingDebt > 0 ? formatCurrency(pendingDebt) : '—'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Awaiting confirmation</p>
            </div>

            {/* Customer Type */}
            <div className="rounded-xl p-3.5 border bg-slate-50 border-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">Customer Info</p>
              <p className="font-semibold text-slate-800 text-sm">{profile?.phone || '—'}</p>
              <Badge variant={profile?.customerType === 'REGISTERED' ? 'blue' : 'gray'} >
                {profile?.customerType}
              </Badge>
            </div>
          </div>

          {/* ── Unconfirmed Credit Warning ─────────────────────────── */}
          {pendingDebt > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                <p className="font-bold">
                  Unconfirmed Credit Exposure: {formatCurrency(pendingDebt)}
                </p>
                <p className="mt-0.5 text-amber-800">
                  Goods were issued on credit but are still awaiting dual-confirmation.{' '}
                  Total potential exposure: <strong>{formatCurrency(totalPotential)}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* ── Tabs ─────────────────────────────────────────────────── */}
          <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                  tab === t.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Overview Tab ─────────────────────────────────────────── */}
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

              {/* Debt Breakdown at-a-glance */}
              {(confirmedDebt > 0 || bbfTotal > 0) && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Debt Breakdown</p>

                  {bbfTotal > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <BookOpen className="w-3.5 h-3.5 text-orange-500" />
                        Balance Brought Forward (BBF)
                      </span>
                      <span className="font-bold text-orange-700">{formatCurrency(bbfTotal)}</span>
                    </div>
                  )}

                  {saleDebtTotal > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <CreditCard className="w-3.5 h-3.5 text-red-500" />
                        Credit Sale Debt
                      </span>
                      <span className="font-bold text-red-700">{formatCurrency(saleDebtTotal)}</span>
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-800">Total Outstanding</span>
                    <span className="font-extrabold text-red-700 text-base">{formatCurrency(confirmedDebt)}</span>
                  </div>

                  {advanceBalance > 0 && (
                    <div className="flex justify-between items-center text-sm bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
                      <span className="flex items-center gap-1.5 text-blue-700">
                        <Wallet className="w-3.5 h-3.5" />
                        Advance / Credit Balance
                      </span>
                      <span className="font-bold text-blue-700">{formatCurrency(advanceBalance)}</span>
                    </div>
                  )}
                </div>
              )}

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

          {/* ── Purchases Tab ────────────────────────────────────────── */}
          {tab === 'purchases' && (
            <div className="overflow-y-auto max-h-72">
              {!profile?.sales?.length ? (
                <p className="text-slate-400 text-sm text-center py-8">No purchases yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b border-slate-200">
                    <tr>
                      {['Date', 'Items Summary', 'Total', 'Payment Mode', 'Status'].map((h) => (
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

          {/* ── Credit / Debt Tab ────────────────────────────────────── */}
          {tab === 'credits' && (
            <div className="overflow-y-auto max-h-[420px] space-y-5 pr-1">

              {/* Pending/Unconfirmed section */}
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
                        <span>{formatCurrency(parseFloat(ps.finalTotal))}</span>
                      </div>
                      <p className="text-slate-500">
                        Items: {ps.saleItems?.map((i: any) =>
                          `${i.quantity}x ${i.product?.name || `Item #${i.productId}`}`
                        ).join(', ')}
                      </p>
                      <div className="flex justify-between items-center text-[11px] text-amber-700 pt-1">
                        <span>
                          {ps.status === 'FLAGGED'
                            ? ps.workerAId && ps.workerBId
                              ? '⚠ Worker entries mismatch'
                              : `⚠ Awaiting ${ps.workerAId ? 'Worker B' : 'Worker A'}`
                            : 'Awaiting second confirmation'}
                        </span>
                        <span className="italic">(Not yet in credit ledger)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Balance Brought Forward (BBF) Section ───────────── */}
              {bbfEntries.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-orange-700 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Balance Brought Forward — BBF ({bbfEntries.length})
                    </h4>
                    <span className="text-xs font-bold text-orange-800 bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-full">
                      {formatCurrency(bbfTotal)} outstanding
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 italic">
                    Historical balances migrated from paper records (pre-system).
                  </p>
                  {bbfEntries.map((cl: any) => (
                    <div key={cl.id} className="border border-orange-200 bg-orange-50/40 rounded-xl overflow-hidden">
                      {/* Header row */}
                      <button
                        type="button"
                        onClick={() => setExpandedLedger(expandedLedger === cl.id ? null : cl.id)}
                        className="w-full flex items-center justify-between p-3.5 hover:bg-orange-50 transition text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <BookOpen className="w-4 h-4 text-orange-500 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-orange-900">📖 Paper Book — BBF</p>
                            <p className="text-[11px] text-slate-500">{formatDate(cl.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Remaining</p>
                            <p className={`text-sm font-extrabold ${parseFloat(cl.balance) > 0 ? 'text-red-700' : 'text-green-700'}`}>
                              {formatCurrency(parseFloat(cl.balance))}
                            </p>
                          </div>
                          <Badge variant={cl.status === 'OUTSTANDING' ? 'red' : cl.status === 'PARTIAL' ? 'orange' : 'green'}>
                            {cl.status}
                          </Badge>
                          {expandedLedger === cl.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {expandedLedger === cl.id && (
                        <div className="border-t border-orange-200 bg-white p-3.5 space-y-3">
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-slate-50 rounded-lg p-2">
                              <p className="text-[10px] text-slate-400 uppercase font-semibold">Opening Debt</p>
                              <p className="text-sm font-bold text-slate-700">{formatCurrency(parseFloat(cl.totalAmount))}</p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-2">
                              <p className="text-[10px] text-slate-400 uppercase font-semibold">Paid So Far</p>
                              <p className="text-sm font-bold text-green-700">{formatCurrency(parseFloat(cl.amountPaid))}</p>
                            </div>
                            <div className={`rounded-lg p-2 ${parseFloat(cl.balance) > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                              <p className="text-[10px] text-slate-400 uppercase font-semibold">Balance</p>
                              <p className={`text-sm font-bold ${parseFloat(cl.balance) > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                {formatCurrency(parseFloat(cl.balance))}
                              </p>
                            </div>
                          </div>
                          {cl.notes && (
                            <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                              <span className="font-semibold text-slate-700">Reference: </span>{cl.notes}
                            </p>
                          )}
                          {cl.status !== 'PAID' && (
                            <button
                              onClick={() => setPayForm({ creditId: cl.id, amount: '', notes: '' })}
                              className="w-full py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition"
                            >
                              Record Repayment for this BBF
                            </button>
                          )}
                          {cl.status === 'PAID' && (
                            <div className="flex items-center justify-center gap-1.5 text-green-700 text-xs font-semibold py-1">
                              <CheckCircle2 className="w-4 h-4" /> Fully Paid
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Credit Sale Ledger Section ───────────────────────── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    Credit Sale Ledger ({saleEntries.length})
                  </h4>
                  <div className="flex items-center gap-2">
                    {saleDebtTotal > 0 && (
                      <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                        {formatCurrency(saleDebtTotal)} owed
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowBookDebtForm(!showBookDebtForm)}
                      className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg transition"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>+ BBF</span>
                    </button>
                  </div>
                </div>

                {/* Inline Record Book Debt Form */}
                {showBookDebtForm && (
                  <div className="border border-red-200 bg-red-50/70 rounded-xl p-4 space-y-3">
                    <h5 className="font-bold text-red-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-red-700" />
                      Add Balance Brought Forward (BBF) from Paper Book
                    </h5>
                    <p className="text-xs text-red-800 leading-relaxed">
                      Migrate opening or historical debt balances written in previous record books into this customer's account.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Debt Amount (GH₵) *</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          placeholder="e.g. 1500.00"
                          value={bookDebtAmount}
                          onChange={(e) => setBookDebtAmount(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Notes / Book Reference</label>
                        <input
                          type="text"
                          placeholder="e.g. Old Green Book page 42"
                          value={bookDebtNotes}
                          onChange={(e) => setBookDebtNotes(e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setShowBookDebtForm(false)}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={openingDebtMutation.isPending || !bookDebtAmount || parseFloat(bookDebtAmount) <= 0}
                        onClick={() => openingDebtMutation.mutate()}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                      >
                        {openingDebtMutation.isPending ? 'Saving...' : 'Record BBF Debt'}
                      </button>
                    </div>
                  </div>
                )}

                {saleEntries.length === 0 ? (
                  <p className="text-slate-400 text-xs text-center py-4">No credit sale ledger entries.</p>
                ) : (
                  saleEntries.map((cl: any) => (
                    <div key={cl.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      {/* Header row (always visible) */}
                      <button
                        type="button"
                        onClick={() => setExpandedLedger(expandedLedger === cl.id ? null : cl.id)}
                        className="w-full flex items-center justify-between p-3.5 hover:bg-slate-50 transition text-left"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-800">Sale #{cl.saleId} · {formatDate(cl.createdAt)}</p>
                          <p className="text-[11px] text-slate-400">Invoice: {formatCurrency(parseFloat(cl.totalAmount))}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Balance</p>
                            <p className={`text-sm font-extrabold ${parseFloat(cl.balance) > 0 ? 'text-red-700' : 'text-green-700'}`}>
                              {formatCurrency(parseFloat(cl.balance))}
                            </p>
                          </div>
                          <Badge variant={cl.status === 'OUTSTANDING' ? 'red' : cl.status === 'PARTIAL' ? 'orange' : 'green'}>
                            {cl.status}
                          </Badge>
                          {expandedLedger === cl.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </button>

                      {/* Expanded breakdown */}
                      {expandedLedger === cl.id && (
                        <div className="border-t border-slate-100 bg-slate-50/50 p-3.5 space-y-3">
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-white rounded-lg p-2 border border-slate-100">
                              <p className="text-[10px] text-slate-400 uppercase font-semibold">Invoice</p>
                              <p className="text-sm font-bold text-slate-700">{formatCurrency(parseFloat(cl.totalAmount))}</p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                              <p className="text-[10px] text-slate-400 uppercase font-semibold">Paid</p>
                              <p className="text-sm font-bold text-green-700">{formatCurrency(parseFloat(cl.amountPaid))}</p>
                            </div>
                            <div className={`rounded-lg p-2 border ${parseFloat(cl.balance) > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                              <p className="text-[10px] text-slate-400 uppercase font-semibold">Remaining</p>
                              <p className={`text-sm font-bold ${parseFloat(cl.balance) > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                {formatCurrency(parseFloat(cl.balance))}
                              </p>
                            </div>
                          </div>
                          {cl.notes && (
                            <p className="text-xs text-slate-600 italic">Note: {cl.notes}</p>
                          )}
                          {cl.status !== 'PAID' && (
                            <button
                              onClick={() => setPayForm({ creditId: cl.id, amount: '', notes: '' })}
                              className="w-full py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition"
                            >
                              Record Repayment
                            </button>
                          )}
                          {cl.status === 'PAID' && (
                            <div className="flex items-center justify-center gap-1.5 text-green-700 text-xs font-semibold py-1">
                              <CheckCircle2 className="w-4 h-4" /> Fully Paid
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Grand Total Footer */}
              {(profile?.creditLedger?.length > 0) && (
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3.5 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">Total Outstanding Balance</span>
                  <span className={`text-lg font-extrabold ${confirmedDebt > 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {formatCurrency(confirmedDebt)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Payments Tab ─────────────────────────────────────────── */}
          {tab === 'payments' && (
            <div className="overflow-y-auto max-h-72">
              {!profile?.allPayments?.length ? (
                <p className="text-slate-400 text-sm text-center py-8">No payment history.</p>
              ) : (
                <div className="space-y-2">
                  {/* Summary */}
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-green-800">
                      Total Payments ({profile.allPayments.length})
                    </span>
                    <span className="text-sm font-extrabold text-green-700">
                      {formatCurrency(
                        profile.allPayments.reduce(
                          (s: number, p: any) => s + parseFloat(String(p.amountPaid)),
                          0
                        )
                      )}
                    </span>
                  </div>

                  {profile.allPayments.map((p: any) => (
                    <div key={p.id} className="flex justify-between items-start py-2.5 px-3 border border-slate-100 rounded-lg bg-white">
                      <div>
                        <p className="text-sm font-semibold text-green-700">+ {formatCurrency(parseFloat(p.amountPaid))}</p>
                        {p.notes && <p className="text-xs text-slate-400 mt-0.5">{p.notes}</p>}
                        {p.recordedBy && (
                          <p className="text-[11px] text-slate-400">Recorded by {p.recordedBy.name}</p>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 whitespace-nowrap ml-3">{formatDateTime(p.paymentDate)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Payment form (global, shown below tabs) ───────────── */}
          {payForm && (
            <div className="border border-green-200 bg-green-50 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-green-800 text-sm">Record Repayment</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Amount (GH₵)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={payForm.amount}
                    onChange={(e) => setPayForm((f) => f ? { ...f, amount: e.target.value } : f)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                  <input
                    value={payForm.notes}
                    onChange={(e) => setPayForm((f) => f ? { ...f, notes: e.target.value } : f)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPayForm(null)}
                  className="flex-1 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => paymentMutation.mutate()}
                  disabled={!payForm.amount || paymentMutation.isPending}
                  className="flex-1 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60"
                >
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
