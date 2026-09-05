import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Store, Search, Clock, MapPin, Package, ArrowLeft, ShoppingBag, CheckCircle2, AlertCircle } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { useCart } from '../context/CartContext';
import { useLocation as useQuickLocation } from '../context/LocationContext';
import { resolveQuickImageUrl } from '../utils/image';
import { motion, AnimatePresence } from 'framer-motion';

export default function ShopsPage() {
  const navigate = useNavigate();
  const { cartCount } = useCart();
  const { currentLocation } = useQuickLocation();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'open'

  const lat = currentLocation?.latitude;
  const lng = currentLocation?.longitude;

  const fetchShops = useCallback(async () => {
    setLoading(true);
    try {
      // Scope the list to the customer's own delivery zone — without lat/lng
      // the backend can't tell which zone this request belongs to and shops
      // from every zone would show up.
      const hasValidLocation = Number.isFinite(lat) && Number.isFinite(lng);
      const res = await customerApi.getShops(hasValidLocation ? { lat, lng } : {});
      if (res?.data?.success) {
        setShops(res.data.results || []);
      }
    } catch (err) {
      console.error('Failed to load shops:', err);
    } finally {
      setLoading(false);
    }
  }, [lat, lng]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const filteredShops = useMemo(() => {
    return shops.filter((shop) => {
      const matchesSearch =
        !searchQuery.trim() ||
        shop.shopName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shop.businessType?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shop.address?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter = filterMode === 'all' || (filterMode === 'open' && shop.isOpen);
      return matchesSearch && matchesFilter;
    });
  }, [shops, searchQuery, filterMode]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background text-slate-900 dark:text-foreground">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-b from-[#FE5502] to-[#FF6F00] text-white shadow-lg rounded-b-3xl">
        <div className="max-w-[1400px] mx-auto px-4 pt-3.5 pb-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:scale-90 transition-all text-white flex items-center justify-center shadow-xs"
              aria-label="Back"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-base md:text-lg font-black tracking-tight text-white leading-none flex items-center gap-1.5">
                <Store size={18} className="text-white shrink-0" />
                <span>Quick Stores & Shops</span>
              </h1>
              <p className="text-[11px] text-white/85 font-medium mt-0.5">
                Verified partner stores near you
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/quick/cart"
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:scale-90 transition-all text-white flex items-center justify-center relative shadow-xs"
              aria-label="Cart"
            >
              <ShoppingBag size={18} />
              {Number(cartCount || 0) > 0 && (
                <span className="absolute -top-1 -right-1 bg-white text-[#FE5502] font-black text-[10px] min-w-[17px] h-[17px] px-0.5 rounded-full flex items-center justify-center shadow">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="max-w-[1400px] mx-auto px-4 pb-3.5 space-y-2.5">
          {/* Search bar */}
          <div className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search store by name, address or category..."
              className="w-full h-10 pl-10 pr-9 text-xs md:text-sm rounded-xl bg-white text-slate-800 placeholder:text-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 w-5 h-5 flex items-center justify-center rounded-full bg-slate-100"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1 ${
                filterMode === 'all'
                  ? 'bg-white text-[#FE5502] shadow-sm'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <span>All Shops</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterMode === 'all' ? 'bg-orange-100 text-[#FE5502]' : 'bg-white/20 text-white'}`}>
                {shops.length}
              </span>
            </button>
            <button
              onClick={() => setFilterMode('open')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 ${
                filterMode === 'open'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Open Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1400px] mx-auto px-4 py-6 pb-24">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-card rounded-2xl p-4 border border-slate-100 dark:border-border shadow-sm animate-pulse space-y-3"
              >
                <div className="h-40 bg-slate-200 dark:bg-muted rounded-xl" />
                <div className="h-5 bg-slate-200 dark:bg-muted rounded w-2/3" />
                <div className="h-4 bg-slate-100 dark:bg-muted/60 rounded w-1/2" />
                <div className="h-8 bg-slate-100 dark:bg-muted/60 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="text-center py-16 px-4 bg-white dark:bg-card rounded-3xl border border-slate-100 dark:border-border shadow-sm max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-orange-50 text-[#FE5502] flex items-center justify-center mx-auto mb-4">
              <Store size={32} />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-foreground">
              {searchQuery ? 'No shops matching your search' : 'No shops currently available'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              {searchQuery
                ? 'Try searching with another name or clear your filters.'
                : 'Please check back soon or try selecting a different location.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterMode('all');
                }}
                className="mt-4 px-4 py-2 text-xs font-bold bg-[#FE5502] text-white rounded-full hover:bg-orange-600 transition-all shadow-sm"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredShops.map((shop) => (
              <ShopCard key={shop.id || shop._id} shop={shop} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ShopCard({ shop }) {
  const navigate = useNavigate();
  const shopId = shop.id || shop._id;
  const isOpen = !!shop.isOpen;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      onClick={() => navigate(`/quick/shops/${shopId}`)}
      className="group relative bg-white dark:bg-card rounded-2xl border border-slate-200/80 dark:border-border shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer flex flex-col"
    >
      {/* Shop Image / Banner */}
      <div className="relative h-44 w-full bg-slate-100 dark:bg-muted overflow-hidden">
        {shop.shopImage ? (
          <img
            src={resolveQuickImageUrl(shop.shopImage)}
            alt={shop.shopName}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=600&auto=format&fit=crop&q=80';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-100 via-orange-50 to-amber-200 dark:from-slate-800 dark:to-slate-900 flex flex-col items-center justify-center text-slate-400 group-hover:scale-105 transition-transform">
            <Store size={44} className="text-[#FE5502] opacity-80" />
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">Verified Partner Store</span>
          </div>
        )}

        {/* Live Status Badge */}
        <div className="absolute top-3 right-3 z-10">
          {isOpen ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-emerald-500 text-white shadow-md backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Open Now
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-slate-900/85 text-white/95 shadow-md backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Closed
            </span>
          )}
        </div>

        {/* Business Type Pill */}
        {shop.businessType && (
          <div className="absolute bottom-3 left-3 z-10">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-black/60 text-white backdrop-blur-sm shadow">
              {shop.businessType}
            </span>
          </div>
        )}
      </div>

      {/* Shop Details */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-foreground group-hover:text-[#FE5502] transition-colors line-clamp-1">
              {shop.shopName}
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-[#FE5502] dark:bg-orange-950/40 shrink-0">
              <Package size={12} />
              {shop.itemCount || 0} items
            </span>
          </div>

          {/* Address */}
          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1 line-clamp-1">
            <MapPin size={13} className="text-slate-400 shrink-0" />
            <span>{shop.address || 'Local Marketplace'}</span>
          </p>
        </div>

        {/* Timing Information */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-border/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Clock size={14} className={isOpen ? 'text-emerald-500 shrink-0' : 'text-slate-400 shrink-0'} />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                {shop.openingHours || 'Regular Business Hours'}
              </span>
              <span className={`text-[10px] font-medium ${isOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {shop.timingText || (isOpen ? 'Serving orders right now' : 'Currently offline')}
              </span>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/quick/shops/${shopId}`);
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50 text-[#FE5502] transition-all"
          >
            Visit Shop →
          </button>
        </div>
      </div>
    </motion.div>
  );
}
