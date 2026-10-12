import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, RefreshCw, Package, Search, Image as ImageIcon, X, Check, ClipboardCheck, Clock } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, formatDateTime, getProductImageUrl, compressImageFile } from '../../lib/utils';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import DeleteConfirmModal from '../../components/ui/DeleteConfirmModal';
import toast from 'react-hot-toast';

function ProductFormModal({ product, onClose }: { product?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: product?.name || '',
    brand: product?.brand || '',
    category: product?.category || '',
    price: product?.price?.toString() || '',
    quantity: product?.quantity?.toString() || '',
    description: product?.description || '',
  });
  const [imageBase64, setImageBase64] = useState<string | null>(product?.imageUrl || null);
  const [preview, setPreview] = useState(getProductImageUrl(product?.imageUrl) || '');
  const [loading, setLoading] = useState(false);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImageFile(file, 600, 0.8);
        setImageBase64(compressed);
        setPreview(compressed);
      } catch (err) {
        toast.error('Failed to process image file');
      }
    }
  };

  const removeImage = () => {
    setImageBase64('');
    setPreview('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        brand: form.brand.trim() || undefined,
        category: form.category.trim(),
        price: parseFloat(form.price),
        quantity: parseInt(form.quantity, 10) || 0,
        description: form.description.trim() || undefined,
        imageUrl: imageBase64 || null,
      };

      if (product) {
        await api.put(`/products/${product.id}`, payload);
        toast.success('Product updated successfully');
      } else {
        await api.post('/products', payload);
        toast.success('Product added successfully');
      }
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['products-catalog'] });
      qc.invalidateQueries({ queryKey: ['products-catalog-b'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={product ? 'Edit Product' : 'Add Product'} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Classic Singlet"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Brand</label>
            <input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              placeholder="e.g. ProWear"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
            <input required value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="e.g. Singlets"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Price (GH₵) *</label>
            <input required type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="e.g. 65.00"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Quantity in Stock *</label>
            <input required type="number" min="0" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              placeholder="e.g. 100"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2}
            placeholder="Optional product details..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Product Photo</label>
          {preview ? (
            <div className="relative inline-block mt-1">
              <img src={preview} alt="preview" className="w-28 h-28 object-cover rounded-xl border border-slate-200 shadow-sm" />
              <button
                type="button"
                onClick={removeImage}
                title="Remove image"
                className="absolute -top-2 -right-2 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-md transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 cursor-pointer bg-slate-50 hover:bg-blue-50/40 transition">
              <ImageIcon className="w-6 h-6 text-slate-400 mb-1" />
              <span className="text-xs text-slate-600 font-medium">Click to upload product photo</span>
              <span className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WEBP (auto-optimized)</span>
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={loading} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
            {loading ? 'Saving...' : product ? 'Update Product' : 'Add Product'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RestockModal({ product, workerMode = false, onClose }: { product: any; workerMode?: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post(`/products/${product.id}/restock`, {
        quantity: parseInt(qty),
        notes: notes.trim() || undefined,
      });
      if (res.data?.pendingApproval) {
        toast.success(res.data?.message || `Restock request of ${qty} units submitted to Admin for verification.`);
      } else {
        toast.success(res.data?.message || `Restocked ${qty} units for ${product.name}`);
      }
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['products-catalog'] });
      qc.invalidateQueries({ queryKey: ['products-catalog-b'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
      qc.invalidateQueries({ queryKey: ['restock-requests'] });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Restock failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Restock Inventory: ${product.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Notice for Worker Mode */}
        {workerMode && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
            ℹ️ <strong>Admin Review Required:</strong> When you submit this restock, the Admin receives an instant notification to review and confirm the goods before they are added to valid inventory.
          </div>
        )}

        {/* Product Details */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Category & Brand:</span>
            <span className="font-semibold text-slate-800">{product.category} {product.brand ? `(${product.brand})` : ''}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Current Stock in Shop:</span>
            <span className="font-bold text-blue-700 text-sm">{product.quantity} units</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Units to Add *</label>
          <input
            required
            type="number"
            min="1"
            placeholder="e.g. 50"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Restock Notes <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="e.g., Supplier package received; 5 boxes added"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-60"
          >
            {loading ? 'Submitting...' : workerMode ? 'Submit for Review' : 'Confirm Restock'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProductsPage({ workerMode = false }: { workerMode?: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [restockProduct, setRestockProduct] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [showRestockModal, setShowRestockModal] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', search, category],
    queryFn: async () => {
      const res = await api.get('/products', { params: { search: search || undefined, category: category || undefined } });
      return res.data.data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const res = await api.get('/products/categories');
      return res.data.data;
    },
  });

  const { data: restockRequests = [] } = useQuery({
    queryKey: ['restock-requests'],
    queryFn: async () => {
      const res = await api.get('/products/restock-requests');
      return res.data.data;
    },
    refetchInterval: 10000,
  });

  const pendingRestockCount = restockRequests.filter((r: any) => r.status === 'PENDING').length;

  const approveRestockMutation = useMutation({
    mutationFn: (id: number) => api.post(`/products/restock-requests/${id}/approve`),
    onSuccess: (res: any) => {
      toast.success(res.data?.message || 'Restock confirmed and applied to inventory!');
      qc.invalidateQueries({ queryKey: ['restock-requests'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['products-catalog'] });
      qc.invalidateQueries({ queryKey: ['products-catalog-b'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to approve restock'),
  });

  const rejectRestockMutation = useMutation({
    mutationFn: (id: number) => api.post(`/products/restock-requests/${id}/reject`),
    onSuccess: (res: any) => {
      toast.success(res.data?.message || 'Restock request rejected');
      qc.invalidateQueries({ queryKey: ['restock-requests'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to reject restock'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/products/${id}`),
    onSuccess: () => {
      toast.success('Product deleted');
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['products-catalog'] });
      qc.invalidateQueries({ queryKey: ['products-catalog-b'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to delete'),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products</h1>
          <p className="text-slate-500 text-sm">
            {workerMode
              ? 'View inventory and submit stock replenishment requests'
              : 'Manage products, inventory levels, and review worker restocks'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!workerMode && (
            <button
              onClick={() => setShowRestockModal(true)}
              className="relative flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg transition text-xs sm:text-sm font-semibold shadow-xs"
            >
              <ClipboardCheck className="w-4 h-4 text-amber-700" />
              <span>Review Worker Restocks</span>
              {pendingRestockCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white font-bold text-xs animate-pulse">
                  {pendingRestockCount}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..." className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Categories</option>
          {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No products found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((p: any) => {
            const imgUrl = getProductImageUrl(p.imageUrl);
            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition flex flex-col justify-between">
                <div>
                  {imgUrl ? (
                    <img src={imgUrl} alt={p.name} className="w-full h-44 object-cover" />
                  ) : (
                    <div className="w-full h-44 bg-slate-100 flex items-center justify-center">
                      <Package className="w-12 h-12 text-slate-300" />
                    </div>
                  )}
                  <div className="p-4 pb-2">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-slate-800 text-sm leading-tight">{p.name}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.quantity <= 5 ? 'bg-red-100 text-red-700' : p.quantity <= 15 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                        {p.quantity} in stock
                      </span>
                    </div>
                    {p.brand && <p className="text-xs text-slate-400 mb-1">{p.brand}</p>}
                    <p className="text-xs text-blue-600 font-medium mb-2">{p.category}</p>

                    {/* Worker A & Worker B independent live stock preview for Admin */}
                    {!workerMode && (p.pendingSalesQty > 0 || p.pendingDispatchQty > 0) && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[11px] space-y-1 mb-2">
                        <div className="flex justify-between text-slate-600">
                          <span>Sales Desk (Worker A):</span>
                          <strong className="text-blue-700">{p.availableForSales ?? p.quantity} left</strong>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span>Dispatch (Worker B):</span>
                          <strong className="text-amber-700">{p.availableForDispatch ?? p.quantity} left</strong>
                        </div>
                      </div>
                    )}

                    <p className="text-lg font-bold text-slate-800 mb-1">{formatCurrency(parseFloat(p.price))}</p>
                    {p.description && <p className="text-xs text-slate-500 line-clamp-2 mb-2">{p.description}</p>}
                  </div>
                </div>
                <div className="p-4 pt-0">
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button onClick={() => setRestockProduct(p)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-green-200 text-green-700 text-xs rounded-lg hover:bg-green-50 transition">
                      <RefreshCw className="w-3 h-3" /> Restock
                    </button>
                    <button onClick={() => setEditProduct(p)}
                      className="p-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    {!workerMode && (
                      <button onClick={() => setDeleteTarget(p)}
                        className="p-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <ProductFormModal onClose={() => setShowAdd(false)} />}
      {editProduct && <ProductFormModal product={editProduct} onClose={() => setEditProduct(null)} />}
      {restockProduct && <RestockModal product={restockProduct} workerMode={workerMode} onClose={() => setRestockProduct(null)} />}

      {/* Admin Restock Review Modal */}
      {showRestockModal && (
        <Modal title="Restock Approval & Review Queue" onClose={() => setShowRestockModal(false)} size="xl">
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              When sales workers or dispatch staff enter stock arrivals, they are held in this queue. Review the items and click <strong>Approve</strong> to validate and add the quantities into official store inventory.
            </p>

            {restockRequests.length === 0 ? (
              <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                <ClipboardCheck className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">No restock requests recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {restockRequests.map((req: any) => {
                  const isPending = req.status === 'PENDING';
                  return (
                    <div
                      key={req.id}
                      className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isPending
                          ? 'bg-amber-50/60 border-amber-200'
                          : req.status === 'APPROVED'
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {req.product?.name || `Product #${req.productId}`}
                          </span>
                          <Badge variant={isPending ? 'yellow' : req.status === 'APPROVED' ? 'green' : 'gray'}>
                            {req.status}
                          </Badge>
                          <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            +{req.quantity} units
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Submitted by <strong className="text-slate-800">{req.worker?.name}</strong> ({req.worker?.role}) at {formatDateTime(req.createdAt)}
                        </div>
                        {req.notes && (
                          <div className="text-xs text-slate-700 italic bg-white/70 p-2 rounded border border-slate-200">
                            "{req.notes}"
                          </div>
                        )}
                        {req.reviewedBy && (
                          <div className="text-[11px] text-slate-500">
                            Reviewed by {req.reviewedBy.name} at {formatDateTime(req.reviewedAt)}
                          </div>
                        )}
                      </div>

                      {isPending && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={approveRestockMutation.isPending}
                            onClick={() => approveRestockMutation.mutate(req.id)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve & Update Stock
                          </button>
                          <button
                            type="button"
                            disabled={rejectRestockMutation.isPending}
                            onClick={() => rejectRestockMutation.mutate(req.id)}
                            className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition disabled:opacity-50 flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
        title="Delete Product"
        itemName={deleteTarget?.name}
        message="Are you sure you want to deactivate and remove this product from inventory?"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
