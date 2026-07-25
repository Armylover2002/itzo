import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation, useDragControls } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { X, ChevronDown, Share2, Heart, Search, Clock, Minus, Plus, ShoppingBag, Star, MessageSquare, ArrowLeft, ChevronRight } from 'lucide-react';
import { useProductDetail } from '../../context/ProductDetailContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '@shared/components/ui/Toast';
import { useSettings } from '@core/context/SettingsContext';
import { cn } from '@/lib/utils';
import { customerApi } from '../../services/customerApi';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { getQuickCartPath, getQuickCheckoutPath } from '../../utils/routes';

const ProductDetailSheet = () => {
    const { selectedProduct, isOpen, closeProduct } = useProductDetail();
    const { cart, cartCount, addToCart, updateQuantity, removeFromCart } = useCart();
    const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
    const { showToast } = useToast();
    const { settings } = useSettings();
    const supportEmail = settings?.supportEmail || 'support@example.com';
    const location = useLocation();
    const cartPath = location.pathname.startsWith('/quick')
        ? getQuickCartPath(location.pathname)
        : getQuickCheckoutPath(location.pathname);

    // Controls for sheet animation
    const controls = useAnimation();
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    const [reviews, setReviews] = useState([]);
    const [reviewLoading, setReviewLoading] = useState(true);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [newReview, setNewReview] = useState({ rating: 5, comment: '' });

    const scrollRef = useRef(null);

    const allImages = useMemo(() => {
        if (!selectedProduct) return [];
        const images = [];
        if (selectedProduct.mainImage) images.push(selectedProduct.mainImage);
        else if (selectedProduct.image) images.push(selectedProduct.image);

        if (selectedProduct.galleryImages && Array.isArray(selectedProduct.galleryImages)) {
            images.push(...selectedProduct.galleryImages);
        }
        return images.length > 0 ? images : ["https://images.unsplash.com/photo-1550989460-0adf9ea622e2"];
    }, [selectedProduct]);

    // Update variant when product changes
    useEffect(() => {
        if (selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0) {
            setSelectedVariant(selectedProduct.variants[0]);
        } else {
            setSelectedVariant(null);
        }
        setActiveImageIndex(0);

        if (selectedProduct?.id || selectedProduct?._id) {
            fetchReviews(selectedProduct.id || selectedProduct._id);
        }
    }, [selectedProduct]);

    const fetchReviews = async (productId) => {
        try {
            setReviewLoading(true);
            const res = await customerApi.getProductReviews(productId);
            if (res.data.success) {
                setReviews(res.data.results);
            }
        } catch (error) {
            console.error("Fetch reviews error:", error);
        } finally {
            setReviewLoading(false);
        }
    };

    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        if (!newReview.comment.trim()) return;

        try {
            setIsSubmittingReview(true);
            const res = await customerApi.submitReview({
                productId: selectedProduct.id || selectedProduct._id,
                rating: newReview.rating,
                comment: newReview.comment
            });
            if (res.data.success) {
                showToast("Review submitted for moderation", "success");
                setNewReview({ rating: 5, comment: '' });
            }
        } catch (error) {
            showToast(error.response?.data?.message || "Failed to submit review", "error");
        } finally {
            setIsSubmittingReview(false);
        }
    };

    // If no product selected, don't render anything (well, Context handles isOpen, but still good check)
    // Removed early return to satisfy Rules of Hooks (hooks must be called in same order)
    // if (!selectedProduct && !isOpen) return null;

    // Strip raw RTF/RTF-like codes from description strings from the backend
    const cleanDescription = (text) => {
        if (!text) return null;
        // Detect RTF format
        if (text.trim().startsWith('{\\rtf') || text.includes('\\par')) {
            // Extract readable text: remove RTF control words and braces
            return text
                .replace(/\{\\[^}]*\}/g, '') // Remove groups like {\rtf1 ...}
                .replace(/\\[a-z]+\d*\s?/gi, '') // Remove control words like \par \b \fs22
                .replace(/[{}]/g, '') // Remove remaining braces
                .replace(/\\'/g, "'") // Replace escaped apostrophes
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();
        }
        return text;
    };

    const getComparableProductId = (value) => String(value ?? "").split("::")[0];
    const cartItem = selectedProduct
        ? cart.find(
            (item) =>
                getComparableProductId(item.productId || item.itemId || item.id || item._id) ===
                getComparableProductId(selectedProduct.id || selectedProduct._id),
          )
        : null;
    const quantity = cartItem ? cartItem.quantity : 0;
    const isWishlisted = selectedProduct
        ? isInWishlist(selectedProduct.id || selectedProduct._id)
        : false;

    useEffect(() => {
        if (isOpen) {
            controls.start("visible");
            document.body.style.overflow = "hidden"; // Prevent background scroll
            document.body.style.touchAction = "none"; // Disable swipe background panning
            document.documentElement.style.overflow = "hidden";
        } else {
            controls.start("hidden");
            document.body.style.overflow = "unset";
            document.body.style.touchAction = "auto";
            document.documentElement.style.overflow = "unset";
            setIsExpanded(false);
        }

        // Cleanup function to ensure scroll is restored if component unmounts
        return () => {
            document.body.style.overflow = "unset";
            document.body.style.touchAction = "auto";
            document.documentElement.style.overflow = "unset";
        }
    }, [isOpen, controls]);

    const handleDragEnd = (event, info) => {
        const offset = info.offset.y;
        const velocity = info.velocity.y;

        if (offset > 150 || velocity > 200) {
            // Dragged down significantly -> Close
            closeProduct();
        } else if (offset < -20 || velocity < -200) {
            // Dragged up -> Expand
            setIsExpanded(true);
        } else {
            // Snap back to current state (expanded or initial)
        }
    };

    const toggleWishlist = (e) => {
        e.stopPropagation();
        toggleWishlistGlobal(selectedProduct);
        showToast(
            isWishlisted ? `${selectedProduct.name} removed from wishlist` : `${selectedProduct.name} added to wishlist`,
            isWishlisted ? 'info' : 'success'
        );
    };

    const handleAddToCart = () => {
        addToCart(selectedProduct);
        showToast(`${selectedProduct.name} added to cart`, 'success');
    };

    const handleIncrement = () => updateQuantity(selectedProduct.id || selectedProduct._id, 1);

    const handleDecrement = () => {
        if (quantity === 1) {
            removeFromCart(selectedProduct.id || selectedProduct._id);
        } else {
            updateQuantity(selectedProduct.id || selectedProduct._id, -1);
        }
    };

    // Scroll handler to expand on scroll
    const handleScroll = (e) => {
        if (!isExpanded && e.currentTarget.scrollTop > 5) {
            setIsExpanded(true);
        }
    };

    // Wheel handler for expansion
    const handleWheel = (e) => {
        if (!isExpanded && e.deltaY > 0) {
            setIsExpanded(true);
            e.stopPropagation();
        } else if (isExpanded) {
            // Allow normal scroll but stop propagation to background
            e.stopPropagation();
        }
    };

    if (!selectedProduct) return null;

    const cleanDesc = cleanDescription(selectedProduct?.description);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop - sits above header */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeProduct}
                        className="fixed inset-0 bg-black/60 z-[220] backdrop-blur-sm"
                    />

                    {/* ============================================================ */}
                    {/* DESKTOP LAYOUT: Wide 2-column modal (hidden on mobile) */}
                    {/* ============================================================ */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 30 }}
                        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
                        className="hidden md:flex fixed z-[230] top-[72px] bottom-[16px] left-[3%] right-[3%] lg:left-[6%] lg:right-[6%] xl:left-[12%] xl:right-[12%] bg-white dark:bg-card rounded-3xl shadow-[0_40px_100px_rgba(0,0,0,0.25)] overflow-hidden transition-colors duration-500"
                    >
                        {/* Parent flex container that holds both sides together so the whole modal scrolls */}
                        <div className="flex w-full min-h-full">
                                {/* Left: Image Gallery — sticky to window so it doesn't scroll out of view if you want */}
                                <div className="relative w-[42%] lg:w-[44%] flex-shrink-0 flex flex-col min-h-full sticky top-0 bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-50 dark:from-slate-900 dark:via-emerald-900/10 dark:to-slate-900 transition-colors duration-500">
                                    {/* Top bar with back + wishlist */}
                                    <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-5 z-20">
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={closeProduct}
                                            className="w-10 h-10 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-md shadow-black/5 flex items-center justify-center hover:shadow-lg transition-all border border-gray-100/80 dark:border-white/10"
                                        >
                                            <ArrowLeft size={18} className="text-gray-700 dark:text-slate-300" strokeWidth={2.5} />
                                        </motion.button>

                                        {/* Discount Badge (center) */}
                                        {(selectedProduct.originalPrice > selectedProduct.price && selectedProduct.originalPrice > 0) && (
                                            <motion.div
                                                initial={{ scale: 0, rotate: -10 }}
                                                animate={{ scale: 1, rotate: 0 }}
                                                transition={{ type: 'spring', delay: 0.2 }}
                                                className="bg-gradient-to-r from-[#FE5502] to-[#15a835] text-white text-[10px] font-[800] px-3 py-1.5 rounded-xl uppercase tracking-wider shadow-md shadow-green-200/40"
                                            >
                                                {Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100)}% OFF
                                            </motion.div>
                                        )}

                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.9 }}
                                            onClick={toggleWishlist}
                                            className={cn(
                                                "w-10 h-10 backdrop-blur-md rounded-xl shadow-md shadow-black/5 flex items-center justify-center hover:shadow-lg transition-all border",
                                                isWishlisted ? "bg-red-50/95 dark:bg-red-950/30 border-red-100 dark:border-red-900" : "bg-white/95 dark:bg-slate-800/95 border-gray-100/80 dark:border-white/10"
                                            )}
                                        >
                                            <Heart size={18} className={cn(
                                                "transition-all",
                                                isWishlisted ? 'text-red-500 fill-red-500' : 'text-gray-400 dark:text-slate-500 hover:text-red-400'
                                            )} />
                                        </motion.button>
                                    </div>

                                    {/* Main content area: vertical thumbnails + main image */}
                                    <div className="flex-1 flex mt-[64px] mb-3 overflow-hidden">
                                        {/* Vertical thumbnail strip (left side) */}
                                        {allImages.length > 1 && (
                                            <div className="flex flex-col gap-2 px-3 py-2 overflow-y-auto no-scrollbar">
                                                {allImages.slice(0, 5).map((img, i) => (
                                                    <motion.button
                                                        key={i}
                                                        whileHover={{ scale: 1.08 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => setActiveImageIndex(i)}
                                                        className={cn(
                                                            'w-[52px] h-[52px] lg:w-14 lg:h-14 rounded-xl overflow-hidden flex-shrink-0 transition-all duration-300 border-2',
                                                            i === activeImageIndex
                                                                ? 'border-[#FE5502] shadow-lg shadow-green-100/60 dark:shadow-none ring-2 ring-green-100 dark:ring-green-900/30 bg-white dark:bg-slate-800'
                                                                : 'border-gray-200/60 dark:border-white/5 opacity-50 hover:opacity-90 bg-white/60 dark:bg-slate-800/60'
                                                        )}
                                                    >
                                                        <img src={img} alt="" className="w-full h-full object-contain p-1.5 mix-blend-multiply dark:mix-blend-normal" />
                                                    </motion.button>
                                                ))}
                                            </div>
                                        )}

                                        {/* Main image viewer */}
                                        <div className="flex-1 flex items-center justify-center p-6 lg:p-8 relative min-h-[350px]">
                                            <AnimatePresence mode="wait">
                                                <motion.img
                                                    key={activeImageIndex}
                                                    initial={{ scale: 0.93, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0.93, opacity: 0 }}
                                                    transition={{ duration: 0.15 }}
                                                    src={allImages[activeImageIndex]}
                                                    alt={`${selectedProduct.name} ${activeImageIndex + 1}`}
                                                    className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal drop-shadow-2xl hover:scale-[1.03] transition-transform duration-500 absolute inset-0 m-auto p-12"
                                                />
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    {/* Carousel dot indicators */}
                                    {allImages.length > 1 && (
                                        <div className="flex justify-center gap-2 pb-5">
                                            {allImages.map((_, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setActiveImageIndex(i)}
                                                    className={cn(
                                                        'rounded-full transition-all duration-400',
                                                        i === activeImageIndex ? 'w-8 h-2 bg-[#FE5502]' : 'w-2 h-2 bg-gray-300/60 dark:bg-slate-700/60 hover:bg-gray-400'
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Right: Product Info (scrollable naturally) */}
                                <div className="flex-1 flex flex-col bg-white dark:bg-card transition-colors duration-500">
                                    <div className="flex-1 px-7 py-6 lg:px-8 lg:py-7 space-y-3">

                                        {/* Top badges row */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.1 }}
                                                className="inline-flex items-center gap-1.5 bg-[#f0fdf4] dark:bg-emerald-950/30 border border-green-200/50 dark:border-emerald-800/30 text-[#15803d] dark:text-emerald-400 px-3 py-1.5 rounded-lg text-[10px] font-[700] uppercase tracking-wider"
                                            >
                                                <Clock size={12} strokeWidth={2.5} className="text-[#FE5502] dark:text-emerald-500" />
                                                {selectedProduct.deliveryTime || '8-15 MINS'}
                                            </motion.div>
                                            {selectedProduct.originalPrice > selectedProduct.price && (
                                                <motion.div
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: 0.15 }}
                                                    className="text-[10px] font-[700] text-[#FE5502] dark:text-emerald-500 bg-green-50 dark:bg-green-950/30 px-3 py-1.5 rounded-lg border border-green-200/50 dark:border-emerald-800/30 uppercase tracking-wider"
                                                >
                                                    💰 Save ₹{selectedProduct.originalPrice - selectedProduct.price}
                                                </motion.div>
                                            )}
                                            <motion.div
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.2 }}
                                                className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 rounded-lg text-[10px] font-[700] border border-orange-100/50 dark:border-orange-900/30"
                                            >
                                                <Star size={10} fill="currentColor" />
                                                {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : '4.8'}
                                                <span className="text-orange-400 dark:text-orange-500 font-medium">({reviews.length > 0 ? reviews.length : '120+'})</span>
                                            </motion.div>
                                        </div>

                                        {/* Product Name */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.15 }}
                                        >
                                            <h1 className="text-[22px] lg:text-[26px] font-[800] text-foreground leading-[1.2] tracking-tight mb-1">
                                                {selectedProduct.name}
                                            </h1>
                                            <div className="flex items-center gap-3 mb-2">
                                                {selectedProduct.weight && (
                                                    <span className="text-[13px] text-gray-400 font-[600]">{selectedProduct.weight}</span>
                                                )}
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-full">
                                                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                                        Sold by: <span className="text-foreground">{selectedProduct.storeName || selectedProduct.restaurantName || "Fresh Mart"}</span>
                                                    </span>
                                                    <div className="flex items-center justify-center w-3 h-3 bg-[#FE5502] rounded-full text-white">
                                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="w-2 h-2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>

                                        {/* Price + Add-to-Cart Card */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.2 }}
                                            className="relative overflow-hidden rounded-[20px] border border-green-200/60 dark:border-emerald-800/30 shadow-sm bg-gradient-to-br from-emerald-50/50 to-green-50/30 dark:from-emerald-950/20 dark:to-green-950/10"
                                        >
                                            {/* Decorative subtle patterns */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-3xl" />
                                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />

                                            <div className="relative flex items-center justify-between py-4 px-5">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-[28px] lg:text-[32px] font-[800] text-[#FE5502] tracking-tight leading-none">
                                                            ₹{selectedVariant ? (selectedVariant.salePrice || selectedVariant.price) : selectedProduct.price}
                                                        </span>
                                                        {(selectedVariant ? (selectedVariant.price > selectedVariant.salePrice && selectedVariant.salePrice > 0) : (selectedProduct.originalPrice > selectedProduct.price)) && (
                                                            <span className="text-[14px] text-gray-400 line-through font-[600]">
                                                                ₹{selectedVariant ? selectedVariant.price : selectedProduct.originalPrice}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {(selectedVariant ? (selectedVariant.price > selectedVariant.salePrice && selectedVariant.salePrice > 0) : (selectedProduct.originalPrice > selectedProduct.price)) && (
                                                        <span className="inline-flex w-fit items-center text-[10px] font-[800] text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-md uppercase tracking-wide">
                                                            {selectedVariant 
                                                                ? Math.round(((selectedVariant.price - selectedVariant.salePrice) / selectedVariant.price) * 100)
                                                                : Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100)}% off
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    {quantity > 0 ? (
                                                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-green-200 dark:border-emerald-800/30 rounded-xl p-1 shadow-sm transition-colors">
                                                            <motion.button whileTap={{ scale: 0.85 }} onClick={handleDecrement} className="w-9 h-9 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors">
                                                                <Minus size={16} strokeWidth={2.5} />
                                                            </motion.button>
                                                            <span className="font-[800] text-base text-gray-800 dark:text-slate-200 w-8 text-center">{quantity}</span>
                                                            <motion.button whileTap={{ scale: 0.85 }} onClick={handleIncrement} className="w-9 h-9 bg-primary-orange hover:bg-primary-hover active:bg-primary-dark rounded-lg flex items-center justify-center text-white transition-colors shadow-sm">
                                                                <Plus size={16} strokeWidth={2.5} />
                                                            </motion.button>
                                                        </div>
                                                    ) : (
                                                        <motion.button
                                                            whileHover={{ scale: 1.02 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            onClick={handleAddToCart}
                                                            className="bg-primary-orange hover:bg-primary-hover active:bg-primary-dark text-white h-11 px-6 rounded-xl font-[800] text-[13px] flex items-center gap-2 shadow-md transition-all uppercase tracking-wide border border-primary-orange/20"
                                                        >
                                                            <ShoppingBag size={15} strokeWidth={2.5} />
                                                            Add to Cart
                                                        </motion.button>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>

                                        {/* View Cart */}
                                        {cartCount > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.98 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="flex justify-center -mt-1"
                                            >
                                                <Link
                                                    to={cartPath}
                                                    onClick={closeProduct}
                                                    className="w-[80%] bg-primary-orange hover:bg-primary-hover active:bg-primary-dark text-white h-[40px] rounded-xl flex items-center justify-between px-4 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-[0.98]"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <ShoppingBag size={14} strokeWidth={2.0} />
                                                        <span className="text-[12px] font-[700] uppercase tracking-wider">View Cart</span>
                                                    </div>
                                                    <div className="flex items-center justify-center gap-1.5 bg-white/10 px-2 py-1 rounded-lg">
                                                        <span className="text-[13px] font-[800] tracking-tight">₹{cart.reduce((total, item) => total + (item.price * item.quantity), 0)}</span>
                                                        <ChevronRight size={14} strokeWidth={2.5} />
                                                    </div>
                                                </Link>
                                            </motion.div>
                                        )}

                                        {/* Variants */}
                                        {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: 0.25 }}
                                                className="bg-gray-50/60 dark:bg-slate-900/60 rounded-xl p-3 border border-gray-100/70 dark:border-white/5 transition-colors"
                                            >
                                                <h4 className="text-[10px] font-[700] text-gray-400 dark:text-slate-500 uppercase tracking-[0.14em] mb-2.5">Select Variant</h4>
                                                <div className="flex gap-3 flex-wrap">
                                                    {selectedProduct.variants.map((v, idx) => (
                                                        <motion.button
                                                            key={idx}
                                                            whileHover={{ scale: 1.03 }}
                                                            whileTap={{ scale: 0.97 }}
                                                            onClick={() => setSelectedVariant(v)}
                                                            className={cn(
                                                                'px-4 py-2 font-[600] rounded-lg text-[13px] transition-all border-2',
                                                                selectedVariant?.sku === v.sku
                                                                    ? 'bg-orange-50 dark:bg-orange-950/30 border-primary-orange text-primary-orange shadow-md'
                                                                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-white/5 text-gray-600 dark:text-slate-400 hover:border-gray-300 dark:hover:border-white/10 hover:shadow-sm'
                                                            )}
                                                        >
                                                            {v.name}
                                                        </motion.button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Decorative Divider */}
                                        <div className="relative -mt-1 -mb-1">
                                            <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-slate-800 to-transparent" />
                                            <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-full" />
                                        </div>

                                        {/* Description */}
                                        {cleanDesc && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ delay: 0.3 }}
                                                className="rounded-[16px] p-5 pb-7 border border-gray-100/70 dark:border-white/5 -mt-1 mb-6 shadow-sm bg-slate-50 dark:bg-slate-900 transition-colors"
                                            >
                                                <h3 className="font-[800] text-gray-900 dark:text-slate-100 mb-3 text-[14px] tracking-tight flex items-center gap-2">
                                                    <span className="w-1 h-3.5 bg-[#FE5502] rounded-full" />
                                                    About this product
                                                </h3>
                                                <div
                                                    className="text-[12.5px] text-gray-500 dark:text-slate-400 font-[500] leading-[1.8] pl-3 whitespace-pre-line"
                                                    dangerouslySetInnerHTML={{ __html: cleanDesc }}
                                                />
                                            </motion.div>
                                        )}

                                        {/* Product Details Grid — with accent icons */}
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.35 }}
                                        >
                                            <h3 className="font-[700] text-gray-900 dark:text-slate-100 mb-2.5 text-[14px] tracking-tight flex items-center gap-2">
                                                <span className="w-0.5 h-4 bg-[#FE5502] rounded-full" />
                                                Product Details
                                            </h3>
                                            <div className="grid grid-cols-2 gap-2.5">
                                                {[
                                                    { label: 'Shelf Life', value: '3 Days', emoji: '📅' },
                                                    { label: 'Country of Origin', value: 'India', emoji: '🇮🇳' },
                                                    { label: 'FSSAI License', value: '1001234567890', emoji: '🛡️' },
                                                    { label: 'Customer Care', value: supportEmail, emoji: '📧' }
                                                ].map((d, idx) => (
                                                    <motion.div
                                                        key={d.label}
                                                        initial={{ opacity: 0, y: 6 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.35 + idx * 0.04 }}
                                                        className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-gray-100/70 dark:border-white/5 hover:shadow-sm hover:border-gray-200/70 dark:hover:border-white/10 transition-all duration-300 group"
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-sm mt-0.5 group-hover:scale-110 transition-transform">{d.emoji}</span>
                                                            <div>
                                                                <span className="text-gray-400 dark:text-slate-500 text-[9px] block mb-0.5 font-[600] uppercase tracking-[0.1em]">{d.label}</span>
                                                                <span className="font-[700] text-gray-800 dark:text-slate-200 text-[12px]">{d.value}</span>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </motion.div>

                                        {/* Trust Badges */}
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.4 }}
                                            className="grid grid-cols-3 gap-2"
                                        >
                                            {[
                                                { icon: '🌿', label: 'Fresh & Organic', sub: 'Farm sourced' },
                                                { icon: '⚡', label: 'Express Delivery', sub: 'Under 15 mins' },
                                                { icon: '✅', label: 'Quality Assured', sub: '3x checked' }
                                            ].map((t, i) => (
                                                <div key={i} className="text-center p-2.5 rounded-lg bg-gray-50/50 dark:bg-slate-900/50 border border-gray-100/40 dark:border-white/5 hover:bg-white dark:hover:bg-slate-800 hover:border-gray-200/50 dark:hover:border-white/10 hover:shadow-sm transition-all duration-300">
                                                    <span className="text-base block mb-0.5">{t.icon}</span>
                                                    <p className="text-[9px] font-[700] text-gray-700 dark:text-slate-300 uppercase tracking-wider leading-tight">{t.label}</p>
                                                    <p className="text-[8px] text-gray-400 dark:text-slate-500 font-[500] mt-0.5">{t.sub}</p>
                                                </div>
                                            ))}
                                        </motion.div>

                                        {/* Decorative Divider */}
                                        <div className="relative">
                                            <div className="h-px bg-gradient-to-r from-transparent via-gray-200/80 dark:via-slate-800 to-transparent" />
                                            <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-full" />
                                        </div>

                                        {/* Reviews */}
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.45 }}
                                            className="space-y-4"
                                        >
                                            <h3 className="text-[14px] font-[700] text-gray-900 dark:text-slate-100 flex items-center justify-between tracking-tight">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-0.5 h-4 bg-orange-400 rounded-full" />
                                                    Customer Reviews
                                                </span>
                                                <div className="flex items-center gap-1 px-2.5 py-1 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 rounded-lg text-[10px] font-[700] border border-orange-100/50 dark:border-orange-900/30">
                                                    <Star size={10} fill="currentColor" />
                                                    {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : '4.8'}
                                                    <span className="text-orange-400 dark:text-orange-500 font-[500] text-[9px]">({reviews.length > 0 ? reviews.length : '120+'} reviews)</span>
                                                </div>
                                            </h3>

                                            {/* Review Form */}
                                            <div className="bg-gradient-to-br from-slate-50/80 to-gray-50/80 dark:from-slate-900/80 dark:to-slate-950/80 p-4 rounded-xl border border-slate-100/70 dark:border-white/5 transition-colors">
                                                <h4 className="font-[700] text-gray-800 dark:text-slate-200 text-[13px] mb-2.5 flex items-center gap-2">
                                                    <MessageSquare size={13} className="text-[#FE5502]" />
                                                    Rate this product
                                                </h4>
                                                <form onSubmit={handleReviewSubmit} className="space-y-2.5">
                                                    <div className="flex gap-1.5">
                                                        {[1, 2, 3, 4, 5].map((s) => (
                                                            <motion.button
                                                                key={s}
                                                                type="button"
                                                                whileHover={{ scale: 1.12 }}
                                                                whileTap={{ scale: 0.9 }}
                                                                onClick={() => setNewReview({ ...newReview, rating: s })}
                                                                className={cn(
                                                                    'h-8 w-8 rounded-lg flex items-center justify-center transition-all',
                                                                    newReview.rating >= s ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-500 shadow-sm shadow-orange-100 dark:shadow-none' : 'bg-white dark:bg-slate-800 text-gray-300 dark:text-slate-600 border border-gray-100 dark:border-white/5 hover:border-orange-200'
                                                                )}
                                                            >
                                                                <Star size={14} className={cn(newReview.rating >= s && 'fill-current')} />
                                                            </motion.button>
                                                        ))}
                                                    </div>
                                                    <textarea value={newReview.comment} onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })} placeholder="Share your experience..." className="w-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-white/5 rounded-lg p-3 text-[12px] font-[500] min-h-[70px] outline-none focus:border-[#FE5502]/40 focus:ring-2 focus:ring-green-50 dark:focus:ring-green-900/20 transition-all resize-none dark:text-slate-200" />
                                                    <Button type="submit" disabled={isSubmittingReview} className="w-full h-9 bg-gray-900 dark:bg-foreground hover:bg-gray-800 dark:text-background font-[700] rounded-lg text-[10px] uppercase tracking-widest transition-all hover:shadow-md active:scale-[0.98]">
                                                        {isSubmittingReview ? 'Submitting...' : 'Post Review'}
                                                    </Button>
                                                </form>
                                            </div>

                                            {/* Reviews List */}
                                            <div className="space-y-2.5">
                                                {reviewLoading ? (
                                                    <div className="flex justify-center py-6"><Loader2 className="animate-spin text-[#FE5502]" size={20} /></div>
                                                ) : reviews.length > 0 ? (
                                                    reviews.map((r, rIdx) => (
                                                        <motion.div
                                                            key={r._id}
                                                            initial={{ opacity: 0, y: 6 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: 0.08 * rIdx }}
                                                            className="p-3 rounded-lg border border-gray-100/70 dark:border-white/5 space-y-1.5 hover:shadow-sm hover:border-gray-200/70 dark:hover:border-white/10 transition-all duration-300 bg-white dark:bg-card"
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-green-100 to-emerald-50 dark:from-emerald-900 dark:to-green-950 flex items-center justify-center text-[9px] font-[800] text-[#FE5502] dark:text-emerald-400 ring-1 ring-green-50 dark:ring-white/5">{r.userId?.name?.[0] || 'A'}</div>
                                                                    <div>
                                                                        <p className="text-[11px] font-[700] text-gray-800 dark:text-slate-200">{r.userId?.name || 'Anonymous'}</p>
                                                                        <div className="flex gap-0.5">{[...Array(5)].map((_, i) => <Star key={i} size={9} className={cn(i < r.rating ? 'text-orange-400 fill-orange-400' : 'text-gray-200 dark:text-slate-800')} />)}</div>
                                                                    </div>
                                                                </div>
                                                                <span className="text-[9px] font-[600] text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                                                            </div>
                                                            <p className="text-[11px] text-gray-500 dark:text-slate-400 font-[500] leading-relaxed pl-9">{r.comment}</p>
                                                        </motion.div>
                                                    ))
                                                ) : (
                                                    <div className="py-8 text-center bg-gradient-to-b from-gray-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-xl border border-dashed border-gray-200 dark:border-white/5">
                                                        <MessageSquare size={20} className="text-gray-300 mx-auto mb-1.5" />
                                                        <p className="text-[10px] font-[600] text-gray-400 uppercase tracking-widest">No reviews yet — be the first!</p>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>

                                        {/* Bottom spacer */}
                                        <div className="h-6" />
                                    </div>
                                </div>
                            </div>
                    </motion.div>

                    {/* ============================================================ */}
                    {/* MOBILE LAYOUT: Bottom sheet (hidden on desktop md+) */}
                    {/* ============================================================ */}
                    <motion.div
                        drag={isExpanded ? false : "y"}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={0.7}
                        onDragEnd={handleDragEnd}
                        initial={{
                            opacity: 0,
                            scale: 0.9,
                            y: "100vh",
                            top: "10%",
                            bottom: "10%",
                            left: "50%",
                            x: "-50%",
                            width: "min(90%, 400px)",
                            borderRadius: "24px"
                        }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            y: 0,
                            top: isExpanded ? 0 : "10%",
                            bottom: isExpanded ? 0 : "10%",
                            left: isExpanded ? 0 : "50%",
                            x: isExpanded ? 0 : "-50%",
                            width: isExpanded ? "100%" : "min(90%, 400px)",
                            borderRadius: isExpanded ? 0 : "24px"
                        }}
                        exit={{ opacity: 0, scale: 0.9, y: "100vh", transition: { duration: 0.3 } }}
                        transition={{
                            type: "spring",
                            damping: 25,
                            stiffness: 400,
                            mass: 0.8
                        }}
                        className={cn(
                            "md:hidden fixed z-[230] bg-white dark:bg-card shadow-2xl overflow-hidden flex flex-col",
                        )}
                        style={{ willChange: "transform, top, bottom, left, width, border-radius" }}
                    >
                        {/* Drag Handle (Visible only when not fully expanded) */}
                        {!isExpanded && (
                            <div className="absolute top-0 left-0 right-0 h-8 flex justify-center items-center z-50 pointer-events-none">
                                <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full" />
                            </div>
                        )}

                        {/* Header Actions (Absolute & Sticky) */}
                        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-40 pointer-events-none">
                            <motion.button
                                onClick={closeProduct}
                                whileTap={{ scale: 0.9 }}
                                className="w-10 h-10 bg-white dark:bg-slate-800 shadow-lg rounded-full flex items-center justify-center border border-gray-100 dark:border-white/10 pointer-events-auto"
                            >
                                <ArrowLeft size={24} className="text-[#FE5502] dark:text-emerald-500" strokeWidth={3} />
                            </motion.button>
                            <div className="flex gap-3 pointer-events-auto invisible">
                                {/* Hidden as per request to simplify the view */}
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div
                            className={cn(
                                "flex-1 overflow-x-hidden no-scrollbar pb-24 bg-white dark:bg-card",
                                isExpanded ? "overflow-y-auto" : "overflow-y-hidden"
                            )}
                            onScroll={handleScroll}
                            onWheel={handleWheel}
                        >
                            {/* Product Image Carousel */}
                            <div className="relative w-full aspect-[4/3] bg-gradient-to-b from-[#F5F7F8] to-white dark:from-slate-900 dark:to-card pt-16 pb-8 transition-colors duration-500">
                                <div
                                    ref={scrollRef}
                                    className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar h-full w-full"
                                    onScroll={(e) => {
                                        const index = Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth);
                                        setActiveImageIndex(index);
                                    }}
                                >
                                    {allImages.map((img, i) => (
                                        <div key={i} className="flex-shrink-0 w-full h-full snap-center flex items-center justify-center px-12">
                                            <motion.img
                                                initial={{ scale: 0.8, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ duration: 0.4 }}
                                                src={img}
                                                alt={`${selectedProduct.name} ${i + 1}`}
                                                className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal drop-shadow-xl"
                                            />
                                        </div>
                                    ))}
                                </div>

                                {/* Carousel Dots */}
                                {allImages.length > 1 && (
                                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
                                        {allImages.map((_, i) => (
                                            <div
                                                key={i}
                                                className={cn(
                                                    "h-1.5 rounded-full transition-all duration-300",
                                                    i === activeImageIndex ? "w-6 bg-[#FE5502]" : "w-1.5 bg-gray-300"
                                                )}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Product Info Container */}
                            <div className="px-5 pt-2 pb-6">
                                {/* Delivery Time Badge */}
                                <div className="inline-flex items-center gap-1.5 bg-[#F0FDF4] border border-green-100 text-[#15803d] px-2.5 py-1 rounded-lg text-[10px] font-black uppercase mb-3">
                                    <Clock size={12} strokeWidth={3} />
                                    {selectedProduct.deliveryTime || "8 Mins"}
                                </div>

                                <h2 className="text-2xl font-black text-[#1A1A1A] leading-tight mb-1">
                                    {selectedProduct.name}
                                </h2>
                                <div className="flex items-center gap-1.5 mb-4">
                                    <div className="w-4 h-4 bg-[#FE5502]/10 rounded flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-[#FE5502] rounded-full" />
                                    </div>
                                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                                        Sold by: <span className="text-[#1A1A1A]">{selectedProduct.storeName || selectedProduct.restaurantName || "Fresh Mart"}</span>
                                    </span>
                                </div>
                                {cleanDesc && (
                                    <div
                                        className="text-sm text-gray-500 font-medium leading-relaxed mb-6 whitespace-pre-line"
                                        dangerouslySetInnerHTML={{ __html: cleanDesc }}
                                    />
                                )}

                                {/* Variants Section */}
                                {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                                    <div className="mb-6">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Variant</h4>
                                        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                                            {selectedProduct.variants.map((v, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setSelectedVariant(v)}
                                                    className={cn(
                                                        "flex-shrink-0 px-4 py-2 font-bold rounded-xl text-sm transition-all relative overflow-hidden",
                                                        selectedVariant?.sku === v.sku
                                                            ? "bg-white border-2 border-primary text-orange-700 shadow-sm shadow-blue-100"
                                                            : "bg-gray-50 border border-gray-200 text-gray-600"
                                                    )}
                                                >
                                                    {v.name}
                                                    {selectedVariant?.sku === v.sku && (
                                                        <div className="absolute top-0 right-0 w-3 h-3 bg-primary rounded-bl-lg" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="h-px bg-gray-100 my-6" />

                                {/* Nutrition / Details (Mock) */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-gray-900">Product Details</h3>
                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                            <span className="text-gray-400 block mb-1">Shelf Life</span>
                                            <span className="font-bold text-gray-800">3 Days</span>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                            <span className="text-gray-400 block mb-1">Country of Origin</span>
                                            <span className="font-bold text-gray-800">India</span>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                            <span className="text-gray-400 block mb-1">FSSAI License</span>
                                            <span className="font-bold text-gray-800">1001234567890</span>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                            <span className="text-gray-400 block mb-1">Customer Care</span>
                                            <span className="font-bold text-gray-800">{supportEmail}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-px bg-gray-100 my-8" />

                                {/* Reviews Section */}
                                <div className="space-y-6">
                                    <h3 className="text-xl font-black text-gray-900 flex items-center justify-between">
                                        Customer Reviews
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 text-orange-600 rounded-lg text-xs font-bold">
                                            <Star size={14} fill="currentColor" />
                                            {reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : '4.8'}
                                        </div>
                                    </h3>

                                    {/* Submissions form (Foldable or inline) */}
                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                        <h4 className="font-bold text-gray-800 text-sm mb-1">Rate this product</h4>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-4">Reviews are moderated</p>

                                        <form onSubmit={handleReviewSubmit} className="space-y-4">
                                            <div className="flex gap-2">
                                                {[1, 2, 3, 4, 5].map((s) => (
                                                    <button
                                                        key={s}
                                                        type="button"
                                                        onClick={() => setNewReview({ ...newReview, rating: s })}
                                                        className={cn(
                                                            "h-10 w-10 rounded-xl flex items-center justify-center transition-all",
                                                            newReview.rating >= s ? "bg-orange-100 text-orange-500" : "bg-white text-gray-300 border border-gray-100"
                                                        )}
                                                    >
                                                        <Star size={18} className={cn(newReview.rating >= s && "fill-current")} />
                                                    </button>
                                                ))}
                                            </div>
                                            <textarea
                                                value={newReview.comment}
                                                onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                                                placeholder="Write your experience..."
                                                className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-sm font-medium min-h-[100px] outline-none focus:border-primary/50 transition-all resize-none"
                                            />
                                            <Button
                                                type="submit"
                                                disabled={isSubmittingReview}
                                                className="w-full h-12 bg-gray-900 hover:bg-black text-white font-black rounded-xl text-xs uppercase tracking-widest"
                                            >
                                                {isSubmittingReview ? "Submitting..." : "Post Review"}
                                            </Button>
                                        </form>
                                    </div>

                                    {/* Reviews List */}
                                    <div className="space-y-4">
                                        {reviewLoading ? (
                                            <div className="flex justify-center py-8">
                                                <Loader2 className="animate-spin text-primary" size={24} />
                                            </div>
                                        ) : reviews.length > 0 ? (
                                            reviews.map((r) => (
                                                <div key={r._id} className="p-5 rounded-2xl border border-gray-100 space-y-2">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center text-[10px] font-black text-primary">
                                                                {r.userId?.name?.[0] || "A"}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-gray-800">{r.userId?.name || "Anonymous"}</p>
                                                                <div className="flex gap-0.5">
                                                                    {[...Array(5)].map((_, i) => (
                                                                        <Star key={i} size={10} className={cn(i < r.rating ? "text-orange-400 fill-orange-400" : "text-gray-200")} />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] font-bold text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-600 font-medium leading-relaxed">{r.comment}</p>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-10 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No reviews yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="h-24" /> {/* Bottom spacer for sticky bar */}
                            </div>
                        </div>

                        {/* Sticky Bottom Action Bar */}
                        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-400 line-through decoration-gray-400/50">
                                                ₹{selectedVariant?.price || selectedProduct.originalPrice}
                                            </span>
                                            <span className="bg-green-100 text-green-700 text-[10px] font-black px-1.5 py-0.5 rounded">
                                                {selectedVariant
                                                    ? Math.round(((selectedVariant.price - selectedVariant.salePrice) / selectedVariant.price) * 100)
                                                    : Math.round(((selectedProduct.originalPrice - selectedProduct.price) / selectedProduct.originalPrice) * 100) || 20}% OFF
                                            </span>
                                        </div>
                                        <div className="text-2xl font-black text-[#1A1A1A]">
                                            ₹{selectedVariant?.salePrice || selectedVariant?.price || selectedProduct.price}
                                        </div>
                                    </div>

                                    {quantity > 0 ? (
                                        <div className="flex items-center gap-3 bg-white border-2 border-green-500 rounded-xl p-1.5 shadow-lg shadow-green-100 flex-1 justify-between max-w-[180px]">
                                            <motion.button
                                                whileTap={{ scale: 0.9 }}
                                                onClick={handleDecrement}
                                                className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-700 hover:bg-green-100 transition-colors"
                                            >
                                                <Minus size={18} strokeWidth={3} />
                                            </motion.button>
                                            <span className="font-black text-lg text-gray-800 w-8 text-center">{quantity}</span>
                                            <motion.button
                                                whileTap={{ scale: 0.9 }}
                                                onClick={handleIncrement}
                                                className="w-10 h-10 bg-[#FE5502] rounded-lg flex items-center justify-center text-white hover:bg-[#ea580c] transition-colors shadow-md shadow-green-100"
                                            >
                                                <Plus size={18} strokeWidth={3} />
                                            </motion.button>
                                        </div>
                                    ) : (
                                        <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            onClick={handleAddToCart}
                                            className="flex-1 bg-[#FE5502] text-white h-[52px] rounded-xl font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-green-100 hover:bg-[#ea580c] transition-all"
                                        >
                                            ADD TO CART
                                        </motion.button>
                                    )}
                                </div>

                                {/* View Cart Button */}
                                {cartCount > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="mt-2"
                                    >
                                        <Link
                                            to={cartPath}
                                            onClick={closeProduct}
                                            className="w-full bg-[#FE5502] text-white h-[56px] rounded-xl flex items-center justify-between px-5 shadow-lg shadow-green-100/50 hover:bg-[#ea580c] transition-all active:scale-[0.98]"
                                        >
                                            <div className="flex flex-col items-start leading-none">
                                                <span className="text-[13px] font-[1000] uppercase tracking-wide">View cart</span>
                                                <span className="text-[11px] font-bold opacity-90 mt-1">{cartCount} {cartCount === 1 ? 'item' : 'items'} in cart</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[16px] font-[1000] tracking-tight">₹{cart.reduce((total, item) => total + (item.price * item.quantity), 0)}</span>
                                                <ChevronRight size={18} strokeWidth={4} />
                                            </div>
                                        </Link>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default ProductDetailSheet;
