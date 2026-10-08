import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, RefreshCw, Package, Search } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency } from '../../lib/utils';
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
    colours: (product?.colours as string[]) || [],
    sizes: (product?.sizes as string[]) || [],
  });
  const [colourInput, setColourInput] = useState('');
  const [sizeInput, setSizeInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState(product?.imageUrl ? `/uploads/${product.imageUrl}` : '');
  const [loading, setLoading] = useState(false);

  const addTag = (field: 'colours' | 'sizes', value: string) => {
    if (!value.trim()) return;
    setForm((f) => ({ ...f, [field]: [...f[field], value.trim()] }));
    if (field === 'colours') setColourInput('');
    else setSizeInput('');
  };
  const removeTag = (field: 'colours' | 'sizes', idx: number) => {
    setForm((f) => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (Array.isArray(v)) fd.append(k, JSON.stringify(v));
        else fd.append(k, v as string);
      });
      if (image) fd.append('image', image);

      if (product) {
        await api.put(`/products/${product.id}`, fd);
        toast.success('Product updated');
      } else {
        await api.post('/products', fd);
        toast.success('Product added');
      }
      qc.invalidateQueries({ queryKey: ['products'] });
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
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Brand</label>
            <input value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Category *</label>
            <input required value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Price (GH₵) *</label>
            <input required type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Quantity *</label>
            <input required type="number" min="0" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Colours */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Colours</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {form.colours.map((c, i) => (
              <span key={i} className="bg-slate-100 text-slate-700 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                {c}<button type="button" onClick={() => removeTag('colours', i)} className="text-slate-400 hover:text-red-500">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={colourInput} onChange={(e) => setColourInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('colours', colourInput))}
              placeholder="Type colour + Enter" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="button" onClick={() => addTag('colours', colourInput)}
              className="px-3 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200">Add</button>
          </div>
        </div>

        {/* Sizes */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sizes</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {form.sizes.map((s, i) => (
              <span key={i} className="bg-slate-100 text-slate-700 px-2 py-1 rounded-full text-xs flex items-center gap-1">
                {s}<button type="button" onClick={() => removeTag('sizes', i)} className="text-slate-400 hover:text-red-500">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={sizeInput} onChange={(e) => setSizeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('sizes', sizeInput))}
              placeholder="Type size + Enter" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="button" onClick={() => addTag('sizes', sizeInput)}
              className="px-3 py-2 bg-slate-100 rounded-lg text-sm hover:bg-slate-200">Add</button>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {/* Image */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Product Image</label>
          <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm" />
          {preview && <img src={preview} alt="preview" className="mt-2 w-24 h-24 object-cover rounded-lg border border-slate-200" />}
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
        {/* Product Variant Details */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Category & Brand:</span>
            <span className="font-semibold text-slate-800">{product.category} {product.brand ? `(${product.brand})` : ''}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Current Stock in Shop:</span>
            <span className="font-bold text-blue-700 text-sm">{product.quantity} units</span>
          </div>
          {product.sizes && product.sizes.length > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Registered Sizes:</span>
              <span className="font-medium text-slate-700">{product.sizes.join(', ')}</span>
            </div>
          )}
          {product.colours && product.colours.length > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Registered Colours:</span>
              <span className="font-medium text-slate-700">{product.colours.join(', ')}</span>
            </div>
          )}
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
            Restock Notes / Variant Breakdown <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="e.g., Added 25 pcs Size M (Black), 25 pcs Size L (White)"
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
    onSuccess: () => { toast.success('Product deleted'); qc.invalidateQueries({ queryKey: ['products'] }); },
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
          {products.map((p: any) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition">
              {p.imageUrl ? (
                <img src={`${import.meta.env.VITE_API_URL?.replace('/api', '')}/uploads/products/${p.imageUrl}`}
                  alt={p.name} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-slate-100 flex items-center justify-center">
                  <Package className="w-12 h-12 text-slate-300" />
                </div>
              )}
              <div className="p-4">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-slate-800 text-sm leading-tight">{p.name}</h3>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.quantity <= 5 ? 'bg-red-100 text-red-700' : p.quantity <= 15 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                    {p.quantity} left
                  </span>
                </div>
                {p.brand && <p className="text-xs text-slate-400 mb-1">{p.brand}</p>}
                <p className="text-xs text-blue-600 font-medium mb-2">{p.category}</p>
                <p className="text-lg font-bold text-slate-800 mb-3">{formatCurrency(parseFloat(p.price))}</p>
                {p.sizes?.length > 0 && (
                  <p className="text-xs text-slate-500 mb-1">Sizes: {p.sizes.join(', ')}</p>
                )}
                {p.colours?.length > 0 && (
                  <p className="text-xs text-slate-500 mb-3">Colours: {p.colours.join(', ')}</p>
                )}
                <div className="flex gap-2">
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
          ))}
        </div>
      )}

      {showAdd && <ProductFormModal onClose={() => setShowAdd(false)} />}
      {editProduct && <ProductFormModal product={editProduct} onClose={() => setEditProduct(null)} />}
      {restockProduct && <RestockModal product={restockProduct} onClose={() => setRestockProduct(null)} />}
    </div>
  );
}
