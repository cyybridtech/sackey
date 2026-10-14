import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, CheckCircle, Filter, AlertTriangle, ShieldCheck, HelpCircle, Pencil, Trash2, RotateCcw, ChevronDown, ChevronRight, Calendar, Clock } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, formatDateTime, formatDate } from '../../lib/utils';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import DeleteConfirmModal from '../../components/ui/DeleteConfirmModal';
import toast from 'react-hot-toast';

const STATUS_BADGE: Record<string, { variant: any; label: string }> = {
  BLUE:    { variant: 'blue',   label: '● Pending Dispatch (Sales Logged)' },
  RED:     { variant: 'red',    label: '● Pending Sales (Dispatch Logged)' },
  GREEN:   { variant: 'green',  label: '● Confirmed Match' },
  FLAGGED: { variant: 'orange', label: '⚠ Flagged / Unpaired' },
};

export default function SalesPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
  const [editingSale, setEditingSale] = useState(false);
  const [saleEditForm, setSaleEditForm] = useState({ notes: '', discountAmount: '', saleType: 'WHOLESALE' });
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  
  const statusFromUrl = searchParams.get('status') || '';
  const deletedOnly = searchParams.get('deleted') === 'true';
  const verifiedOnly = searchParams.get('verified') === 'true';
  const selectedSaleId = Number(searchParams.get('saleId'));
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    paymentMode: '',
  });

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', filters, statusFromUrl, deletedOnly, verifiedOnly],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries({
          ...filters,
          status: statusFromUrl,
          deleted: deletedOnly ? 'true' : '',
          verified: verifiedOnly ? 'true' : '',
        }).filter(([, v]) => v)
      );
      const res = await api.get('/sales', { params });
      return res.data.data;
    },
  });
  useEffect(() => {
    if (!selectedSaleId || sales.length === 0) return;
    const sale = sales.find((item: any) => item.id === selectedSaleId);
    if (sale) setSelectedSale(sale);
  }, [sales, selectedSaleId]);

  const verifyMutation = useMutation({
    mutationFn: (id: number) => api.post(`/sales/${id}/verify`),
    onSuccess: () => {
      toast.success('Sale verified! Moved to the Verified page.');
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setSelectedSale(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to verify sale'),
  });

  const unverifyMutation = useMutation({
    mutationFn: (id: number) => api.post(`/sales/${id}/unverify`),
    onSuccess: (res: any) => {
      toast.success(res.data?.message || 'Sale moved back to unverified sales queue');
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setSelectedSale(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to unverify sale'),
  });

  const updateSaleMutation = useMutation({
    mutationFn: (input: { id: number; data: { notes: string; discountAmount?: number; saleType?: string } }) =>
      api.put(`/sales/${input.id}`, input.data),
    onSuccess: () => {
      toast.success('Sale updated');
      void qc.invalidateQueries({ queryKey: ['sales'] });
      void qc.invalidateQueries({ queryKey: ['credits'] });
      void qc.invalidateQueries({ queryKey: ['credits-summary'] });
      setEditingSale(false);
      setSelectedSale(null);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update sale'),
  });

  const deleteSaleMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sales/${id}`),
    onSuccess: () => {
      toast.success('Sale deleted and retained in the admin review trail');
      void qc.invalidateQueries({ queryKey: ['sales'] });
      void qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void qc.invalidateQueries({ queryKey: ['credits'] });
      void qc.invalidateQueries({ queryKey: ['credits-summary'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      setSelectedSale(null);
      setEditingSale(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to delete sale'),
  });

  const restoreSaleMutation = useMutation({
    mutationFn: (id: number) => api.post(`/sales/${id}/restore`),
    onSuccess: (res: any) => {
      toast.success(res.data?.message || 'Sale restored successfully to active records');
      void qc.invalidateQueries({ queryKey: ['sales'] });
      void qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void qc.invalidateQueries({ queryKey: ['credits'] });
      void qc.invalidateQueries({ queryKey: ['credits-summary'] });
      void qc.invalidateQueries({ queryKey: ['products'] });
      setSelectedSale(null);
      setEditingSale(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to restore sale'),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sales/${id}/permanent`),
    onSuccess: (res: any) => {
      toast.success(res.data?.message || 'Sale record permanently purged from database');
      void qc.invalidateQueries({ queryKey: ['sales'] });
      void qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      void qc.invalidateQueries({ queryKey: ['credits'] });
      void qc.invalidateQueries({ queryKey: ['credits-summary'] });
      setSelectedSale(null);
      setShowPermanentDeleteModal(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to permanently delete sale'),
  });

  const beginSaleEdit = () => {
    setSaleEditForm({
      notes: selectedSale.notes || '',
      discountAmount: String(selectedSale.discountAmount ?? 0),
      saleType: selectedSale.saleType,
    });
    setEditingSale(true);
  };

  const handleStatusFilterChange = (status: string) => {
    if (status) {
      setSearchParams({ status });
    } else {
      setSearchParams({});
    }
  };

  const clearFilters = () => {
    setFilters({ dateFrom: '', dateTo: '', paymentMode: '' });
    setSearchParams({});
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {deletedOnly ? 'Deleted Sales Audit Trail' : verifiedOnly ? 'Verified Sales Registry' : 'Sales Transactions'}
          </h1>
          <p className="text-slate-500 text-sm">
            {deletedOnly
              ? 'Historical deleted records retained with full dual-worker details'
              : verifiedOnly
              ? 'Admin-approved and certified transactions grouped by date'
              : 'Active dual-confirmation verification queue'}
          </p>
        </div>
      </div>

      {/* Top View Switcher Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 1. Active Sales */}
        <button
          type="button"
          onClick={() => setSearchParams({})}
          className={`p-4 rounded-xl border text-left transition flex items-center justify-between shadow-xs ${
            !deletedOnly && !verifiedOnly
              ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wider">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Active Sales</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">Sales Queue</p>
            <p className="text-xs text-slate-400">Transactions awaiting admin sign-off</p>
          </div>
          {!deletedOnly && !verifiedOnly && (
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
          )}
        </button>

        {/* 2. Verified Sales */}
        <button
          type="button"
          onClick={() => setSearchParams({ verified: 'true' })}
          className={`p-4 rounded-xl border text-left transition flex items-center justify-between shadow-xs ${
            verifiedOnly
              ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified Sales</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">Verified Registry</p>
            <p className="text-xs text-slate-400">Admin-approved & locked records</p>
          </div>
          {verifiedOnly && (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
          )}
        </button>

        {/* 3. Deleted Records */}
        <button
          type="button"
          onClick={() => setSearchParams({ deleted: 'true' })}
          className={`p-4 rounded-xl border text-left transition flex items-center justify-between shadow-xs ${
            deletedOnly
              ? 'bg-red-50/80 border-red-400 ring-2 ring-red-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 uppercase tracking-wider">
              <Trash2 className="w-3.5 h-3.5 text-red-600" />
              <span>Deleted Records</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">Deleted Records</p>
            <p className="text-xs text-slate-400">Restorable compliance audit trail</p>
          </div>
          {deletedOnly && (
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end shadow-sm">
        <div className="flex items-center gap-2 text-slate-600">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filter by:</span>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Status</label>
          <select
            value={statusFromUrl}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="BLUE">Pending Dispatch (Sales Logged)</option>
            <option value="RED">Pending Sales (Dispatch Logged)</option>
            <option value="GREEN">Confirmed Match</option>
            <option value="FLAGGED">⚠ Flagged / Unpaired</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Payment</label>
          <select
            value={filters.paymentMode}
            onChange={(e) => setFilters((f) => ({ ...f, paymentMode: e.target.value }))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Payment Modes</option>
            <option value="CC">Cash & Carry</option>
            <option value="CREDIT">Credit</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">From Date</label>
          <input type="date" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To Date</label>
          <input type="date" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={clearFilters}
          className="text-sm text-slate-500 hover:text-slate-800 underline pb-1">
          Clear All
        </button>
      </div>

      {/* Sales List Grouped by Date (Collapsible Accordion View) */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 flex justify-center shadow-sm">
            <Spinner />
          </div>
        ) : sales.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center text-slate-400 shadow-sm">
            <HelpCircle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p className="text-base font-medium text-slate-600">No sales matching the selected filters.</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting the filter date range, payment mode, or status.</p>
          </div>
        ) : (
          (() => {
            // Group sales by date
            const groups: Record<string, any[]> = {};
            let grandTotal = 0;

            sales.forEach((s: any) => {
              const rawDate = deletedOnly && s.deletedAt ? s.deletedAt : (s.saleDate || s.createdAt);
              const dateKey = rawDate ? rawDate.split('T')[0] : 'Unknown Date';
              if (!groups[dateKey]) groups[dateKey] = [];
              groups[dateKey].push(s);
              grandTotal += parseFloat(s.finalTotal) || 0;
            });

            // Sort dates descending (newest date first)
            const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

            // Sort transactions within each date group descending (newest transaction first)
            sortedDates.forEach((dateKey) => {
              groups[dateKey].sort((a, b) => {
                const timeA = new Date(a.saleDate || a.createdAt || a.deletedAt || 0).getTime();
                const timeB = new Date(b.saleDate || b.createdAt || b.deletedAt || 0).getTime();
                return timeB - timeA;
              });
            });

            const allExpanded = sortedDates.every((d) => expandedDates[d] !== false);

            const toggleAll = () => {
              const nextState: Record<string, boolean> = {};
              const target = !allExpanded;
              sortedDates.forEach((d) => {
                nextState[d] = target;
              });
              setExpandedDates(nextState);
            };

            return (
              <div className="space-y-4">
                {/* Overall Summary Bar */}
                <div className="bg-white rounded-xl border border-slate-200 p-3.5 px-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-900">
                      {sales.length} {deletedOnly ? 'deleted record' : 'transaction'}{sales.length === 1 ? '' : 's'}
                    </span>
                    <span>across</span>
                    <span className="font-semibold text-slate-900">{sortedDates.length} date group{sortedDates.length === 1 ? '' : 's'}</span>
                    <span className="text-slate-300">•</span>
                    <span>Total Volume:</span>
                    <span className="font-mono font-bold text-slate-900 text-sm">{formatCurrency(grandTotal)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                  >
                    {allExpanded ? 'Collapse All Dates' : 'Expand All Dates'}
                  </button>
                </div>

                {/* Date Accordions */}
                <div className="space-y-3">
                  {sortedDates.map((dateKey) => {
                    const groupSales = groups[dateKey];
                    const isExpanded = expandedDates[dateKey] !== false;
                    const groupTotal = groupSales.reduce((acc, s) => acc + (parseFloat(s.finalTotal) || 0), 0);

                    return (
                      <div
                        key={dateKey}
                        className={`rounded-xl border overflow-hidden shadow-xs transition ${
                          deletedOnly
                            ? 'border-red-200 bg-red-50/20'
                            : verifiedOnly
                            ? 'border-emerald-200 bg-emerald-50/20'
                            : 'border-slate-200 bg-slate-50/30'
                        }`}
                      >
                        {/* Collapsible Accordion Header */}
                        <button
                          type="button"
                          onClick={() => setExpandedDates((prev) => ({ ...prev, [dateKey]: !isExpanded }))}
                          className={`w-full flex items-center justify-between p-3.5 transition text-left select-none ${
                            deletedOnly
                              ? 'bg-red-100/60 hover:bg-red-100/80 text-red-950 border-b border-red-200/60'
                              : verifiedOnly
                              ? 'bg-emerald-100/60 hover:bg-emerald-100/80 text-emerald-950 border-b border-emerald-200/60'
                              : 'bg-slate-100/75 hover:bg-slate-200/60 text-slate-900 border-b border-slate-200/70'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 flex-wrap">
                            {isExpanded ? (
                              <ChevronDown className={`w-4 h-4 ${deletedOnly ? 'text-red-700' : verifiedOnly ? 'text-emerald-700' : 'text-slate-600'}`} />
                            ) : (
                              <ChevronRight className={`w-4 h-4 ${deletedOnly ? 'text-red-700' : verifiedOnly ? 'text-emerald-700' : 'text-slate-600'}`} />
                            )}
                            <Calendar className={`w-4 h-4 ${deletedOnly ? 'text-red-700' : verifiedOnly ? 'text-emerald-700' : 'text-blue-600'}`} />
                            <span className="text-sm font-bold tracking-tight">
                              {dateKey !== 'Unknown Date' ? formatDate(dateKey) : 'Unknown Date'}
                            </span>
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                                deletedOnly
                                  ? 'bg-red-200/80 text-red-800'
                                  : verifiedOnly
                                  ? 'bg-emerald-200/80 text-emerald-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {groupSales.length} {deletedOnly ? 'deleted record' : verifiedOnly ? 'verified sale' : 'sale'}{groupSales.length === 1 ? '' : 's'}
                            </span>
                          </div>

                          <div className="text-right text-xs">
                            <span className="text-slate-400 font-normal mr-1.5 hidden sm:inline">Day Total:</span>
                            <span
                              className={`font-mono font-bold text-sm ${
                                deletedOnly ? 'text-red-700' : verifiedOnly ? 'text-emerald-800' : 'text-slate-900'
                              }`}
                            >
                              {formatCurrency(groupTotal)}
                            </span>
                          </div>
                        </button>

                        {/* Collapsible Content: Transaction Cards / Rows */}
                        {isExpanded && (
                          <div className={`divide-y bg-white ${deletedOnly ? 'divide-red-100' : verifiedOnly ? 'divide-emerald-100' : 'divide-slate-100'}`}>
                            {groupSales.map((sale: any) => {
                              const sb = sale.deletedAt
                                ? { variant: 'red', label: `Deleted by ${sale.deletedBy?.name || 'Staff'}` }
                                : sale.status === 'FLAGGED'
                                ? {
                                    variant: 'orange',
                                    label: sale.workerAId && sale.workerBId
                                      ? 'Mismatch Flagged'
                                      : sale.workerBId
                                        ? 'Dispatch Awaiting Sales'
                                        : sale.paymentMode === 'CREDIT'
                                          ? 'Credit Awaiting Dispatch'
                                          : 'Sales Awaiting Dispatch',
                                  }
                                : STATUS_BADGE[sale.status] || { variant: 'gray', label: sale.status };

                              return (
                                <div
                                  key={sale.id}
                                  onClick={() => { setSelectedSale(sale); setEditingSale(false); }}
                                  className={`p-3.5 hover:bg-slate-50/80 transition flex flex-col lg:flex-row lg:items-center justify-between gap-3 cursor-pointer ${
                                    sale.deletedAt
                                      ? 'hover:bg-red-50/40 bg-red-50/15'
                                      : sale.status === 'FLAGGED'
                                      ? 'hover:bg-amber-50/50 bg-amber-50/20'
                                      : sale.adminVerified
                                      ? 'hover:bg-emerald-50/30 bg-emerald-50/10'
                                      : ''
                                  }`}
                                >
                                  {/* Left: Transaction details */}
                                  <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono font-bold text-slate-800 text-sm">#{sale.id}</span>
                                      <span className="text-xs text-slate-400 font-medium">
                                        {formatDateTime(sale.saleDate || sale.createdAt)}
                                      </span>
                                      <Badge variant={sb.variant}>{sb.label}</Badge>
                                      {sale.adminVerified && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[11px] font-bold border border-emerald-300">
                                          <CheckCircle className="w-3 h-3 text-emerald-600" /> Admin Verified
                                        </span>
                                      )}
                                      <span className="text-slate-600 font-medium px-2 py-0.5 bg-slate-100 rounded text-[11px] border border-slate-200">
                                        {sale.saleType}
                                      </span>
                                      {!sale.deletedAt && sale.workerBId && !sale.workerAId ? (
                                        <Badge variant="yellow">Awaiting Sales</Badge>
                                      ) : (
                                        <Badge variant={sale.paymentMode === 'CC' ? 'green' : 'orange'}>
                                          {sale.paymentMode === 'CC' ? 'Cash & Carry' : 'Credit'}
                                        </Badge>
                                      )}
                                    </div>

                                    {/* Customer name and phone */}
                                    <div className="text-xs text-slate-700 flex flex-wrap items-center gap-2">
                                      <span className="font-bold text-slate-900 text-sm">{sale.customer?.name}</span>
                                      <span className="text-slate-300">•</span>
                                      <span className="text-slate-500 font-medium">{sale.customer?.phone || 'No phone'}</span>
                                    </div>

                                    {/* Items purchased */}
                                    <div className="text-xs text-slate-600 line-clamp-1">
                                      <span className="font-semibold text-slate-700">{sale.saleItems?.length || 0} item(s): </span>
                                      <span className="text-slate-500">
                                        {sale.saleItems?.map((i: any) => `${i.quantity}x ${i.product?.name || `Item #${i.productId}`}`).join(', ')}
                                      </span>
                                    </div>

                                    {/* Staff info */}
                                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                                      {sale.workerA && (
                                        <span className="inline-flex items-center gap-1">
                                          <span className="text-blue-600 font-semibold">Sales:</span> {sale.workerA.name}
                                        </span>
                                      )}
                                      {sale.workerB && (
                                        <span className="inline-flex items-center gap-1">
                                          <span className="text-amber-600 font-semibold">Dispatch:</span> {sale.workerB.name}
                                        </span>
                                      )}
                                      {!sale.workerA && !sale.workerB && (
                                        <span className="text-slate-400">Admin Entry</span>
                                      )}
                                      {sale.deletedAt && (
                                        <span className="text-red-600 font-medium">
                                          Deleted by {sale.deletedBy?.name || 'Staff'} ({formatDateTime(sale.deletedAt)})
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right: Final Total & Action Buttons */}
                                  <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                                    <div className="text-left lg:text-right">
                                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Final Total</span>
                                      <span className="font-extrabold text-base text-slate-900 font-mono">
                                        {!sale.deletedAt && sale.workerBId && !sale.workerAId
                                          ? '—'
                                          : formatCurrency(parseFloat(sale.finalTotal))}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                      {/* Verify button for Confirmed Sales */}
                                      {!deletedOnly && sale.status === 'GREEN' && !sale.adminVerified && (
                                        <button
                                          type="button"
                                          disabled={verifyMutation.isPending}
                                          onClick={() => verifyMutation.mutate(sale.id)}
                                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-xs disabled:opacity-50"
                                          title="Verify confirmed sale and move to verified page"
                                        >
                                          <ShieldCheck className="w-3.5 h-3.5" /> Verify
                                        </button>
                                      )}

                                      {/* Unverify button on Verified view */}
                                      {verifiedOnly && sale.adminVerified && (
                                        <button
                                          type="button"
                                          disabled={unverifyMutation.isPending}
                                          onClick={() => unverifyMutation.mutate(sale.id)}
                                          className="px-2 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium flex items-center gap-1 transition disabled:opacity-50"
                                          title="Move back to unverified queue"
                                        >
                                          <RotateCcw className="w-3 h-3 text-slate-500" /> Unverify
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => { setSelectedSale(sale); setEditingSale(false); }}
                                        className="px-2.5 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-semibold flex items-center gap-1 border border-blue-200 transition"
                                      >
                                        <Eye className="w-3.5 h-3.5" /> View
                                      </button>

                                      {deletedOnly && (
                                        <>
                                          <button
                                            type="button"
                                            disabled={restoreSaleMutation.isPending}
                                            onClick={() => restoreSaleMutation.mutate(sale.id)}
                                            className="px-2.5 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-xs disabled:opacity-50"
                                          >
                                            <RotateCcw className="w-3.5 h-3.5" /> Restore
                                          </button>
                                          <button
                                            type="button"
                                            disabled={permanentDeleteMutation.isPending}
                                            onClick={() => { setSelectedSale(sale); setShowPermanentDeleteModal(true); }}
                                            className="px-2.5 py-1.5 bg-red-600 text-white hover:bg-red-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-xs disabled:opacity-50"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" /> Hard Delete
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <Modal title={`Sale #${selectedSale.id} Details`} onClose={() => { setSelectedSale(null); setEditingSale(false); }} size="xl">
          <div className="space-y-5">
            {/* Flagged Alert Banner */}
            {selectedSale.deletedAt && (
              <div className="bg-red-50 border border-red-300 rounded-xl p-4">
                <p className="font-bold text-sm text-red-900">
                  {selectedSale.workerBId && !selectedSale.workerAId ? 'Dispatch deleted' : selectedSale.workerAId && !selectedSale.workerBId ? 'Sales entry deleted' : 'Sale deleted'}
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Deleted by {selectedSale.deletedBy?.name || 'staff'} ({selectedSale.deletedByRole || selectedSale.deletedBy?.role || 'unknown role'}) at {formatDateTime(selectedSale.deletedAt)}. Stock was restored when this record had deducted inventory.
                </p>
              </div>
            )}
            {selectedSale.status === 'FLAGGED' && (
              <div className="bg-orange-50 border border-orange-300 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div className="text-sm text-orange-900">
                  <p className="font-bold">
                    {selectedSale.workerAId && selectedSale.workerBId
                      ? 'Entry Discrepancy Detected'
                      : selectedSale.workerBId
                        ? 'Unmatched Dispatch Entry'
                        : selectedSale.paymentMode === 'CREDIT'
                          ? 'Unconfirmed Credit Sale'
                          : 'Unmatched Sales Entry'}
                  </p>
                  <p className="text-xs text-orange-700 mt-0.5">
                    {selectedSale.workerAId && selectedSale.workerBId
                      ? 'The Sales Desk and Dispatch entered conflicting details for this sale. Compare the entries below.'
                      : selectedSale.workerBId
                        ? 'This dispatch was entered without a matching Sales Desk entry. Review it and follow up with the Sales Desk.'
                        : selectedSale.paymentMode === 'CREDIT'
                          ? 'This credit sale is not a confirmed debt yet. It remains flagged until Dispatch confirms it.'
                          : 'This sales entry is waiting for a matching Dispatch entry.'}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm p-4 bg-slate-50 rounded-xl">
              <div><span className="text-slate-400 text-xs block">Customer</span> <strong>{selectedSale.customer?.name}</strong></div>
              <div><span className="text-slate-400 text-xs block">Date & Time</span> {formatDateTime(selectedSale.saleDate)}</div>
              <div><span className="text-slate-400 text-xs block">Payment Mode</span> <strong>{!selectedSale.workerAId && selectedSale.workerBId && !selectedSale.deletedAt ? 'Awaiting Sales Desk' : selectedSale.paymentMode === 'CC' ? 'Cash & Carry' : 'Credit (Owed)'}</strong></div>
              <div><span className="text-slate-400 text-xs block">Sale Type</span> <strong>{selectedSale.saleType}</strong></div>
            </div>

            {/* Active Items Table */}
            <div>
              <h4 className="font-semibold text-slate-700 mb-2">Recorded Sale Items</h4>
              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50">
                  <tr>
                    {[
                      'Product',
                      'Qty',
                      ...(!selectedSale.workerAId && selectedSale.workerBId && !selectedSale.deletedAt ? [] : ['Unit Price', 'Subtotal']),
                    ].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedSale.saleItems?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 font-medium">
                        {item.product?.name || `Product #${item.productId}`}
                      </td>
                      <td className="px-3 py-2">{item.quantity}</td>
                      {!selectedSale.workerAId && selectedSale.workerBId && !selectedSale.deletedAt ? null : (
                        <>
                          <td className="px-3 py-2">{formatCurrency(parseFloat(item.unitPrice))}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{formatCurrency(parseFloat(item.subtotal))}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedSale.workerAId || !selectedSale.workerBId || selectedSale.deletedAt ? (
            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              <div className="text-sm space-y-1">
                <p><span className="text-slate-500">Original Total:</span> {formatCurrency(parseFloat(selectedSale.originalTotal))}</p>
                {parseFloat(selectedSale.discountAmount) > 0 && (
                  <p><span className="text-slate-500">Discount:</span> -{formatCurrency(parseFloat(selectedSale.discountAmount))}</p>
                )}
                <p className="font-bold text-lg"><span className="text-slate-500 font-normal">Final Total:</span> {formatCurrency(parseFloat(selectedSale.finalTotal))}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedSale.deletedAt ? (
                  <>
                    <button
                      type="button"
                      onClick={() => restoreSaleMutation.mutate(selectedSale.id)}
                      disabled={restoreSaleMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-semibold disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" /> Restore Sale
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPermanentDeleteModal(true)}
                      disabled={permanentDeleteMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Permanently
                    </button>
                  </>
                ) : (
                  <>
                    {!editingSale && (
                      <button
                        onClick={beginSaleEdit}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-semibold"
                      >
                        <Pencil className="w-4 h-4" /> Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowDeleteModal(true)}
                      disabled={deleteSaleMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition text-sm font-semibold disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                    {selectedSale.status === 'GREEN' && !selectedSale.adminVerified && (
                      <button
                        onClick={() => verifyMutation.mutate(selectedSale.id)}
                        disabled={verifyMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-semibold disabled:opacity-50"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Verify Sale
                      </button>
                    )}
                    {selectedSale.adminVerified && (
                      <button
                        onClick={() => unverifyMutation.mutate(selectedSale.id)}
                        disabled={unverifyMutation.isPending}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-semibold disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Unverify Sale
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
            ) : (
              <p className="text-xs text-slate-500 border-t pt-2">
                Dispatch record only. Sales Desk pricing and payment details will appear after a matching entry is submitted.
              </p>
            )}

            {editingSale && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data: { notes: string; discountAmount?: number; saleType?: string } = {
                    notes: saleEditForm.notes,
                  };
                  if (selectedSale.status === 'GREEN') {
                    data.discountAmount = Number(saleEditForm.discountAmount);
                    data.saleType = saleEditForm.saleType;
                  }
                  updateSaleMutation.mutate({ id: selectedSale.id, data });
                }}
                className="border border-blue-200 bg-blue-50/50 rounded-xl p-4 space-y-3"
              >
                <h4 className="font-semibold text-slate-800 text-sm">Edit sale record</h4>
                {selectedSale.status === 'GREEN' && (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs font-medium text-slate-600">
                      Discount (GH₵)
                      <input required type="number" min="0" step="0.01"
                        value={saleEditForm.discountAmount}
                        onChange={(e) => setSaleEditForm((form) => ({ ...form, discountAmount: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      Sale type
                      <select value={saleEditForm.saleType}
                        onChange={(e) => setSaleEditForm((form) => ({ ...form, saleType: e.target.value }))}
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        <option value="WHOLESALE">Wholesale</option>
                        <option value="RETAIL">Retail</option>
                      </select>
                    </label>
                  </div>
                )}
                <label className="block text-xs font-medium text-slate-600">
                  Notes
                  <textarea rows={2} value={saleEditForm.notes}
                    onChange={(e) => setSaleEditForm((form) => ({ ...form, notes: e.target.value }))}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingSale(false)}
                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm">Cancel</button>
                  <button type="submit" disabled={updateSaleMutation.isPending}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-60">
                    {updateSaleMutation.isPending ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </form>
            )}

            {/* Sales Desk vs Dispatch side-by-side comparison */}
            {(selectedSale.workerAData || selectedSale.workerBData) && (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Dual-Audit Log Breakdown
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Sales Desk */}
                  <div className="bg-white border border-blue-200 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center border-b pb-1.5">
                      <span className="font-bold text-xs text-blue-700">Sales Desk</span>
                      <span className="text-[11px] text-slate-400">{selectedSale.workerA?.name || 'Logged'}</span>
                    </div>
                    {selectedSale.workerAData ? (
                      <div className="text-xs space-y-1.5">
                        <p><span className="text-slate-400">Sale Type:</span> <strong>{selectedSale.workerAData.saleType}</strong></p>
                        <p><span className="text-slate-400">Payment:</span> <strong>{selectedSale.workerAData.paymentMode === 'CC' ? 'Cash & Carry' : 'Credit'}</strong></p>
                        <p><span className="text-slate-400">Discount:</span> {formatCurrency(selectedSale.workerAData.discountAmount || 0)}</p>
                        <div className="border-t pt-1.5">
                          <p className="font-semibold text-slate-600 mb-1">Items:</p>
                          <ul className="space-y-1">
                            {selectedSale.workerAData.items?.map((item: any, idx: number) => (
                              <li key={idx} className="flex justify-between bg-slate-50 px-2 py-1 rounded">
                                <span>Item #{item.productId}</span>
                                <span className="font-semibold">{item.quantity} pcs @ {formatCurrency(item.unitPrice)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No entry submitted yet by Sales Desk</p>
                    )}
                  </div>

                  {/* Dispatch */}
                  <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center border-b pb-1.5">
                      <span className="font-bold text-xs text-amber-700">Dispatch</span>
                      <span className="text-[11px] text-slate-400">{selectedSale.workerB?.name || 'Logged'}</span>
                    </div>
                    {selectedSale.workerBData ? (
                      <div className="text-xs space-y-1.5">
                        <p><span className="text-slate-400">Issue Type:</span> <strong>{selectedSale.workerBData.saleType}</strong></p>
                        <p><span className="text-slate-400">Payment:</span> <strong>{selectedSale.workerBData.paymentMode === 'CC' ? 'Cash & Carry' : 'Credit'}</strong></p>
                        <div className="border-t pt-1.5">
                          <p className="font-semibold text-slate-600 mb-1">Items:</p>
                          <ul className="space-y-1">
                            {selectedSale.workerBData.items?.map((item: any, idx: number) => (
                              <li key={idx} className="flex justify-between bg-slate-50 px-2 py-1 rounded">
                                <span>Item #{item.productId}</span>
                                <span className="font-semibold">{item.quantity} pcs</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No entry submitted yet by Dispatch Desk</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() => {
          if (selectedSale) {
            deleteSaleMutation.mutate(selectedSale.id);
            setShowDeleteModal(false);
          }
        }}
        title="Delete Sale Record"
        itemName={selectedSale ? `Sale #${selectedSale.id}` : undefined}
        message="Are you sure you want to delete this sale? Its details will be retained for review, and any deducted stock will be safely restored."
        loading={deleteSaleMutation.isPending}
      />

      <DeleteConfirmModal
        isOpen={showPermanentDeleteModal}
        onClose={() => setShowPermanentDeleteModal(false)}
        onConfirm={() => {
          if (selectedSale) {
            permanentDeleteMutation.mutate(selectedSale.id);
          }
        }}
        title="Permanently Delete Sale"
        itemName={selectedSale ? `Sale #${selectedSale.id}` : undefined}
        message="DANGER: This action cannot be undone. This sale, all its line items, ledger entries, and audit references will be permanently wiped from the database."
        loading={permanentDeleteMutation.isPending}
      />
    </div>
  );
}
