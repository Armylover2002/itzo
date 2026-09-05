import React from "react";
import { Link, useNavigate } from "react-router-dom";
import ProductCard from "../components/shared/ProductCard";
import { useWishlist } from "../context/WishlistContext";
import { ChevronLeft, Heart, Trash2 } from "lucide-react";
import { getQuickHomePath } from "../utils/routes";

const WishlistPage = () => {
  const navigate = useNavigate();
  const {
    wishlist,
    clearWishlist,
    fetchFullWishlist,
    isFullDataFetched,
    loading,
  } = useWishlist();

  React.useEffect(() => {
    const handleRefresh = () => {
      if (document.visibilityState && document.visibilityState !== "visible") return;
      fetchFullWishlist();
    };

    handleRefresh();

    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", handleRefresh);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      document.removeEventListener("visibilitychange", handleRefresh);
    };
  }, []);

  if (loading && !isFullDataFetched) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center transition-colors">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background pb-24 transition-colors duration-500">
      <div className="sticky top-0 z-30 bg-slate-50/95 dark:bg-background/95 backdrop-blur-sm px-4 pt-4 pb-3 border-b border-slate-200/60 dark:border-white/5 mb-4 flex items-center justify-between gap-2 transition-colors">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center hover:bg-slate-200/70 dark:hover:bg-white/10 rounded-full transition-colors -ml-1">
            <ChevronLeft size={22} className="text-slate-800 dark:text-slate-200" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
              My Wishlist
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {wishlist.length} {wishlist.length === 1 ? "item" : "items"} saved
            </p>
          </div>
        </div>
        {wishlist.length > 0 && (
          <button
            onClick={clearWishlist}
            className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-white/10 px-3 py-2 rounded-lg transition-colors">
            <Trash2 size={14} /> Clear
          </button>
        )}
      </div>

      <div className="px-4">
        {wishlist.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {wishlist.map((product) => (
              <ProductCard
                key={product.wishlistKey || `${product.id || product._id}::${product.variantId || ""}`}
                product={product}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-white/5 transition-colors">
            <div className="h-14 w-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart size={26} className="text-slate-500 dark:text-slate-400" strokeWidth={1.8} />
            </div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
              No items in wishlist
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-xs mx-auto">
              Start saving your favorite items to see them here later.
            </p>
            <Link
              to={getQuickHomePath()}
              className="px-6 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors">
              Explore Products
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;
