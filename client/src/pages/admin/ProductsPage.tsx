import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, RefreshCw, Package, Search, Image as ImageIcon, X } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, getProductImageUrl, compressImageFile } from '../../lib/utils';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
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

function RestockModal({ product, onClose }: { product: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/products/${product.id}/restock`, {
        quantity: parseInt(qty),
        notes: notes.trim() || undefined,
      });
      toast.success(`Restocked ${qty} units for ${product.name}`);
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['products-catalog'] });
      qc.invalidateQueries({ queryKey: ['products-catalog-b'] });
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] });
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
            placeholder="e.g., New stock shipment received from supplier"
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
            {loading ? 'Restocking...' : 'Confirm Restock'}
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products</h1>
          <p className="text-slate-500 text-sm">Manage your product inventory</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Product
        </button>
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
                        {p.quantity} left
                      </span>
                    </div>
                    {p.brand && <p className="text-xs text-slate-400 mb-1">{p.brand}</p>}
                    <p className="text-xs text-blue-600 font-medium mb-2">{p.category}</p>
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
                      <button onClick={() => { if (confirm('Delete this product?')) deleteMutation.mutate(p.id); }}
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
      {restockProduct && <RestockModal product={restockProduct} onClose={() => setRestockProduct(null)} />}
    </div>
  );
}
