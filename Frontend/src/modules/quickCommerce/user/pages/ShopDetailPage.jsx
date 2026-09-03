import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Store, Clock, MapPin, ArrowLeft, ShoppingBag, AlertCircle, Phone, Package, CheckCircle2 } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { useCart } from '../context/CartContext';
import { resolveQuickImageUrl } from '../utils/image';
import ProductCard from '../components/shared/ProductCard';

export default function ShopDetailPage() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchShopDetails = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await customerApi.getShopById(shopId);
      if (res?.data?.success && res.data.result) {
        setShop(res.data.result.shop || null);
        setProducts(res.data.result.products || []);
      } else {
        setError('Store not found or currently unavailable.');
      }
    } catch (err) {
      console.error('Failed to load shop details:', err);
      setError(err?.response?.data?.message || 'Failed to load store information.');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    fetchShopDetails();
  }, [fetchShopDetails]);

  const isOpen = !!shop?.isOpen;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#FE5502] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-slate-500">Loading store details...</span>
        </div>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background p-4 flex items-center justify-center">
        <div className="bg-white dark:bg-card p-6 rounded-3xl border border-slate-100 dark:border-border max-w-md w-full text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-foreground">Store Unavailable</h2>
          <p className="text-xs text-slate-500 mt-1">{error || 'This store could not be found.'}</p>
          <button
            onClick={() => navigate('/quick/shops')}
            className="mt-4 px-5 py-2 text-xs font-bold bg-[#FE5502] text-white rounded-full hover:bg-orange-600 transition-all shadow-sm"
          >
            Browse Other Stores
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background text-slate-900 dark:text-foreground">
      {/* Top Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-[#FE5502] via-[#FF6A1A] to-[#FF8533] text-white shadow-md">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-full hover:bg-white/20 active:scale-95 transition-all text-white"
              aria-label="Back"
            >
              <ArrowLeft size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-black tracking-tight text-white leading-none truncate">
                {shop.shopName}
              </h1>
              <p className="text-[11px] text-white/80 font-medium mt-0.5 truncate">
                {shop.businessType || 'Partner Store'} • {shop.address || 'Local Marketplace'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/quick/cart"
              className="p-2 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 transition-all text-white relative"
              aria-label="Cart"
            >
              <ShoppingBag size={19} />
              {Number(cartCount || 0) > 0 && (
                <span className="absolute -top-1 -right-1 bg-white text-primary-orange font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Store Banner & Info Card */}
      <div className="max-w-[1400px] mx-auto px-4 pt-5 pb-6">
        <div className="bg-white dark:bg-card rounded-3xl border border-slate-200/80 dark:border-border shadow-sm overflow-hidden mb-6">
          <div className="relative h-44 sm:h-56 w-full bg-slate-100 dark:bg-muted overflow-hidden">
            {shop.shopImage ? (
              <img
                src={resolveQuickImageUrl(shop.shopImage)}
                alt={shop.shopName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop&q=80';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-amber-100 via-orange-50 to-amber-200 dark:from-slate-800 dark:to-slate-900 flex flex-col items-center justify-center text-slate-400">
                <Store size={48} className="text-[#FE5502] opacity-80" />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Verified Partner Store</span>
              </div>
            )}

            {/* Status Badge overlay */}
            <div className="absolute top-4 right-4">
              {isOpen ? (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-emerald-500 text-white shadow-lg backdrop-blur-md">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  Store Open Now
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-slate-900/90 text-white shadow-lg backdrop-blur-md">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  Store Closed
                </span>
              )}
            </div>
          </div>

          <div className="p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-foreground">
                  {shop.shopName}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                    {shop.address || 'Local Marketplace'}
                  </span>
                  {shop.businessType && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-muted text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                      {shop.businessType}
                    </span>
                  )}
                  <span className="flex items-center gap-1 font-bold text-[#FE5502]">
                    <Package size={14} />
                    {products.length} Products
                  </span>
                </div>
              </div>

              {/* Timing Badge Box */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-muted/40 border border-slate-100 dark:border-border shrink-0">
                <Clock size={20} className={isOpen ? 'text-emerald-500 shrink-0' : 'text-slate-400 shrink-0'} />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {shop.openingHours || 'Regular Business Hours'}
                  </span>
                  <span className={`text-[11px] font-medium ${isOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                    {shop.timingText || (isOpen ? 'Open for orders' : 'Closed for orders')}
                  </span>
                </div>
              </div>
            </div>

            {/* Closed Store Notice Banner */}
            {!isOpen && (
              <div className="mt-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-center gap-3 text-amber-900 dark:text-amber-300">
                <AlertCircle size={20} className="text-amber-600 shrink-0" />
                <div className="text-xs leading-relaxed">
                  <span className="font-bold block">This store is currently offline/closed.</span>
                  You can browse the catalogue below, but adding products to cart and placing orders will be enabled when the store re-opens ({shop.timingText || shop.openingHours}).
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Store Catalog / Products */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-black text-slate-900 dark:text-foreground flex items-center gap-2">
              <span>All Products from {shop.shopName}</span>
              <span className="text-xs font-bold text-slate-400">({products.length})</span>
            </h3>
          </div>

          {products.length === 0 ? (
            <div className="bg-white dark:bg-card p-10 rounded-2xl border border-slate-100 dark:border-border text-center">
              <Package size={40} className="text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                No products currently listed for this store.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id || product._id}
                  product={{
                    ...product,
                    isShopOpen: isOpen,
                    shopStatus: isOpen ? 'Open Now' : 'Closed',
                    seller: {
                      ...product.seller,
                      isShopOpen: isOpen,
                    },
                  }}
                  isStoreClosed={!isOpen}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
