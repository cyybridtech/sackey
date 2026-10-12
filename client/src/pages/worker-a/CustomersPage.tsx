import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  UserPlus,
  Eye,
  AlertTriangle,
  CheckCircle,
  Wallet,
  ReceiptText,
  CreditCard,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import AddCustomerModal from '../../components/admin/AddCustomerModal';
import toast from 'react-hot-toast';

type TabId = 'overview' | 'debt' | 'advance';

// ── Debt & Payments Tab ───────────────────────────────────────────────────────

function DebtTab({ customerId }: { customerId: number }) {
  const queryClient = useQueryClient();
  const [openPaymentId, setOpenPaymentId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');

  const { data: debtData, isLoading } = useQuery({
    queryKey: ['customer-debt', customerId],
    queryFn: async () => {
      const res = await api.get(`/customers/${customerId}/debt`);
      return res.data.data;
    },
  });

  const payMutation = useMutation({
    mutationFn: ({ ledgerId, amount, notes }: { ledgerId: number; amount: number; notes: string }) =>
      api.post(`/customers/${customerId}/payment`, {
        creditLedgerId: ledgerId,
        amountPaid: amount,
        notes,
      }),
    onSuccess: () => {
      toast.success('Payment recorded successfully!');
      void queryClient.invalidateQueries({ queryKey: ['customer-debt', customerId] });
      void queryClient.invalidateQueries({ queryKey: ['customers-worker'] });
      setOpenPaymentId(null);
      setPayAmount('');
      setPayNotes('');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record payment'),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  const { ledgers = [], totalOutstanding = 0 } = debtData || {};
  const activeLedgers = ledgers.filter((l: any) => l.status !== 'PAID');

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className={`rounded-xl p-4 ${totalOutstanding > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
        <div className="flex items-center gap-2">
          {totalOutstanding > 0 ? (
            <AlertTriangle className="w-5 h-5 text-red-500" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Outstanding</p>
            <p className={`text-xl font-black ${totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(totalOutstanding)}
            </p>
          </div>
        </div>
      </div>

      {activeLedgers.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <CheckCircle className="w-10 h-10 mx-auto text-green-400 mb-2" />
          <p className="text-sm font-medium">No outstanding debts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeLedgers.map((ledger: any) => {
            const balance = parseFloat(ledger.balance || '0');
            const isOpen = openPaymentId === ledger.id;

            return (
              <div key={ledger.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-4 bg-white">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-500">
                        Sale #{ledger.sale?.id} · {ledger.sale?.saleDate ? formatDate(ledger.sale.saleDate) : '—'}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-slate-600">
                        <span>Total: <strong>{formatCurrency(parseFloat(ledger.totalAmount || '0'))}</strong></span>
                        <span>Paid: <strong className="text-green-600">{formatCurrency(parseFloat(ledger.amountPaid || '0'))}</strong></span>
                        <span>Balance: <strong className="text-red-600">{formatCurrency(balance)}</strong></span>
                      </div>
                    </div>
                    <Badge variant={ledger.status === 'OUTSTANDING' ? 'red' : 'orange'}>
                      {ledger.status}
                    </Badge>
                  </div>

                  {balance > 0 && (
                    <button
                      onClick={() => {
                        setOpenPaymentId(isOpen ? null : ledger.id);
                        setPayAmount('');
                        setPayNotes('');
                      }}
                      className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Record Payment
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>

                {/* Payment Form */}
                {isOpen && (
                  <div className="border-t border-slate-100 bg-blue-50 p-4 space-y-3">
                    <p className="text-xs font-bold text-blue-800">
                      Record Payment (max: {formatCurrency(balance)})
                    </p>
                    <input
                      type="number"
                      min={0.01}
                      max={balance}
                      step={0.01}
                      placeholder={`Amount (max ${balance.toFixed(2)})`}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <textarea
                      placeholder="Notes (optional)"
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                      rows={2}
                      className="w-full border border-blue-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={payMutation.isPending || !payAmount || parseFloat(payAmount) <= 0 || parseFloat(payAmount) > balance}
                        onClick={() =>
                          payMutation.mutate({
                            ledgerId: ledger.id,
                            amount: parseFloat(payAmount),
                            notes: payNotes,
                          })
                        }
                        className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition"
                      >
                        {payMutation.isPending ? 'Recording…' : 'Submit Payment'}
                      </button>
                      <button
                        onClick={() => setOpenPaymentId(null)}
                        className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Payment history mini-list */}
                {ledger.payments?.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment History</p>
                    {ledger.payments.map((p: any) => (
                      <div key={p.id} className="flex justify-between text-xs text-slate-600">
                        <span>{formatDate(p.paymentDate)}</span>
                        <span className="font-semibold text-green-600">+{formatCurrency(parseFloat(p.amountPaid))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Advance Balance Tab ────────────────────────────────────────────────────────

function AdvanceTab({ customerId }: { customerId: number }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['customer-advance', customerId],
    queryFn: async () => {
      const res = await api.get(`/customers/${customerId}`);
      return res.data.data;
    },
  });

  const advanceMutation = useMutation({
    mutationFn: () =>
      api.post(`/customers/${customerId}/advance`, { amount: parseFloat(amount), notes }),
    onSuccess: () => {
      toast.success('Advance deposit recorded!');
      void queryClient.invalidateQueries({ queryKey: ['customer-advance', customerId] });
      void queryClient.invalidateQueries({ queryKey: ['customers-worker'] });
      setAmount('');
      setNotes('');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to record advance'),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;

  const advanceBalance = parseFloat(profile?.advanceBalance || '0');

  return (
    <div className="space-y-4">
      {/* Current Balance */}
      <div className={`rounded-xl p-4 border ${advanceBalance > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${advanceBalance > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">Current Advance Balance</p>
            <p className={`text-2xl font-black ${advanceBalance > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
              {formatCurrency(advanceBalance)}
            </p>
          </div>
        </div>
        {advanceBalance > 0 && (
          <p className="text-xs text-emerald-700 mt-2 pl-1">
            ✓ This balance will be applied automatically at checkout when a sale is made.
          </p>
        )}
      </div>

      {/* Deposit Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-bold text-slate-700">Record Advance Deposit</p>
        <input
          type="number"
          min={0.01}
          step={0.01}
          placeholder="Amount (GH₵)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <button
          disabled={advanceMutation.isPending || !amount || parseFloat(amount) <= 0}
          onClick={() => advanceMutation.mutate()}
          className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          {advanceMutation.isPending ? 'Recording…' : 'Record Deposit'}
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkerACustomersPage() {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [viewCustomer, setViewCustomer] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

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

  const openCustomer = (c: any) => {
    setViewCustomer(c);
    setActiveTab('overview');
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Eye className="w-3.5 h-3.5" /> },
    { id: 'debt', label: 'Debt & Payments', icon: <ReceiptText className="w-3.5 h-3.5" /> },
    { id: 'advance', label: 'Advance Balance', icon: <Wallet className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black">Customers</h1>
            <p className="text-blue-200 text-xs mt-0.5">View customers, record payments & advance deposits</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-blue-900 rounded-xl text-xs font-bold hover:bg-blue-50 transition"
          >
            <UserPlus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm font-medium">No customers found.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden p-3 space-y-2.5">
              {customers.map((c: any) => {
                const debt = parseFloat(c.totalDebt || '0');
                const advance = parseFloat(c.advanceBalance || '0');
                return (
                  <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm truncate">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.phone || '—'}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {debt > 0 && (
                          <span className="flex items-center gap-1 text-red-600 font-semibold text-[11px]">
                            <AlertTriangle className="w-3 h-3" />{formatCurrency(debt)} debt
                          </span>
                        )}
                        {advance > 0 && (
                          <span className="text-emerald-600 font-semibold text-[11px]">
                            +{formatCurrency(advance)} advance
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => openCustomer(c)}
                      className="p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Name', 'Phone', 'Type', 'Debt', 'Advance', 'Joined', 'View'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((c: any) => {
                  const debt = parseFloat(c.totalDebt || '0');
                  const advance = parseFloat(c.advanceBalance || '0');
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
                      <td className="px-4 py-3">
                        {advance > 0 ? (
                          <span className="text-emerald-600 font-semibold text-xs">{formatCurrency(advance)}</span>
                        ) : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(c.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => openCustomer(c)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* View Customer Modal */}
      {viewCustomer && (
        <Modal
          title={viewCustomer.name}
          onClose={() => setViewCustomer(null)}
          size="xl"
        >
          {/* Tabs */}
          <div className="flex gap-1.5 mb-5 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            profile ? (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-0.5">Phone</p>
                    <p className="font-semibold">{profile.phone || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-0.5">Type</p>
                    <p className="font-semibold">{profile.customerType}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-0.5">Total Debt</p>
                    <p className={`font-black text-base ${parseFloat(profile.totalDebt || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(parseFloat(profile.totalDebt || 0))}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-500 mb-0.5">Advance Balance</p>
                    <p className={`font-black text-base ${parseFloat(profile.advanceBalance || 0) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {formatCurrency(parseFloat(profile.advanceBalance || 0))}
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-700 mb-2 text-sm">Recent Purchases</h4>
                  {profile.sales?.length === 0 ? (
                    <p className="text-slate-400 text-xs">No purchases yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {profile.sales?.slice(0, 5).map((s: any) => (
                        <div key={s.id} className="flex justify-between items-center py-2 border-b border-slate-100">
                          <span className="text-xs text-slate-500">{formatDateTime(s.saleDate)}</span>
                          <span className="font-semibold text-sm">{formatCurrency(parseFloat(s.finalTotal))}</span>
                          <Badge variant={s.paymentMode === 'CC' ? 'green' : 'orange'}>{s.paymentMode}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : <Spinner />
          )}

          {activeTab === 'debt' && <DebtTab customerId={viewCustomer.id} />}
          {activeTab === 'advance' && <AdvanceTab customerId={viewCustomer.id} />}
        </Modal>
      )}

      {showAdd && <AddCustomerModal onClose={() => { setShowAdd(false); refetch(); }} />}
    </div>
  );
}
