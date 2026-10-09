import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, CheckCircle, Filter, AlertTriangle, ShieldCheck, HelpCircle, Pencil, Trash2 } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
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
  const [editingSale, setEditingSale] = useState(false);
  const [saleEditForm, setSaleEditForm] = useState({ notes: '', discountAmount: '', saleType: 'WHOLESALE' });
  
  const statusFromUrl = searchParams.get('status') || '';
  const deletedOnly = searchParams.get('deleted') === 'true';
  const selectedSaleId = Number(searchParams.get('saleId'));
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    paymentMode: '',
  });

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales', filters, statusFromUrl, deletedOnly],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries({ ...filters, status: statusFromUrl, deleted: deletedOnly ? 'true' : '' }).filter(([, v]) => v)
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
      toast.success('Sale marked as verified by admin');
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setSelectedSale(null);
    },
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Transactions</h1>
          <p className="text-slate-500 text-sm">Full audit trail and dual-confirmation verification</p>
          {deletedOnly && (
            <p className="text-xs text-red-700 mt-1 font-semibold">Showing retained deleted records. Select “All records” to return to current sales.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSearchParams(deletedOnly ? {} : { deleted: 'true' })}
          className={`px-3 py-2 rounded-lg text-sm font-semibold border ${deletedOnly ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-red-50 text-red-700 border-red-200'}`}
        >
          {deletedOnly ? 'All records' : 'View deleted records'}
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : sales.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <HelpCircle className="w-12 h-12 mx-auto mb-2 text-slate-300" />
            <p>No sales matching the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['#', 'Date & Time', 'Customer', 'Items Summary', 'Final Total', 'Payment', 'Type', 'Verification Status', 'Staff Logged', 'Inspect'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((sale: any) => {
                  const sb = sale.deletedAt
                    ? { variant: 'red', label: `Deleted by ${sale.deletedBy?.name || 'staff'}` }
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
                    <tr
                      key={sale.id}
                      onClick={() => setSelectedSale(sale)}
                      className={`hover:bg-slate-50 transition cursor-pointer ${sale.deletedAt ? 'bg-red-50/50' : sale.status === 'FLAGGED' ? 'bg-orange-50/40' : ''}`}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-slate-600">#{sale.id}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDateTime(sale.saleDate)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{sale.customer?.name}</p>
                        <p className="text-xs text-slate-400">{sale.customer?.phone || 'No phone'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {sale.saleItems?.length} item(s)
                        <span className="text-xs text-slate-400 block truncate max-w-xs">
                          {sale.saleItems?.map((i: any) =>
                            `${i.quantity}x ${i.product?.name || `Item #${i.productId}`}`
                          ).join(', ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {!sale.deletedAt && sale.workerBId && !sale.workerAId ? '—' : formatCurrency(parseFloat(sale.finalTotal))}
                      </td>
                      <td className="px-4 py-3">
                        {!sale.deletedAt && sale.workerBId && !sale.workerAId ? (
                          <Badge variant="yellow">Awaiting Sales entry</Badge>
                        ) : (
                          <Badge variant={sale.paymentMode === 'CC' ? 'green' : 'orange'}>
                            {sale.paymentMode === 'CC' ? 'Cash & Carry' : 'Credit'}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs font-medium">{sale.saleType}</td>
                      <td className="px-4 py-3"><Badge variant={sb.variant}>{sb.label}</Badge></td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {sale.workerA && <div><span className="font-semibold text-blue-600">Sales:</span> {sale.workerA.name}</div>}
                        {sale.workerB && <div><span className="font-semibold text-amber-600">Dispatch:</span> {sale.workerB.name}</div>}
                        {!sale.workerA && !sale.workerB && <span>Admin Entry</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedSale(sale); setEditingSale(false); }}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
              <div className="flex gap-2">
                {!editingSale && !selectedSale.deletedAt && (
                  <button
                    onClick={beginSaleEdit}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm font-semibold"
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                )}
                {!selectedSale.deletedAt && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete this sale? Its details will be retained for review and deducted stock will be restored.')) {
                        deleteSaleMutation.mutate(selectedSale.id);
                      }
                    }}
                    disabled={deleteSaleMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition text-sm font-semibold disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
                {selectedSale.status === 'GREEN' && !selectedSale.adminVerified && (
                  <button
                    onClick={() => verifyMutation.mutate(selectedSale.id)}
                    disabled={verifyMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-semibold"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Verify Sale
                  </button>
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
    </div>
  );
}
