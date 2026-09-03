import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Heart, Search, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useProductDetail } from '../context/ProductDetailContext';
import { useToast } from '@shared/components/ui/Toast';
import { cn } from '@/lib/utils';

import ProductCard from '../components/shared/ProductCard';
import ProductDetailSheet from '../components/shared/ProductDetailSheet';
import { customerApi } from '../services/customerApi';
import MiniCart from '../components/shared/MiniCart';
import { resolveQuickImageUrl } from '../utils/image';
import { useLocation as useAppLocation } from '../context/LocationContext';

const QUICK_THEME_STORAGE_KEY = "food.quick.headerColor";
const QUICK_HEADER_RETURN_STORAGE_KEY = "food.quick.headerReturn";
const FALLBACK_HEADER_COLOR = "#FE5502";

const CategoryProductsPage = () => {
    const { categoryId: catId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { currentLocation } = useAppLocation();
    const urlSubCategoryId = searchParams.get('subCategory') || location.state?.activeSubcategoryId || 'all';
    const { isOpen: isProductDetailOpen } = useProductDetail();
    const [selectedSubCategory, setSelectedSubCategory] = useState(urlSubCategoryId);
    const [category, setCategory] = useState(null);
    const [subCategories, setSubCategories] = useState([{ id: 'all', name: 'All', icon: 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png' }]);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [headerTheme, setHeaderTheme] = useState(FALLBACK_HEADER_COLOR);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const storedTheme = window.sessionStorage.getItem(QUICK_THEME_STORAGE_KEY);
        const storedHeaderReturn = window.sessionStorage.getItem(QUICK_HEADER_RETURN_STORAGE_KEY);

        if (storedTheme && /^#[0-9a-fA-F]{6}$/.test(storedTheme)) {
            setHeaderTheme(storedTheme);
            return;
        }

        if (storedHeaderReturn) {
            try {
                const parsed = JSON.parse(storedHeaderReturn);
                if (parsed?.color && /^#[0-9a-fA-F]{6}$/.test(parsed.color)) {
                    setHeaderTheme(parsed.color);
                }
            } catch (error) {
                // Ignore malformed stored header context.
            }
        }
    }, []);

    const handleSelectSubCategory = (subId) => {
        setSelectedSubCategory(subId);
        const newParams = new URLSearchParams(searchParams);
        if (subId === 'all') {
            newParams.delete('subCategory');
        } else {
            newParams.set('subCategory', subId);
        }
        setSearchParams(newParams, { replace: true });
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const hasValidLocation =
                Number.isFinite(currentLocation?.latitude) &&
                Number.isFinite(currentLocation?.longitude);

            const productParams = {
                categoryId: catId,
                limit: 100,
                ...(hasValidLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : {})
            };

            const [catResult, prodResult] = await Promise.allSettled([
                customerApi.getCategoryDetails(catId, { forceRefresh: true }),
                customerApi.getProducts(productParams, { forceRefresh: true }),
            ]);

            // 1. Process Category & Subcategories (Fast single-category endpoint)
            if (catResult.status === 'fulfilled' && catResult.value?.data?.success) {
                const data = catResult.value.data.result || {};
                const currentCat = data.category;
                const subs = Array.isArray(data.subcategories) ? data.subcategories : [];

                if (currentCat) {
                    setCategory(currentCat);
                    const formattedSubs = subs.map(s => ({
                        id: s._id || s.id,
                        name: s.name,
                        icon: s.image || 'https://cdn-icons-png.flaticon.com/128/2321/2321801.png'
                    }));
                    setSubCategories([
                        { id: 'all', name: 'All', icon: 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png' },
                        ...formattedSubs
                    ]);
                }
            } else {
                // Fallback: fetch shallow categories if single lookup fails
                try {
                    const fallbackCatRes = await customerApi.getCategories();
                    const allCats = fallbackCatRes?.data?.results || fallbackCatRes?.data?.result || [];
                    const currentCat = allCats.find(c => String(c._id || c.id) === String(catId));
                    if (currentCat) {
                        setCategory(currentCat);
                        const subs = allCats.filter(c => String(c.parentId?._id || c.parentId || '') === String(catId));
                        const formattedSubs = subs.map(s => ({
                            id: s._id || s.id,
                            name: s.name,
                            icon: s.image || 'https://cdn-icons-png.flaticon.com/128/2321/2321801.png'
                        }));
                        setSubCategories([
                            { id: 'all', name: 'All', icon: 'https://cdn-icons-png.flaticon.com/128/2321/2321831.png' },
                            ...formattedSubs
                        ]);
                    }
                } catch (e) {
                    console.error("Fallback category fetch error:", e);
                }
            }

            // 2. Process Products
            if (prodResult.status === 'fulfilled' && prodResult.value?.data?.success) {
                const rawResult = prodResult.value.data.result;
                const dbProds = Array.isArray(prodResult.value.data.results)
                    ? prodResult.value.data.results
                    : Array.isArray(rawResult?.items)
                        ? rawResult.items
                        : Array.isArray(rawResult)
                            ? rawResult
                            : [];

                const formattedProds = dbProds.map(p => ({
                    ...p,
                    id: p._id || p.id,
                    image: p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2",
                    price: Number(p.salePrice || 0) > 0 ? Number(p.salePrice) : Number(p.price || 0),
                    originalPrice: Number(p.originalPrice || p.mrp || p.price || 0),
                    deliveryTime: "8-15 mins"
                }));
                setProducts(formattedProds);
            }
        } catch (error) {
            console.error("Error fetching category products:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const subParam = searchParams.get('subCategory');
        if (subParam) {
            setSelectedSubCategory(subParam);
        } else if (!location.state?.activeSubcategoryId) {
            setSelectedSubCategory('all');
        }
    }, [searchParams]);

    useEffect(() => {
        fetchData();
    }, [catId, currentLocation?.latitude, currentLocation?.longitude]);

    const safeProducts = Array.isArray(products) ? products : [];

    const filteredProducts = safeProducts.filter(p => {
        if (selectedSubCategory === 'all') return true;
        const pSubId = String(p.subcategoryId?._id || p.subcategoryId || '');
        const pCatId = String(p.categoryId?._id || p.categoryId || '');
        const targetId = String(selectedSubCategory);
        return pSubId === targetId || pCatId === targetId;
    });

    const productsById = React.useMemo(() => {
        const map = {};
        safeProducts.forEach(p => {
            map[p._id || p.id] = p;
        });
        return map;
    }, [safeProducts]);

    return (
        <div className="flex min-h-screen flex-col bg-white dark:bg-background font-sans pt-0 transition-colors duration-500">
            <div className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col">
                {/* Category Subheader */}
                <header className={cn(
                    "sticky top-0 z-30 px-4 py-4 flex items-center justify-between border-b border-white/20 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-md",
                    isProductDetailOpen && "hidden md:flex"
                )}
                    style={{
                        backgroundImage: `linear-gradient(180deg, ${headerTheme} 0%, ${headerTheme}F2 100%)`,
                    }}>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-1 hover:bg-white/15 rounded-full transition-colors"
                        >
                            <ChevronLeft size={24} className="text-white" />
                        </button>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/75">
                                Quick Category
                            </span>
                            <h1 className="text-[18px] font-bold text-white tracking-tight">
                                {category?.name || catId}
                            </h1>
                        </div>
                    </div>

                </header>

                <div className="flex flex-1 relative items-start">
                    {/* Sidebar */}
                    <aside className="w-20 md:w-28 border-r border-gray-50 dark:border-white/5 flex flex-col bg-white dark:bg-card overflow-y-auto hide-scrollbar sticky top-0 h-screen pb-32 transition-colors">
                        {subCategories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => handleSelectSubCategory(cat.id)}
                                className={cn(
                                    "flex flex-col items-center py-4 px-1 gap-2 transition-all relative border-l-4",
                                    selectedSubCategory === cat.id
                                        ? "bg-orange-50 dark:bg-orange-950/30 border-[#FE5502]"
                                        : "border-transparent hover:bg-gray-50 dark:hover:bg-white/5"
                                )}
                            >
                                <div className={cn(
                                    "w-12 h-12 rounded-2xl flex items-center justify-center p-2 transition-all duration-300",
                                    selectedSubCategory === cat.id ? "scale-110" : "grayscale opacity-70"
                                )}>
                                    <img src={resolveQuickImageUrl(cat.icon)} alt={cat.name} className="w-full h-full object-contain" />
                                </div>
                                <span className={cn(
                                    "text-[10px] text-center font-bold font-sans leading-tight px-1",
                                    selectedSubCategory === cat.id ? "text-[#FE5502]" : "text-gray-500"
                                )}>
                                    {cat.name}
                                </span>
                            </button>
                        ))}
                    </aside>

                    {/* Content */}
                    <main className="flex-1 px-3 pt-1 pb-24 bg-white dark:bg-background transition-colors">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2 gap-y-4 md:gap-4 lg:gap-6">
                            {filteredProducts.map((product) => (
                                <ProductCard key={product.id} product={product} compact={true} />
                            ))}
                            {filteredProducts.length === 0 && !isLoading && (
                                <div className="col-span-2 py-20 text-center">
                                    <p className="text-gray-400 font-bold italic">No products found in this category</p>
                                </div>
                            )}
                        </div>
                    </main>
                </div>

                <MiniCart />
                <ProductDetailSheet />
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
                    
                    body {
                        font-family: 'Outfit', sans-serif;
                    }
                    .hide-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                    .hide-scrollbar {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `}} />
        </div>
    );
};

export default CategoryProductsPage;
