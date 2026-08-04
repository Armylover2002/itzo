import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { Search, ArrowLeft, X, ChevronRight, History, Mic } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import ProductCard from '../components/shared/ProductCard';
import { useProductDetail } from '../context/ProductDetailContext';
import { useSettings } from '@core/context/SettingsContext';
import { cn } from '@/lib/utils';
import { useLocation as useAppLocation } from '../context/LocationContext';
import MiniCart from '../components/shared/MiniCart';

const SearchPage = () => {
    const navigate = useNavigate();
    const location = useRouterLocation();
    const { isOpen: isProductDetailOpen } = useProductDetail();
    const { settings } = useSettings();
    const { currentLocation } = useAppLocation();

    // Get initial query from URL state or params
    const initialQuery = location.state?.query || new URLSearchParams(location.search).get('q') || '';

    const [query, setQuery] = useState(initialQuery);
    const [allProducts, setAllProducts] = useState([]);
    const [lowestPriceProducts, setLowestPriceProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const trimmedQuery = query.trim();

    // Manage Recent Searches with LocalStorage
    const [pastSearches, setPastSearches] = useState(() => {
        const saved = localStorage.getItem('appzeto_recent_searches');
        return saved ? JSON.parse(saved) : [];
    });

    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const mapProducts = (products = []) =>
        products.map((p) => ({
            ...p,
            id: p._id,
            image: p.mainImage || p.image || 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2',
            price: p.salePrice || p.price,
            originalPrice: p.price,
            weight: p.weight || '1 unit',
            deliveryTime: '8-15 mins'
        }));

    // Fetch lowest price products on mount
    useEffect(() => {
        const fetchLowestPriceProducts = async () => {
            const hasValidLocation =
                Number.isFinite(currentLocation?.latitude) &&
                Number.isFinite(currentLocation?.longitude);
            if (!hasValidLocation) {
                setLowestPriceProducts([]);
                setIsInitialLoading(false);
                return;
            }
            setIsInitialLoading(true);
            try {
                const response = await customerApi.getProducts({
                    limit: 10,
                    sortBy: 'price_asc',
                    lat: currentLocation.latitude,
                    lng: currentLocation.longitude,
                });
                if (response.data.success) {
                    const rawResult = response.data.result;
                    const dbProds = Array.isArray(response.data.results)
                        ? response.data.results
                        : Array.isArray(rawResult?.items)
                        ? rawResult.items
                        : Array.isArray(rawResult)
                        ? rawResult
                        : [];
                    setLowestPriceProducts(mapProducts(dbProds));
                }
            } catch (error) {
                console.error('Error fetching lowest price products:', error);
            } finally {
                setIsInitialLoading(false);
            }
        };
        fetchLowestPriceProducts();
    }, [currentLocation?.latitude, currentLocation?.longitude]);

    // Save search term to history
    const saveSearch = (term) => {
        if (!term.trim()) return;
        const updated = [term, ...pastSearches.filter(s => s !== term)].slice(0, 10);
        setPastSearches(updated);
        localStorage.setItem('appzeto_recent_searches', JSON.stringify(updated));
    };

    // Remove specific search term
    const handleRemoveSearch = (e, term) => {
        e.stopPropagation();
        const updated = pastSearches.filter(s => s !== term);
        setPastSearches(updated);
        localStorage.setItem('appzeto_recent_searches', JSON.stringify(updated));
    };

    // Trigger save on Enter or clicking a result
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && trimmedQuery) {
            saveSearch(trimmedQuery);
        }
    };

    useEffect(() => {
        const hasValidLocation =
            Number.isFinite(currentLocation?.latitude) &&
            Number.isFinite(currentLocation?.longitude);

        if (!trimmedQuery || !hasValidLocation) {
            setAllProducts([]);
            return undefined;
        }

        let isCancelled = false;

        const fetchSearchResults = async () => {
            setIsLoading(true);
            try {
                const response = await customerApi.searchProducts({
                    search: trimmedQuery,
                    limit: 100,
                    lat: currentLocation.latitude,
                    lng: currentLocation.longitude,
                });

                if (!response?.data?.success || isCancelled) {
                    return;
                }

                const rawResult = response.data.result;
                const dbProds = Array.isArray(response.data.results)
                    ? response.data.results
                    : Array.isArray(rawResult?.items)
                    ? rawResult.items
                    : Array.isArray(rawResult)
                    ? rawResult
                    : [];

                setAllProducts(mapProducts(dbProds));
            } catch (error) {
                if (!isCancelled) {
                    console.error('Error fetching quick search results:', error);
                    setAllProducts([]);
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        const timeoutId = window.setTimeout(fetchSearchResults, 250);

        return () => {
            isCancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [trimmedQuery, currentLocation?.latitude, currentLocation?.longitude]);

    const results = useMemo(() => {
        if (!trimmedQuery) return [];
        return allProducts.filter((p) =>
            p.name?.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
            p.categoryId?.name?.toLowerCase().includes(trimmedQuery.toLowerCase())
        );
    }, [trimmedQuery, allProducts]);

    const handleClear = () => {
        setQuery('');
    };

    const handleVoiceSearch = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Voice search is not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                setQuery(transcript);
                saveSearch(transcript);
            }
        };
        recognition.start();
    };

    return (
        <div className="min-h-screen bg-[#F5F7F8] dark:bg-background font-outfit transition-colors duration-500">
            {/* Search Input */}
            <div className={cn(
                "sticky top-0 z-50 bg-[#F5F7F8] dark:bg-background shadow-sm border-b dark:border-white/5",
                isProductDetailOpen && "hidden md:block"
            )}>
                <div className="relative px-4 pt-4 pb-4 flex items-center md:justify-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-full transition-colors flex-shrink-0 md:absolute md:left-4 z-10"
                    >
                        <ArrowLeft size={24} className="text-slate-800 dark:text-slate-200" />
                    </button>

                    <div className="flex-1 relative md:flex-none md:w-[500px] lg:w-[600px]">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2">
                            <Search size={20} className="text-slate-400" />
                        </div>
                        <input
                            autoFocus
                            type="text"
                            placeholder='Search quick products like "eggs"'
                            value={query}
                            onKeyDown={handleKeyDown}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full h-12 bg-slate-50 dark:bg-card rounded-2xl pl-11 pr-10 border border-slate-100 dark:border-white/5 outline-none text-slate-800 dark:text-slate-200 font-bold placeholder:text-slate-400 placeholder:font-medium focus:ring-2 focus:ring-[var(--primary)]/10 transition-colors"
                        />
                        {query && (
                            <button
                                onClick={handleClear}
                                className="absolute right-10 top-1/2 -translate-y-1/2 p-1 bg-slate-200 rounded-full"
                            >
                                <X size={14} className="text-slate-600" />
                            </button>
                        )}
                        <button
                            onClick={handleVoiceSearch}
                            className={cn(
                                "absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all",
                                isListening ? "bg-[var(--primary)] text-white scale-110 animate-pulse" : "text-slate-400 hover:bg-slate-100"
                            )}
                        >
                            <Mic size={20} className={isListening ? "text-white" : "text-slate-400"} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="mx-auto w-full max-w-7xl p-4 md:p-5 space-y-8 pb-28">
                {/* Search Results List */}
                {trimmedQuery ? (
                    <section>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-200 tracking-tight transition-colors">
                                Search Results
                            </h2>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{results.length} found</span>
                        </div>

                        {results.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5">
                                {results.map((product) => (
                                    <div key={product.id} onClick={() => saveSearch(trimmedQuery)}>
                                        <ProductCard product={product} compact={isMobile} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-16 flex flex-col items-center text-center">
                                <div className="h-20 w-20 bg-slate-50 dark:bg-card rounded-full flex items-center justify-center mb-4">
                                    <Search size={32} className="text-slate-300 dark:text-slate-600" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">No products found</h3>
                                <p className="text-slate-400 text-sm">Try different keywords or check spelling.</p>
                            </div>
                        )}
                    </section>
                ) : (
                    <>
                        {/* 1. Recently Searched Item Section */}
                        {pastSearches.length > 0 && (
                            <section>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Recently Searched</h3>
                                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                    {pastSearches.map((term) => (
                                        <div
                                            key={term}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-card dark:bg-background border border-border shadow-sm rounded-full whitespace-nowrap active:scale-95 transition-transform cursor-pointer"
                                            onClick={() => setQuery(term)}
                                        >
                                            <div className="h-5 w-5 rounded flex items-center justify-center" style={{ backgroundColor: (settings?.primaryColor || 'var(--primary)') + '20' }}>
                                                <History size={12} style={{ color: settings?.primaryColor || 'var(--primary)' }} />
                                            </div>
                                            <span className="text-sm font-bold text-foreground">{term}</span>
                                            <button
                                                onClick={(e) => handleRemoveSearch(e, term)}
                                                className="ml-1 p-0.5 hover:bg-slate-100 rounded-full transition-colors"
                                            >
                                                <X size={12} className="text-slate-400 hover:text-red-500" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* 2. Lowest Price Ever Section */}
                        <section>
                            <div className="flex justify-between items-center mb-5">
                                <h2 className="text-xl font-black text-foreground tracking-tight">Lowest Price Ever!</h2>
                                <button className="flex items-center gap-1 text-sm font-bold" style={{ color: settings?.primaryColor || 'var(--primary)' }}>
                                    See All <ChevronRight size={16} />
                                </button>
                            </div>
                            <div className="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar -mx-5 px-5 pb-4 snap-x">
                                {isInitialLoading && lowestPriceProducts.length === 0 ? (
                                    [...Array(4)].map((_, i) => (
                                        <div key={i} className="min-w-[130px] md:min-w-[170px] h-52 md:h-64 bg-slate-50 rounded-2xl animate-pulse" />
                                    ))
                                ) : lowestPriceProducts.map((product) => (
                                    <div key={product.id} className="min-w-[130px] md:min-w-[180px] snap-start">
                                        <ProductCard product={product} compact={isMobile} />
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>

            <MiniCart />
        </div>
    );
};

export default SearchPage;
