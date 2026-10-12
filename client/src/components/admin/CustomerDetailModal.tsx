import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/utils';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import toast from 'react-hot-toast';
import {
  X,
  Phone,
  MapPin,
  FileText,
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
  User,
  ReceiptText,
  BadgeDollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  History,
  ChevronRight,
  Star,
  Package,
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

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

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
      toast.success(res.data?.message || 'BBF debt recorded');
      setShowBookDebtForm(false);
      setBookDebtAmount('');
      setBookDebtNotes('');
      qc.invalidateQueries({ queryKey: ['customer-detail', customer.id] });
      qc.invalidateQueries({ queryKey: ['credits'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
  });

  /* ── Derived values ──────────────────────────────────────────── */
  const confirmedDebt = parseFloat(String(profile?.confirmedDebt ?? profile?.totalDebt ?? 0));
  const pendingDebt   = parseFloat(String(profile?.pendingCreditDebt ?? 0));
  const advanceBalance = parseFloat(String(profile?.advanceBalance ?? 0));
  const totalPotential = parseFloat(String(profile?.totalPotentialDebt ?? confirmedDebt + pendingDebt));

  const bbfEntries: any[]  = (profile?.creditLedger ?? []).filter((cl: any) => !cl.saleId);
  const saleEntries: any[] = (profile?.creditLedger ?? []).filter((cl: any) => !!cl.saleId);
  const bbfTotal       = bbfEntries.reduce((s, e) => s + parseFloat(String(e.balance)), 0);
  const saleDebtTotal  = saleEntries.filter((e) => e.status !== 'PAID').reduce((s, e) => s + parseFloat(String(e.balance)), 0);
  const totalPaid      = (profile?.allPayments ?? []).reduce((s: number, p: any) => s + parseFloat(String(p.amountPaid)), 0);

  const initials = customer.name
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase())
    .join('');

  const isRegistered = profile?.customerType === 'REGISTERED';

  /* ── Tabs ────────────────────────────────────────────────────── */
  const TABS: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'overview',  label: 'Overview',    icon: <User className="w-3.5 h-3.5" /> },
    { key: 'purchases', label: 'Purchases',   icon: <Package className="w-3.5 h-3.5" />, badge: profile?.sales?.length },
    { key: 'credits',   label: 'Credit / Debt', icon: <CreditCard className="w-3.5 h-3.5" />, badge: confirmedDebt > 0 ? (bbfEntries.length + saleEntries.length) : undefined },
    { key: 'payments',  label: 'Payments',    icon: <Banknote className="w-3.5 h-3.5" />, badge: profile?.allPayments?.length },
  ];

  /* ── Small reusable stat card ────────────────────────────────── */
  const MiniStat = ({
    label, value, sub, color = 'slate', icon,
  }: {
    label: string; value: string; sub?: string; color?: string; icon: React.ReactNode;
  }) => {
    const colors: Record<string, string> = {
      red:    'from-red-500 to-rose-600',
      green:  'from-emerald-500 to-green-600',
      blue:   'from-blue-500 to-indigo-600',
      amber:  'from-amber-500 to-orange-500',
      slate:  'from-slate-500 to-slate-700',
      purple: 'from-violet-500 to-purple-600',
    };
    const bg: Record<string, string> = {
      red:    'bg-red-50 border-red-200',
      green:  'bg-emerald-50 border-emerald-200',
      blue:   'bg-blue-50 border-blue-200',
      amber:  'bg-amber-50 border-amber-200',
      slate:  'bg-slate-50 border-slate-200',
      purple: 'bg-violet-50 border-violet-200',
    };
    const txt: Record<string, string> = {
      red:    'text-red-700',
      green:  'text-emerald-700',
      blue:   'text-blue-700',
      amber:  'text-amber-700',
      slate:  'text-slate-700',
      purple: 'text-violet-700',
    };
    return (
      <div className={`rounded-2xl border ${bg[color]} p-4 flex flex-col gap-2`}>
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white shadow-sm`}>
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          <p className={`text-xl font-extrabold ${txt[color]} leading-tight mt-0.5`}>{value}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    );
  };

  /* ── Ledger card (collapsible) ───────────────────────────────── */
  const LedgerCard = ({ cl, isBBF }: { cl: any; isBBF: boolean }) => {
    const isExpanded = expandedLedger === cl.id;
    const balance = parseFloat(String(cl.balance));
    const total   = parseFloat(String(cl.totalAmount));
    const paid    = parseFloat(String(cl.amountPaid));
    const pct     = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
    const isPaid  = cl.status === 'PAID';

    return (
      <div className={`rounded-2xl border overflow-hidden transition-all ${
        isBBF
          ? 'border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50'
          : 'border-slate-200 bg-white'
      }`}>
        {/* Header */}
        <button
          type="button"
          onClick={() => setExpandedLedger(isExpanded ? null : cl.id)}
          className="w-full flex items-center gap-3 p-4 hover:bg-black/[0.02] transition text-left"
        >
          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isBBF ? 'bg-orange-100' : isPaid ? 'bg-green-100' : 'bg-red-100'
          }`}>
            {isBBF
              ? <BookOpen className="w-4.5 h-4.5 text-orange-600" />
              : isPaid
                ? <CheckCircle2 className="w-4.5 h-4.5 text-green-600" />
                : <CreditCard className="w-4.5 h-4.5 text-red-600" />
            }
          </div>

          {/* Label */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">
              {isBBF ? '📖 Balance Brought Forward' : `Sale #${cl.saleId}`}
            </p>
            <p className="text-xs text-slate-400">{formatDate(cl.createdAt)}</p>
          </div>

          {/* Balance pill */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className="text-xs text-slate-400 leading-none mb-0.5">Balance</p>
              <p className={`text-sm font-extrabold leading-none ${
                isPaid ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(balance)}
              </p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isPaid
                ? 'bg-green-100 text-green-700 border-green-200'
                : cl.status === 'PARTIAL'
                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                  : 'bg-red-100 text-red-700 border-red-200'
            }`}>
              {cl.status}
            </span>
            {isExpanded
              ? <ChevronUp className="w-4 h-4 text-slate-400" />
              : <ChevronDown className="w-4 h-4 text-slate-400" />
            }
          </div>
        </button>

        {/* Progress bar */}
        <div className="px-4 pb-1">
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isPaid ? 'bg-green-500' : pct > 0 ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1 text-right">{pct}% repaid</p>
        </div>

        {/* Expanded body */}
        {isExpanded && (
          <div className="border-t border-slate-100 bg-white/80 px-4 pb-4 pt-3 space-y-4">
            {/* 3-column breakdown */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: isBBF ? 'Opening Debt' : 'Invoice', val: formatCurrency(total), cls: 'bg-slate-50 border-slate-200 text-slate-700' },
                { label: 'Paid So Far',  val: formatCurrency(paid),    cls: 'bg-green-50 border-green-200 text-green-700' },
                { label: 'Remaining',   val: formatCurrency(balance),  cls: isPaid ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700' },
              ].map(({ label, val, cls }) => (
                <div key={label} className={`rounded-xl border p-3 text-center ${cls}`}>
                  <p className="text-[10px] uppercase font-semibold text-slate-400 mb-1">{label}</p>
                  <p className="text-sm font-extrabold">{val}</p>
                </div>
              ))}
            </div>

            {cl.notes && (
              <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-600"><span className="font-semibold">Ref:</span> {cl.notes}</p>
              </div>
            )}

            {isPaid ? (
              <div className="flex items-center justify-center gap-2 py-2 bg-green-50 rounded-xl border border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-bold text-green-700">Fully Settled</span>
              </div>
            ) : (
              <button
                onClick={() => setPayForm({ creditId: cl.id, amount: '', notes: '' })}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl text-sm font-bold hover:from-emerald-600 hover:to-green-700 transition shadow-sm"
              >
                Record Repayment
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════ */
  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Side sheet — slides in from right */}
      <div className="relative ml-auto w-full max-w-2xl h-full flex flex-col bg-slate-50 shadow-2xl overflow-hidden">

        {/* ── HERO HEADER ─────────────────────────────────────── */}
        <div className="relative shrink-0 bg-gradient-to-br from-slate-800 via-slate-900 to-blue-950 px-6 pt-6 pb-0 overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-blue-600/10 pointer-events-none" />
          <div className="absolute top-4 right-20 w-24 h-24 rounded-full bg-indigo-400/10 pointer-events-none" />
          <div className="absolute -bottom-6 left-1/3 w-32 h-32 rounded-full bg-blue-800/20 pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Customer identity row */}
          <div className="flex items-start gap-4 mb-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-2xl font-extrabold shadow-lg shrink-0 border-2 border-white/20">
              {initials}
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-extrabold text-white leading-tight">{customer.name}</h1>
                {isRegistered && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/30 border border-blue-400/40 text-blue-200">
                    <Star className="w-2.5 h-2.5" /> Registered
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {profile?.phone && (
                  <span className="flex items-center gap-1 text-xs text-blue-200">
                    <Phone className="w-3 h-3" /> {profile.phone}
                  </span>
                )}
                {profile?.address && (
                  <span className="flex items-center gap-1 text-xs text-blue-200">
                    <MapPin className="w-3 h-3" /> {profile.address}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-400 mt-1">
                Customer since {profile?.createdAt ? formatDate(profile.createdAt) : '—'}
              </p>
            </div>
          </div>

          {/* Debt/balance hero strip */}
          {!isLoading && (
            <div className="grid grid-cols-3 gap-3 mb-5">
              {/* Outstanding */}
              <div className={`rounded-2xl p-3.5 text-center ${confirmedDebt > 0 ? 'bg-red-500/20 border border-red-400/30' : 'bg-green-500/20 border border-green-400/30'}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${confirmedDebt > 0 ? 'text-red-300' : 'text-green-300'}`}>
                  Outstanding
                </div>
                <div className={`text-lg font-extrabold leading-tight ${confirmedDebt > 0 ? 'text-red-200' : 'text-green-200'}`}>
                  {formatCurrency(confirmedDebt)}
                </div>
                {confirmedDebt > 0 && bbfTotal > 0 && (
                  <div className="text-[10px] text-red-300/80 mt-0.5">BBF {formatCurrency(bbfTotal)}</div>
                )}
              </div>

              {/* Advance balance */}
              <div className={`rounded-2xl p-3.5 text-center ${advanceBalance > 0 ? 'bg-blue-500/20 border border-blue-400/30' : 'bg-white/5 border border-white/10'}`}>
                <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${advanceBalance > 0 ? 'text-blue-300' : 'text-slate-400'}`}>
                  Advance Bal.
                </div>
                <div className={`text-lg font-extrabold leading-tight ${advanceBalance > 0 ? 'text-blue-200' : 'text-slate-500'}`}>
                  {formatCurrency(advanceBalance)}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Available credit</div>
              </div>

              {/* Purchases */}
              <div className="rounded-2xl p-3.5 text-center bg-white/5 border border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-400">Purchases</div>
                <div className="text-lg font-extrabold leading-tight text-white">
                  {profile?.sales?.length ?? 0}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">All time</div>
              </div>
            </div>
          )}

          {/* Tabs (attached to header bottom) */}
          <div className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-t-xl transition whitespace-nowrap ${
                  tab === t.key
                    ? 'bg-slate-50 text-blue-700'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {t.icon}
                {t.label}
                {t.badge != null && t.badge > 0 && (
                  <span className={`text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 ${
                    tab === t.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/20 text-white'
                  }`}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── BODY (scrollable) ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Spinner />
              <p className="text-sm text-slate-400">Loading profile…</p>
            </div>
          ) : (
            <div className="p-5 space-y-5">

              {/* Unconfirmed warning banner */}
              {pendingDebt > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-sm">
                    <p className="font-bold text-amber-900">Unconfirmed Credit Exposure: {formatCurrency(pendingDebt)}</p>
                    <p className="text-amber-700 text-xs mt-0.5">
                      Goods issued on credit are awaiting dual-confirmation. Total potential exposure: <strong>{formatCurrency(totalPotential)}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {/* ── OVERVIEW TAB ─────────────────────────────── */}
              {tab === 'overview' && (
                <div className="space-y-5">
                  {/* KPI grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <MiniStat
                      label="Outstanding Debt"
                      value={formatCurrency(confirmedDebt)}
                      sub={confirmedDebt > 0 ? `${bbfEntries.length + saleEntries.filter(e => e.status !== 'PAID').length} open ledgers` : 'All clear!'}
                      color={confirmedDebt > 0 ? 'red' : 'green'}
                      icon={<TrendingDown className="w-4 h-4" />}
                    />
                    <MiniStat
                      label="Advance Balance"
                      value={formatCurrency(advanceBalance)}
                      sub="Available credit"
                      color={advanceBalance > 0 ? 'blue' : 'slate'}
                      icon={<Wallet className="w-4 h-4" />}
                    />
                    <MiniStat
                      label="Total Paid"
                      value={formatCurrency(totalPaid)}
                      sub={`${profile?.allPayments?.length ?? 0} payment(s)`}
                      color="green"
                      icon={<BadgeDollarSign className="w-4 h-4" />}
                    />
                    <MiniStat
                      label="Credit Sales"
                      value={String(profile?.sales?.filter((s: any) => s.paymentMode === 'CREDIT').length ?? 0)}
                      sub={`of ${profile?.sales?.length ?? 0} total purchases`}
                      color="purple"
                      icon={<ReceiptText className="w-4 h-4" />}
                    />
                  </div>

                  {/* Debt Breakdown card */}
                  {(confirmedDebt > 0 || bbfTotal > 0) && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                        <ArrowDownCircle className="w-4 h-4 text-red-500" />
                        <p className="text-sm font-bold text-slate-700">Debt Breakdown</p>
                      </div>
                      <div className="p-4 space-y-2.5">
                        {bbfTotal > 0 && (
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-orange-500" />
                              <span className="text-sm text-slate-600">Balance Brought Forward (BBF)</span>
                            </div>
                            <span className="font-bold text-orange-700">{formatCurrency(bbfTotal)}</span>
                          </div>
                        )}
                        {saleDebtTotal > 0 && (
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="text-sm text-slate-600">Credit Sale Debt</span>
                            </div>
                            <span className="font-bold text-red-700">{formatCurrency(saleDebtTotal)}</span>
                          </div>
                        )}
                        <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center">
                          <span className="text-sm font-bold text-slate-800">Total Outstanding</span>
                          <span className="text-base font-extrabold text-red-700">{formatCurrency(confirmedDebt)}</span>
                        </div>
                        {advanceBalance > 0 && (
                          <div className="flex justify-between items-center bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Wallet className="w-3.5 h-3.5 text-blue-500" />
                              <span className="text-sm text-blue-700 font-medium">Advance Balance</span>
                            </div>
                            <span className="font-bold text-blue-700">{formatCurrency(advanceBalance)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Customer notes */}
                  {(profile?.address || profile?.notes) && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-sm">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Details
                      </p>
                      {profile.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <span className="text-sm text-slate-600">{profile.address}</span>
                        </div>
                      )}
                      {profile.notes && (
                        <div className="flex items-start gap-2">
                          <FileText className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                          <span className="text-sm text-slate-600">{profile.notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── PURCHASES TAB ──────────────────────────── */}
              {tab === 'purchases' && (
                <div className="space-y-3">
                  {!profile?.sales?.length ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                      <ShoppingBag className="w-10 h-10 opacity-30" />
                      <p className="text-sm">No purchases yet</p>
                    </div>
                  ) : (
                    profile.sales.map((s: any) => (
                      <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              s.status === 'GREEN' ? 'bg-green-500' :
                              s.status === 'FLAGGED' ? 'bg-orange-500' : 'bg-blue-500'
                            }`} />
                            <span className="text-xs font-bold text-slate-500">Sale #{s.id}</span>
                            <span className="text-xs text-slate-400">{formatDate(s.saleDate)}</span>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            s.status === 'GREEN' ? 'bg-green-50 text-green-700 border-green-200' :
                            s.status === 'FLAGGED' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {s.status === 'GREEN' ? 'Confirmed' : s.status === 'FLAGGED' ? 'Flagged' : 'Pending'}
                          </span>
                        </div>

                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-lg font-extrabold text-slate-800">{formatCurrency(parseFloat(s.finalTotal))}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {s.saleItems?.length} item(s) ·{' '}
                              {s.saleItems?.map((i: any) =>
                                `${i.quantity}× ${i.product?.name || `#${i.productId}`}`
                              ).join(', ')}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            s.paymentMode === 'CC'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {s.paymentMode === 'CC' ? '💵 Cash & Carry' : '📋 Credit'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── CREDIT / DEBT TAB ───────────────────────── */}
              {tab === 'credits' && (
                <div className="space-y-6">

                  {/* Pending / unconfirmed */}
                  {profile?.pendingCreditSales?.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-xl bg-amber-100 flex items-center justify-center">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">Unconfirmed Credit Sales</p>
                          <p className="text-xs text-slate-400">Awaiting dual-worker confirmation</p>
                        </div>
                        <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-amber-700">
                          {profile.pendingCreditSales.length}
                        </span>
                      </div>
                      {profile.pendingCreditSales.map((ps: any) => (
                        <div key={ps.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5">
                          <div className="flex justify-between text-sm font-bold text-amber-900 mb-1">
                            <span>Sale #{ps.id} · {formatDate(ps.saleDate)}</span>
                            <span>{formatCurrency(parseFloat(ps.finalTotal))}</span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {ps.saleItems?.map((i: any) =>
                              `${i.quantity}× ${i.product?.name || `#${i.productId}`}`
                            ).join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* BBF Section */}
                  {bbfEntries.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-xl bg-orange-100 flex items-center justify-center">
                            <BookOpen className="w-3.5 h-3.5 text-orange-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700">Balance Brought Forward (BBF)</p>
                            <p className="text-xs text-slate-400">Historical / paper book balances</p>
                          </div>
                        </div>
                        {bbfTotal > 0 && (
                          <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-700">
                            {formatCurrency(bbfTotal)}
                          </span>
                        )}
                      </div>
                      {bbfEntries.map((cl) => <LedgerCard key={cl.id} cl={cl} isBBF={true} />)}
                    </div>
                  )}

                  {/* Credit Sale Ledger */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-red-100 flex items-center justify-center">
                          <CreditCard className="w-3.5 h-3.5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700">Credit Sale Ledger</p>
                          <p className="text-xs text-slate-400">{saleEntries.length} entr{saleEntries.length === 1 ? 'y' : 'ies'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBookDebtForm(!showBookDebtForm)}
                        className="flex items-center gap-1.5 text-xs font-bold text-red-700 hover:text-red-800 bg-red-50 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-xl transition"
                      >
                        <BookOpen className="w-3.5 h-3.5" /> + Add BBF
                      </button>
                    </div>

                    {/* Add BBF form */}
                    {showBookDebtForm && (
                      <div className="bg-white border border-red-200 rounded-2xl p-4 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen className="w-4 h-4 text-red-500" />
                          <p className="text-sm font-bold text-red-900">Add Balance Brought Forward</p>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Migrate a historical debt from paper records into this customer's digital account.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Amount (GH₵) *</label>
                            <input
                              type="number" step="0.01" min="0.01" placeholder="e.g. 1500.00"
                              value={bookDebtAmount}
                              onChange={(e) => setBookDebtAmount(e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reference Note</label>
                            <input
                              type="text" placeholder="e.g. Old Green Book p.42"
                              value={bookDebtNotes}
                              onChange={(e) => setBookDebtNotes(e.target.value)}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setShowBookDebtForm(false)}
                            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                          >
                            Cancel
                          </button>
                          <button
                            disabled={openingDebtMutation.isPending || !bookDebtAmount || parseFloat(bookDebtAmount) <= 0}
                            onClick={() => openingDebtMutation.mutate()}
                            className="flex-1 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl text-sm font-bold hover:from-red-600 hover:to-rose-700 transition disabled:opacity-50"
                          >
                            {openingDebtMutation.isPending ? 'Saving…' : 'Record BBF'}
                          </button>
                        </div>
                      </div>
                    )}

                    {saleEntries.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2 bg-white rounded-2xl border border-dashed border-slate-200">
                        <CreditCard className="w-8 h-8 opacity-30" />
                        <p className="text-sm">No credit sale entries</p>
                      </div>
                    ) : (
                      saleEntries.map((cl) => <LedgerCard key={cl.id} cl={cl} isBBF={false} />)
                    )}

                    {/* Total footer */}
                    {(profile?.creditLedger?.length > 0) && (
                      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl px-5 py-4 flex items-center justify-between shadow-lg mt-2">
                        <div>
                          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wide">Total Outstanding</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {bbfEntries.length > 0 && `BBF: ${formatCurrency(bbfTotal)}`}
                            {bbfEntries.length > 0 && saleDebtTotal > 0 && ' + '}
                            {saleDebtTotal > 0 && `Sales: ${formatCurrency(saleDebtTotal)}`}
                          </p>
                        </div>
                        <p className={`text-2xl font-extrabold ${confirmedDebt > 0 ? 'text-red-300' : 'text-green-400'}`}>
                          {formatCurrency(confirmedDebt)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── PAYMENTS TAB ────────────────────────────── */}
              {tab === 'payments' && (
                <div className="space-y-3">
                  {/* Summary banner */}
                  <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl px-5 py-4 flex items-center justify-between shadow-sm">
                    <div>
                      <p className="text-xs font-bold text-green-100 uppercase tracking-wide">Total Received</p>
                      <p className="text-xs text-green-200 mt-0.5">{profile?.allPayments?.length ?? 0} payment(s)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowUpCircle className="w-5 h-5 text-green-200" />
                      <p className="text-2xl font-extrabold text-white">{formatCurrency(totalPaid)}</p>
                    </div>
                  </div>

                  {!profile?.allPayments?.length ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 bg-white rounded-2xl border border-dashed border-slate-200">
                      <DollarSign className="w-10 h-10 opacity-30" />
                      <p className="text-sm">No payment history</p>
                    </div>
                  ) : (
                    profile.allPayments.map((p: any) => (
                      <div key={p.id} className="bg-white rounded-2xl border border-slate-200 px-4 py-3.5 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
                            <ArrowUpCircle className="w-4 h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-extrabold text-green-700">+ {formatCurrency(parseFloat(p.amountPaid))}</p>
                            {p.notes && <p className="text-xs text-slate-400 mt-0.5">{p.notes}</p>}
                            {p.recordedBy && (
                              <p className="text-[11px] text-slate-300 mt-0.5">by {p.recordedBy.name}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-xs text-slate-400">{formatDateTime(p.paymentDate)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── Payment form (floating at bottom of content) ── */}
              {payForm && (
                <div className="fixed bottom-6 right-6 w-80 bg-white rounded-2xl shadow-2xl border border-green-200 p-5 z-50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-sm font-bold text-green-900">Record Repayment</p>
                    </div>
                    <button onClick={() => setPayForm(null)} className="p-1 rounded-lg hover:bg-slate-100 transition">
                      <X className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Amount (GH₵)</label>
                      <input
                        type="number" step="0.01" min="0.01"
                        value={payForm.amount}
                        onChange={(e) => setPayForm((f) => f ? { ...f, amount: e.target.value } : f)}
                        placeholder="0.00"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
                      <input
                        value={payForm.notes}
                        onChange={(e) => setPayForm((f) => f ? { ...f, notes: e.target.value } : f)}
                        placeholder="Optional note…"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setPayForm(null)}
                      className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => paymentMutation.mutate()}
                      disabled={!payForm.amount || paymentMutation.isPending}
                      className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl text-sm font-bold hover:from-emerald-600 hover:to-green-700 transition disabled:opacity-50 shadow-sm"
                    >
                      {paymentMutation.isPending ? 'Saving…' : 'Save Payment'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
