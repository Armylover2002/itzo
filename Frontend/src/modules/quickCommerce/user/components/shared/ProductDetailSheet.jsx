import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { X, Heart, Minus, Plus, ShoppingBag, ChevronRight } from 'lucide-react';
import { useProductDetail } from '../../context/ProductDetailContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { cn } from '@/lib/utils';
import { getQuickCartPath, getQuickCheckoutPath } from '../../utils/routes';
import { resolveQuickImageUrl } from '../../utils/image';

// A compact variant-picker popup — this is only ever opened from a product
// card's "+" button when the product has more than one variant, so it stays
// focused on exactly that job (pick a variant, adjust quantity, add to cart)
// instead of duplicating the full product page.
const ProductDetailSheet = () => {
    const { selectedProduct, isOpen, closeProduct } = useProductDetail();
    const { cart, cartCount, addToCart, updateQuantity, removeFromCart, getCartItemKey, getItemCartKey } = useCart();
    const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
    const { showToast } = useToast();
    const location = useLocation();
    const cartPath = location.pathname.startsWith('/quick')
        ? getQuickCartPath(location.pathname)
        : getQuickCheckoutPath(location.pathname);

    const [selectedVariant, setSelectedVariant] = useState(null);

    // A product opened from a wishlist card carries the specific variant that
    // was liked (variantId) — that must be pre-selected so the heart reflects
    // it, instead of always defaulting to the first variant.
    useEffect(() => {
        if (selectedProduct?.variants?.length > 0) {
            const wishlistedVariantId = selectedProduct.variantId;
            const matched = wishlistedVariantId
                ? selectedProduct.variants.find(
                    (v) => String(v._id) === String(wishlistedVariantId) || v.name === wishlistedVariantId,
                  )
                : null;
            setSelectedVariant(matched || selectedProduct.variants[0]);
        } else {
            setSelectedVariant(null);
        }
    }, [selectedProduct]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!selectedProduct) return null;

    const variantImage = Array.isArray(selectedVariant?.images) ? selectedVariant.images[0] : null;
    const rawImage = variantImage || selectedProduct.mainImage || selectedProduct.image;
    const image = resolveQuickImageUrl(rawImage) || rawImage;

    const selectedCartKey = getCartItemKey(selectedProduct, selectedVariant);
    const cartItem = cart.find((item) => getItemCartKey(item) === selectedCartKey);
    const quantity = cartItem ? cartItem.quantity : 0;
    const isWishlisted = isInWishlist(selectedProduct.id || selectedProduct._id, selectedVariant);
    const isClosed = selectedProduct?.isShopOpen === false || selectedProduct?.seller?.isShopOpen === false;

    const price = selectedVariant
        ? (Number(selectedVariant.salePrice) > 0 ? selectedVariant.salePrice : selectedVariant.price)
        : selectedProduct.price;
    const originalPrice = selectedVariant ? selectedVariant.price : selectedProduct.originalPrice;
    const hasDiscount = Number(originalPrice) > Number(price);
    const stock = Number(selectedVariant?.stock ?? selectedProduct.stock ?? Infinity);

    const toggleWishlist = () => {
        toggleWishlistGlobal(selectedProduct, selectedVariant);
        const variantLabel = selectedVariant?.name ? ` (${selectedVariant.name})` : '';
        showToast(
            isWishlisted ? `${selectedProduct.name}${variantLabel} removed from wishlist` : `${selectedProduct.name}${variantLabel} added to wishlist`,
            isWishlisted ? 'info' : 'success',
        );
    };

    const handleAddToCart = () => {
        if (isClosed) {
            showToast('This store is currently closed. Cannot order products now.', 'error');
            return;
        }
        if (stock <= 0) {
            showToast('This product is out of stock', 'error');
            return;
        }
        addToCart(selectedProduct, selectedVariant);
        showToast(`${selectedProduct.name} added to cart`, 'success');
    };

    const handleIncrement = () => {
        if (quantity >= stock) {
            showToast(`Only ${stock} in stock`, 'error');
            return;
        }
        updateQuantity(selectedCartKey, 1);
    };

    const handleDecrement = () => {
        if (quantity === 1) {
            removeFromCart(selectedCartKey);
        } else {
            updateQuantity(selectedCartKey, -1);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeProduct}
                        className="fixed inset-0 bg-black/60 z-[220] backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.96 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                        className="fixed inset-x-0 bottom-0 z-[230] w-full bg-white dark:bg-card rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:inset-0 sm:m-auto sm:max-w-sm sm:h-fit sm:rounded-3xl"
                    >
                        <button
                            onClick={closeProduct}
                            className="absolute top-3 right-3 z-20 w-8 h-8 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-full shadow-md flex items-center justify-center"
                        >
                            <X size={16} className="text-slate-600 dark:text-slate-300" />
                        </button>

                        <div className="overflow-y-auto">
                            {/* Image */}
                            <div className="relative w-full aspect-square bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
                                <img
                                    src={image}
                                    alt={selectedProduct.name}
                                    className="max-w-full max-h-full object-contain mix-blend-multiply dark:mix-blend-normal"
                                />
                                <button
                                    onClick={toggleWishlist}
                                    className={cn(
                                        "absolute top-3 left-3 w-8 h-8 rounded-full shadow-md flex items-center justify-center backdrop-blur-md",
                                        isWishlisted ? "bg-red-50 dark:bg-red-950/30" : "bg-white/90 dark:bg-slate-800/90",
                                    )}
                                >
                                    <Heart size={16} className={isWishlisted ? "text-red-500 fill-red-500" : "text-slate-400"} />
                                </button>
                                {isClosed && (
                                    <span className="absolute bottom-3 left-3 px-2 py-1 rounded-md text-[9px] font-black bg-slate-900/80 text-white uppercase tracking-wide">
                                        Store Closed
                                    </span>
                                )}
                            </div>

                            <div className="p-4 space-y-3">
                                <div>
                                    <h2 className="text-base font-bold text-foreground leading-tight">
                                        {selectedProduct.name}
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Sold by {selectedProduct.storeName || selectedProduct.restaurantName || "Fresh Mart"}
                                    </p>
                                </div>

                                <div className="flex items-baseline gap-2">
                                    <span className="text-xl font-black text-[#FE5502]">₹{price}</span>
                                    {hasDiscount && (
                                        <>
                                            <span className="text-sm text-slate-400 line-through">₹{originalPrice}</span>
                                            <span className="text-[10px] font-black text-red-500 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">
                                                {Math.round(((originalPrice - price) / originalPrice) * 100)}% OFF
                                            </span>
                                        </>
                                    )}
                                </div>

                                {selectedProduct.variants?.length > 0 && (
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
                                            Select Variant
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedProduct.variants.map((v, idx) => {
                                                const isSelected = selectedVariant?._id
                                                    ? selectedVariant._id === v._id
                                                    : selectedVariant?.name === v.name;
                                                return (
                                                    <button
                                                        key={v._id || idx}
                                                        onClick={() => setSelectedVariant(v)}
                                                        className={cn(
                                                            "px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all",
                                                            isSelected
                                                                ? "border-[#FE5502] bg-orange-50 dark:bg-orange-950/30 text-[#FE5502]"
                                                                : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400",
                                                        )}
                                                    >
                                                        {v.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {stock <= 0 && (
                                    <p className="text-xs font-bold text-red-500">Out of stock</p>
                                )}
                            </div>
                        </div>

                        {/* Add-to-cart footer — updates in place, no navigation */}
                        <div className="border-t border-slate-100 dark:border-white/5 p-4 shrink-0">
                            {quantity > 0 ? (
                                <div className="flex items-center justify-between bg-[#FE5502] rounded-xl p-1">
                                    <button
                                        onClick={handleDecrement}
                                        className="w-11 h-11 flex items-center justify-center text-white hover:bg-black/10 rounded-lg transition-colors"
                                    >
                                        <Minus size={18} strokeWidth={3} />
                                    </button>
                                    <span className="text-white font-black text-base">{quantity}</span>
                                    <button
                                        onClick={handleIncrement}
                                        disabled={quantity >= stock}
                                        className="w-11 h-11 flex items-center justify-center text-white hover:bg-black/10 rounded-lg transition-colors disabled:opacity-40"
                                    >
                                        <Plus size={18} strokeWidth={3} />
                                    </button>
                                </div>
                            ) : isClosed ? (
                                <div className="h-11 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-black text-sm">
                                    Store Closed
                                </div>
                            ) : (
                                <button
                                    onClick={handleAddToCart}
                                    disabled={stock <= 0}
                                    className="w-full h-11 rounded-xl bg-[#FE5502] hover:bg-[#ea580c] text-white font-black text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                >
                                    <ShoppingBag size={16} />
                                    ADD TO CART
                                </button>
                            )}

                            {cartCount > 0 && (
                                <Link
                                    to={cartPath}
                                    onClick={closeProduct}
                                    className="mt-2 flex items-center justify-between bg-slate-900 dark:bg-slate-800 text-white rounded-xl px-4 h-11 hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <span className="text-xs font-bold uppercase tracking-wide">
                                        View cart ({cartCount})
                                    </span>
                                    <span className="flex items-center gap-1 text-sm font-black">
                                        ₹{cart.reduce((total, item) => total + item.price * item.quantity, 0)}
                                        <ChevronRight size={14} />
                                    </span>
                                </Link>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ProductDetailSheet;
