import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2, ShoppingCart, AlertTriangle, Package, Tag } from 'lucide-react';
import api from '../../api/axios';
import { formatCurrency, getProductImageUrl } from '../../lib/utils';
import toast from 'react-hot-toast';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import QuantityInput from '../../components/ui/QuantityInput';
import MoneyInput from '../../components/ui/MoneyInput';
import type { ApiResponse, Customer, Product, SaleType } from '../../types';

const saleTypes: SaleType[] = ['WHOLESALE', 'RETAIL'];

interface CartItem {
  productId: number;
  productName: string;
  brand?: string | null;
  category?: string;
  imageUrl?: string | null;
  originalPrice: number;
  unitPrice: number;
  quantity: number;
  maxQty: number;
}

export default function MakeSalePage() {
  const queryClient = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  
  // Product Catalog State
  const [productCatalogSearch, setProductCatalogSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  
  // Modal selection state
  const [modalQty, setModalQty] = useState(1);
  const [modalUnitPrice, setModalUnitPrice] = useState<number>(0);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMode, setPaymentMode] = useState<'CC' | 'CREDIT'>('CC');
  const [saleType, setSaleType] = useState<SaleType>('WHOLESALE');
  const [notes, setNotes] = useState('');

  // Customer search
  const { data: customerResults = [] } = useQuery<Customer[]>({
    queryKey: ['customer-search', customerSearch],
    queryFn: async () => {
      if (customerSearch.length < 2) return [];
      const res = await api.get<ApiResponse<Customer[]>>('/customers', { params: { search: customerSearch } });
      return res.data.data;
    },
    enabled: customerSearch.length >= 2,
  });

  // All active products
  const { data: allProducts = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ['products-catalog'],
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
    setModalQty(1);
    setModalUnitPrice(Number(product.price));
  };

  const addModalItemToCart = () => {
    if (!selectedProductForModal) return;
    const price = Number.isFinite(modalUnitPrice) ? modalUnitPrice : Number(selectedProductForModal.price);
    const qty = Math.max(1, Math.min(modalQty, selectedProductForModal.quantity));

    setCart((prev) => {
      const existingIdx = prev.findIndex((c) => c.productId === selectedProductForModal.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity = Math.min(updated[existingIdx].quantity + qty, selectedProductForModal.quantity);
        updated[existingIdx].unitPrice = price;
        return updated;
      }
      return [
        ...prev,
        {
          productId: selectedProductForModal.id,
          productName: selectedProductForModal.name,
          brand: selectedProductForModal.brand,
          category: selectedProductForModal.category,
          imageUrl: selectedProductForModal.imageUrl,
          originalPrice: Number(selectedProductForModal.price),
          unitPrice: price,
          quantity: qty,
          maxQty: selectedProductForModal.quantity,
        },
      ];
    });

    const perUnitDiff = Number(selectedProductForModal.price) - price;
    if (perUnitDiff > 0) {
      toast.success(`Added ${qty}x ${selectedProductForModal.name} (Discount: −${formatCurrency(perUnitDiff)}/pc)`);
    } else {
      toast.success(`Added ${qty}x ${selectedProductForModal.name} to cart`);
    }
    setSelectedProductForModal(null);
  };

  const updateCartItem = (idx: number, field: 'quantity' | 'unitPrice', value: string) => {
    setCart((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        if (field === 'quantity') {
          const qty = Math.max(1, Math.min(parseInt(value) || 1, c.maxQty));
          return { ...c, quantity: qty };
        }
        return { ...c, unitPrice: parseFloat(value) || 0 };
      })
    );
  };

  const removeFromCart = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const originalTotal = cart.reduce((sum, item) => sum + item.originalPrice * item.quantity, 0);
  const discount = Math.max(0, Math.round((originalTotal - subtotal) * 100) / 100);
  const finalTotal = subtotal;

  const saleMutation = useMutation({
    mutationFn: () =>
      api.post('/sales/worker-a', {
        customerId: selectedCustomer?.id,
        paymentMode,
        saleType,
        items: cart.map((c) => ({
          productId: c.productId,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })),
        discountAmount: discount,
        notes,
      }),
    onSuccess: () => {
      toast.success('Sale recorded and logged successfully!');
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['products-catalog-b'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setCart([]);
      setSelectedCustomer(null);
      setCustomerSearch('');
      setNotes('');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to submit sale'),
  });

  const handleSubmit = () => {
    if (!selectedCustomer) { toast.error('Please select a customer'); return; }
    if (cart.length === 0) { toast.error('Please add at least one product to the sale'); return; }
    saleMutation.mutate();
  };

  const customerDebt = Number(selectedCustomer?.totalDebt ?? 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Point of Sale (New Sale)</h1>
        <p className="text-slate-500 text-sm">Select products, customize prices, and record sale</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Columns — Customer & Product Visual Tile Catalog */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Customer & Sale Mode Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-700 text-sm">Customer Details</h3>
              {selectedCustomer && (
                <button onClick={() => setSelectedCustomer(null)} className="text-xs text-blue-600 hover:underline">
                  Change Customer
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
                placeholder="Type customer name or phone number..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {customerResults.map((c) => {
                    const debt = Number(c.totalDebt ?? 0);
                    return (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerDropdown(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex justify-between items-center border-b border-slate-100 last:border-0">
                        <div>
                          <p className="font-medium text-slate-800 text-sm">{c.name}</p>
                          <p className="text-xs text-slate-400">{c.phone || 'No phone'}</p>
                        </div>
                        {debt > 0 && (
                          <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Owes {formatCurrency(debt)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Debt Warning */}
            {selectedCustomer && customerDebt > 0 && (
              <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <p className="text-xs text-red-700">
                  ⚠️ <strong>{selectedCustomer.name}</strong> has an existing debt of <strong>{formatCurrency(customerDebt)}</strong>
                </p>
              </div>
            )}

            {/* Sale Type & Payment Mode Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs text-slate-500 block mb-1 font-medium">Sale Type</label>
                <div className="flex gap-1.5">
                  {saleTypes.map((t) => (
                    <button key={t} type="button" onClick={() => setSaleType(t)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${saleType === t ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1 font-medium">Payment Mode</label>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setPaymentMode('CC')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${paymentMode === 'CC' ? 'bg-green-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    Cash & Carry
                  </button>
                  <button type="button" onClick={() => setPaymentMode('CREDIT')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${paymentMode === 'CREDIT' ? 'bg-orange-500 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    Credit (Debt)
                  </button>
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
                  const imgUrl = getProductImageUrl(product.imageUrl);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={isOutOfStock}
                      onClick={() => openProductModal(product)}
                      className={`text-left p-3 rounded-xl border transition-all flex flex-col justify-between ${isOutOfStock ? 'opacity-40 bg-slate-50 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-md cursor-pointer'}`}
                    >
                      <div>
                        {imgUrl && (
                          <img src={imgUrl} alt={product.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                        )}
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
                        <span className="font-bold text-sm text-slate-900">{formatCurrency(Number(product.price))}</span>
                        <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-medium">Select</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Columns — Cart & Order Summary */}
        <div id="pos-cart-section" className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4 sticky top-4 shadow-sm">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                Current Sale Items ({cart.reduce((s, c) => s + c.quantity, 0)} pcs)
              </h3>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs text-red-500 hover:underline">
                  Clear All
                </button>
              )}
            </div>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                <Package className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
                <p className="text-xs font-medium">No items added yet</p>
                <p className="text-[11px] text-slate-400">Click on any product on the left to add</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {cart.map((item, idx) => {
                  const unitDiscount = Math.max(0, item.originalPrice - item.unitPrice);
                  const totalItemDiscount = unitDiscount * item.quantity;
                  const itemImg = getProductImageUrl(item.imageUrl);
                  return (
                    <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          {itemImg && (
                            <img src={itemImg} alt={item.productName} className="w-8 h-8 object-cover rounded-md shrink-0 border border-slate-200" />
                          )}
                          <div>
                            <p className="font-bold text-slate-800">{item.productName}</p>
                            {item.brand && <p className="text-[11px] text-slate-400">{item.brand}</p>}
                          </div>
                        </div>
                        <button onClick={() => removeFromCart(idx)} className="text-slate-400 hover:text-red-600 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 items-center pt-1 border-t border-slate-200/60">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Quantity</label>
                          <QuantityInput
                            value={item.quantity}
                            max={item.maxQty}
                            ariaLabel={`Quantity for ${item.productName}`}
                            onChange={(value) => updateCartItem(idx, 'quantity', String(value))}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-center font-bold text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Unit Price (₵)</label>
                          <MoneyInput
                            value={item.unitPrice}
                            onChange={(value) => updateCartItem(idx, 'unitPrice', String(value))}
                            ariaLabel={`Unit price for ${item.productName}`}
                            className={`w-full bg-white border rounded px-2 py-1 text-xs font-bold ${item.unitPrice < item.originalPrice ? 'text-orange-600 border-orange-300' : 'border-slate-200'}`}
                          />
                        </div>
                        <div className="text-right">
                          <label className="text-[10px] text-slate-400 block mb-0.5">Subtotal</label>
                          <p className="font-bold text-slate-900 text-xs">{formatCurrency(item.unitPrice * item.quantity)}</p>
                        </div>
                      </div>

                      {/* Explicit Discount Details per item */}
                      {unitDiscount > 0 && (
                        <div className="flex items-center justify-between text-[11px] bg-orange-100/70 text-orange-800 px-2 py-1 rounded border border-orange-200 font-medium">
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3 text-orange-600" />
                            Discount: <strong>−{formatCurrency(unitDiscount)}/pc</strong>
                          </span>
                          <span>Total savings: <strong>−{formatCurrency(totalItemDiscount)}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pricing Summary */}
            <div className="space-y-2 text-xs border-t pt-3">
              <div className="flex justify-between text-slate-600">
                <span>Original Total</span>
                <span className="font-semibold">{formatCurrency(originalTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Subtotal at entered prices</span>
                <span className="font-semibold">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="space-y-1 bg-orange-50 border border-orange-200 rounded-lg p-2.5">
                  <div className="flex justify-between items-center text-orange-900 font-bold">
                    <span>Total Discount Given</span>
                    <span className="text-sm">−{formatCurrency(discount)}</span>
                  </div>
                  <div className="text-[11px] text-orange-700/90 space-y-0.5 pt-1 border-t border-orange-200/60">
                    {cart
                      .filter((c) => c.unitPrice < c.originalPrice)
                      .map((c) => {
                        const unitDisc = c.originalPrice - c.unitPrice;
                        const lineDisc = unitDisc * c.quantity;
                        return (
                          <p key={c.productId} className="flex justify-between">
                            <span>• {c.productName} (−{formatCurrency(unitDisc)}/pc × {c.quantity} pcs)</span>
                            <span className="font-semibold">−{formatCurrency(lineDisc)}</span>
                          </p>
                        );
                      })}
                  </div>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2 text-slate-900">
                <span>Final Total</span>
                <span className="text-blue-700">{formatCurrency(finalTotal)}</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional sale notes..."
                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={saleMutation.isPending || !selectedCustomer || cart.length === 0}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-lg text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              {saleMutation.isPending ? 'Recording Sale...' : 'Record Sale'}
            </button>
          </div>
        </div>
      </div>

      {/* Product Quantity & Price Selection Modal */}
      {selectedProductForModal && (
        <Modal
          title={`Order — ${selectedProductForModal.name}`}
          onClose={() => setSelectedProductForModal(null)}
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl flex justify-between items-center text-xs">
              <div className="flex items-center gap-3">
                {getProductImageUrl(selectedProductForModal.imageUrl) && (
                  <img
                    src={getProductImageUrl(selectedProductForModal.imageUrl)!}
                    alt={selectedProductForModal.name}
                    className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                  />
                )}
                <div>
                  <p className="font-bold text-slate-800 text-sm">{selectedProductForModal.name}</p>
                  <p className="text-slate-500">{selectedProductForModal.brand} · {selectedProductForModal.category}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm text-blue-700">{formatCurrency(Number(selectedProductForModal.price))}</p>
                <p className="text-slate-500">{selectedProductForModal.quantity} in stock</p>
              </div>
            </div>

            {/* Quantity & Custom Price */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Quantity</label>
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
                    className="w-16 text-center border border-slate-200 rounded-lg py-1 font-bold text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setModalQty(q => Math.min(selectedProductForModal.quantity, q + 1))}
                    className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-sm"
                  >+</button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Unit Price (GH₵)</label>
                <MoneyInput
                  value={modalUnitPrice}
                  onChange={setModalUnitPrice}
                  ariaLabel="Sale unit price"
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold"
                />
              </div>
            </div>

            {/* Live Discount Calculation Display */}
            {modalUnitPrice < Number(selectedProductForModal.price) && (
              <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between items-center text-orange-900 font-semibold">
                  <span>Price per unit discount:</span>
                  <span className="font-bold text-sm text-orange-700">
                    −{formatCurrency(Number(selectedProductForModal.price) - modalUnitPrice)}/pc
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600 text-[11px] pt-1 border-t border-orange-200/60">
                  <span>Original: {formatCurrency(Number(selectedProductForModal.price))} → Negotiated: {formatCurrency(modalUnitPrice)}</span>
                  <span className="font-bold text-orange-800">
                    Total Savings: −{formatCurrency((Number(selectedProductForModal.price) - modalUnitPrice) * modalQty)}
                  </span>
                </div>
              </div>
            )}

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
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add to Order ({formatCurrency(modalUnitPrice * modalQty)})
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Mobile Floating Cart Summary Button */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-30">
          <button
            type="button"
            onClick={() => {
              const cartEl = document.getElementById('pos-cart-section');
              cartEl?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-2xl flex items-center justify-between transition-all active:scale-95"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              <span className="text-sm">{cart.reduce((s, c) => s + c.quantity, 0)} pcs ({cart.length} item{cart.length > 1 ? 's' : ''})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold">{formatCurrency(finalTotal)}</span>
              <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded font-medium">Review Cart ↓</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
