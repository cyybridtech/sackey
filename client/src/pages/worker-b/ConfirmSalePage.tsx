import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2, Package } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import QuantityInput from '../../components/ui/QuantityInput';
import type { ApiResponse, Customer, Product, SaleType } from '../../types';

const saleTypes: SaleType[] = ['WHOLESALE', 'RETAIL'];

interface CartItem {
  productId: number;
  productName: string;
  brand?: string | null;
  category?: string;
  selectedSize?: string;
  selectedColour?: string;
  quantity: number;
  maxQty: number;
}

export default function ConfirmSalePage() {
  const queryClient = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Product Catalog State
  const [productCatalogSearch, setProductCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);

  // Modal selection state
  const [modalSize, setModalSize] = useState('');
  const [modalColour, setModalColour] = useState('');
  const [modalQty, setModalQty] = useState(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleType, setSaleType] = useState<SaleType>('WHOLESALE');

  // Customer search
  const { data: customerResults = [] } = useQuery<Customer[]>({
    queryKey: ['customer-search-b', customerSearch],
    queryFn: async () => {
      if (customerSearch.length < 2) return [];
      const res = await api.get<ApiResponse<Customer[]>>('/customers', { params: { search: customerSearch } });
      return res.data.data;
    },
    enabled: customerSearch.length >= 2,
  });

  // All active products
  const { data: allProducts = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ['products-catalog-b'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Product[]>>('/products');
      return res.data.data;
    },
  });

  // Unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    allProducts.forEach((product) => { if (product.category) cats.add(product.category); });
    return ['ALL', ...Array.from(cats)];
  }, [allProducts]);

  // Filtered products for grid
  const filteredProducts = useMemo(() => {
    return allProducts.filter((product) => {
      const matchesCategory = selectedCategory === 'ALL' || product.category === selectedCategory;
      const matchesSearch = !productCatalogSearch || 
        product.name.toLowerCase().includes(productCatalogSearch.toLowerCase()) ||
        (product.brand && product.brand.toLowerCase().includes(productCatalogSearch.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [allProducts, selectedCategory, productCatalogSearch]);

  const openProductModal = (product: Product) => {
    setSelectedProductForModal(product);
    setModalSize(product.sizes?.[0] || '');
    setModalColour(product.colours?.[0] || '');
    setModalQty(1);
  };

  const addModalItemToCart = () => {
    if (!selectedProductForModal) return;
    const qty = Math.max(1, Math.min(modalQty, selectedProductForModal.quantity));

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (c) => c.productId === selectedProductForModal.id &&
               c.selectedSize === modalSize &&
               c.selectedColour === modalColour
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity = Math.min(updated[existingIdx].quantity + qty, selectedProductForModal.quantity);
        return updated;
      }
      return [
        ...prev,
        {
          productId: selectedProductForModal.id,
          productName: selectedProductForModal.name,
          brand: selectedProductForModal.brand,
          category: selectedProductForModal.category,
          selectedSize: modalSize,
          selectedColour: modalColour,
          quantity: qty,
          maxQty: selectedProductForModal.quantity,
        },
      ];
    });

    toast.success(`Logged ${qty}x ${selectedProductForModal.name}`);
    setSelectedProductForModal(null);
  };

  const updateCartItem = (idx: number, value: string) => {
    setCart((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const qty = Math.max(1, Math.min(parseInt(value, 10) || 1, c.maxQty));
        return { ...c, quantity: qty };
      })
    );
  };

  const removeFromCart = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const saleMutation = useMutation({
    mutationFn: () =>
      api.post('/sales/worker-b', {
        customerId: selectedCustomer?.id,
        saleType,
        items: cart.map((c) => ({
          productId: c.productId,
          quantity: c.quantity,
          size: c.selectedSize,
          colour: c.selectedColour,
        })),
      }),
    onSuccess: () => {
      toast.success('Goods dispatch record logged successfully!');
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog-b'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setCart([]);
      setSelectedCustomer(null);
      setCustomerSearch('');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to submit log'),
  });

  const handleSubmit = () => {
    if (!selectedCustomer) { toast.error('Please select a customer'); return; }
    if (cart.length === 0) { toast.error('Please add at least one product'); return; }
    saleMutation.mutate();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Goods Dispatch & Stock Issue Log</h1>
        <p className="text-slate-500 text-sm">Record customer goods dispatch and stock issue transactions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Columns — Customer & Product Visual Tile Catalog */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Customer & Sale Mode Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-700 text-sm">Customer</h3>
              {selectedCustomer && (
                <button onClick={() => setSelectedCustomer(null)} className="text-xs text-blue-600 hover:underline">
                  Change
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={selectedCustomer ? selectedCustomer.name : customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setShowCustomerDropdown(true); }}
                onFocus={() => setShowCustomerDropdown(true)}
                placeholder="Search customer by name or phone..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {customerResults.map((c) => (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerDropdown(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{c.name}</p>
                          <p className="text-xs text-slate-400">{c.phone || 'No phone'}</p>
                        </div>
                      </button>
                  ))}
                </div>
              )}
            </div>

            {/* Issue Type */}
            <div className="pt-1">
              <div>
                <label className="text-xs text-slate-500 block mb-1 font-medium">Issue Type</label>
                <div className="flex gap-1.5">
                  {saleTypes.map((t) => (
                    <button key={t} type="button" onClick={() => setSaleType(t)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${saleType === t ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Product Catalog Tiles */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between gap-2">
              <h3 className="font-semibold text-slate-700 text-sm">Product Catalog (Click to Select)</h3>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={productCatalogSearch}
                  onChange={(e) => setProductCatalogSearch(e.target.value)}
                  placeholder="Filter products..."
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition ${selectedCategory === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Product Tiles Grid */}
            {loadingProducts ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">No products found.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
                {filteredProducts.map((product) => {
                  const isOutOfStock = product.quantity <= 0;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => openProductModal(product)}
                      className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between ${isOutOfStock ? 'opacity-40 bg-slate-50 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-md cursor-pointer'}`}
                    >
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[11px] font-semibold text-blue-600 truncate">{product.category}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${product.quantity <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {product.quantity} left
                          </span>
                        </div>
                        <p className="font-bold text-slate-800 text-xs line-clamp-2 leading-tight">{product.name}</p>
                        {product.brand && <p className="text-[11px] text-slate-400 mt-0.5">{product.brand}</p>}
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-medium">Select product</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Columns — Dispatched Items Summary */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 sticky top-4 shadow-sm">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Package className="w-4 h-4 text-amber-600" />
                Dispatched Items ({cart.reduce((s, c) => s + c.quantity, 0)} pcs)
              </h3>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs text-red-500 hover:underline">
                  Clear
                </button>
              )}
            </div>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <Package className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
                <p className="text-xs font-medium">No items added</p>
                <p className="text-[11px] text-slate-400">Click on any product on the left</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {cart.map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-slate-800">{item.productName}</p>
                        {(item.selectedSize || item.selectedColour) && (
                          <div className="flex gap-1.5 mt-0.5 text-[11px] text-slate-500">
                            {item.selectedSize && <span className="bg-slate-200 px-1.5 py-0.2 rounded font-medium">Size: {item.selectedSize}</span>}
                            {item.selectedColour && <span className="bg-slate-200 px-1.5 py-0.2 rounded font-medium">Colour: {item.selectedColour}</span>}
                          </div>
                        )}
                      </div>
                      <button onClick={() => removeFromCart(idx)} className="text-slate-400 hover:text-red-600 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="pt-1 border-t border-slate-200/60">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Quantity Dispatched</label>
                        <QuantityInput
                          value={item.quantity}
                          max={item.maxQty}
                          ariaLabel={`Quantity for ${item.productName}`}
                          onChange={(value) => updateCartItem(idx, String(value))}
                          className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-center font-bold text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={saleMutation.isPending || !selectedCustomer || cart.length === 0}
              className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-bold rounded-lg text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              {saleMutation.isPending ? 'Saving Record...' : 'Save Dispatch Record'}
            </button>
          </div>
        </div>
      </div>

      {/* Product Variant Selection Modal */}
      {selectedProductForModal && (
        <Modal
          title={`Select Variant — ${selectedProductForModal.name}`}
          onClose={() => setSelectedProductForModal(null)}
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center text-xs">
              <div>
                <p className="font-bold text-slate-800 text-sm">{selectedProductForModal.name}</p>
                <p className="text-slate-500">{selectedProductForModal.brand} · {selectedProductForModal.category}</p>
              </div>
              <div className="text-right">
                <p className="text-slate-500">{selectedProductForModal.quantity} in stock</p>
              </div>
            </div>

            {/* Size Options */}
            {selectedProductForModal.sizes && selectedProductForModal.sizes.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Select Size</label>
                <div className="flex gap-2 flex-wrap">
                  {selectedProductForModal.sizes.map((s: string) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setModalSize(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${modalSize === s ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Colour Options */}
            {selectedProductForModal.colours && selectedProductForModal.colours.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Select Colour</label>
                <div className="flex gap-2 flex-wrap">
                  {selectedProductForModal.colours.map((c: string) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setModalColour(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${modalColour === c ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="pt-2 border-t">
              <label className="text-xs font-semibold text-slate-700 block mb-1">Quantity Dispatched</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setModalQty(q => Math.max(1, q - 1))}
                  className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-sm"
                >-</button>
                <QuantityInput
                  value={modalQty}
                  max={selectedProductForModal.quantity}
                  ariaLabel={`Quantity for ${selectedProductForModal.name}`}
                  onChange={setModalQty}
                  className="w-20 text-center border border-slate-200 rounded-lg py-1 font-bold text-sm"
                />
                <button
                  type="button"
                  onClick={() => setModalQty(q => Math.min(selectedProductForModal.quantity, q + 1))}
                  className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-sm"
                >+</button>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setSelectedProductForModal(null)}
                className="flex-1 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addModalItemToCart}
                disabled={selectedProductForModal.quantity < 1}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add to Dispatch
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
