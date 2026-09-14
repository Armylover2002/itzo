import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { Search, ArrowLeft, X, ChevronRight, History, Mic } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import ProductCard from '../components/shared/ProductCard';
import { useProductDetail } from '../context/ProductDetailContext';
import { useSettings } from '@core/context/SettingsContext';
import { cn } from '@/lib/utils';
import { useLocation as useAppLocation } from '../context/LocationContext';
import MiniCart from '../components/shared/MiniCart';
import ZoneServiceUnavailable from '../components/shared/ZoneServiceUnavailable';

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'appzeto_recent_searches';
const DEBOUNCE_MS = 250;
const MAX_HISTORY = 10;
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1550989460-0adf9ea622e2';

// Defined outside — never recreated
const mapProducts = (products = []) =>
    products.map((p) => ({
        ...p,
        id: p._id,
        image: p.mainImage || p.image || FALLBACK_IMAGE,
        price: p.salePrice || p.price,
        originalPrice: p.price,
        weight: p.weight || '1 unit',
        deliveryTime: '8-15 mins',
    }));

const readHistory = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
};

const writeHistory = (list) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* noop */ }
};

// ─── Custom hook: debounced value ─────────────────────────────────────────────
function useDebounced(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

// ─── Custom hook: stable isMobile ────────────────────────────────────────────
function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
        const handler = (e) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [breakpoint]);
    return isMobile;
}

// ─── SearchPage ───────────────────────────────────────────────────────────────
const SearchPage = () => {
    const navigate = useNavigate();
    const location = useRouterLocation();
    const { isOpen: isProductDetailOpen } = useProductDetail();
    const { settings } = useSettings();
    const { currentLocation } = useAppLocation();
    const isMobile = useIsMobile();

    // URL-derived initial query (computed once)
    const initialQuery = useMemo(
        () => location.state?.query || new URLSearchParams(location.search).get('q') || '',
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const [query, setQuery] = useState(initialQuery);
    const [allProducts, setAllProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [pastSearches, setPastSearches] = useState(readHistory);
    const [serviceAvailable, setServiceAvailable] = useState(true);
    const [serviceMessage, setServiceMessage] = useState('');

    // Debounced trimmed query — avoids fetching on every keystroke
    const debouncedQuery = useDebounced(query.trim(), DEBOUNCE_MS);

    // ── Location validity flag (memoized) ─────────────────────────────────────
    const hasValidLocation = useMemo(
        () =>
            Number.isFinite(currentLocation?.latitude) &&
            Number.isFinite(currentLocation?.longitude),
        [currentLocation?.latitude, currentLocation?.longitude],
    );

    // ── Stable history helpers ─────────────────────────────────────────────────
    const saveSearch = useCallback((term) => {
        const t = term.trim();
        if (!t) return;
        setPastSearches((prev) => {
            const updated = [t, ...prev.filter((s) => s !== t)].slice(0, MAX_HISTORY);
            writeHistory(updated);
            return updated;
        });
    }, []);

    const handleRemoveSearch = useCallback((e, term) => {
        e.stopPropagation();
        setPastSearches((prev) => {
            const updated = prev.filter((s) => s !== term);
            writeHistory(updated);
            return updated;
        });
    }, []);

    const handleKeyDown = useCallback(
        (e) => { if (e.key === 'Enter' && query.trim()) saveSearch(query.trim()); },
        [query, saveSearch],
    );

    const handleClear = useCallback(() => setQuery(''), []);

    // ── Voice search ───────────────────────────────────────────────────────────
    const recognitionRef = useRef(null);
    const handleVoiceSearch = useCallback(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) { alert('Voice search is not supported in this browser.'); return; }

        if (recognitionRef.current) { recognitionRef.current.abort(); }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'en-IN';
        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) { setQuery(transcript); saveSearch(transcript); }
        };
        recognition.start();
    }, [saveSearch]);

    // ── Fetch all products (when no query, location-based) ────────────────────
    useEffect(() => {
        if (!hasValidLocation || debouncedQuery) return;

        let cancelled = false;
        setIsLoading(true);

        customerApi.getProducts({
            limit: 100,
            lat: currentLocation.latitude,
            lng: currentLocation.longitude,
        }).then((response) => {
            if (cancelled || !response.data.success) return;
            const raw = response.data.result;
            if (raw?.serviceAvailable === false) {
                setServiceAvailable(false);
                setServiceMessage(String(raw.message || '').trim());
            } else {
                setServiceAvailable(true);
                setServiceMessage('');
            }
            const list = Array.isArray(response.data.results) ? response.data.results
                : Array.isArray(raw?.items) ? raw.items
                    : Array.isArray(raw) ? raw
                        : [];
            setAllProducts(mapProducts(list));
        }).catch((err) => {
            if (!cancelled) console.error('Error fetching products:', err);
        }).finally(() => {
            if (!cancelled) setIsLoading(false);
        });

        return () => { cancelled = true; };
    }, [hasValidLocation, debouncedQuery, currentLocation?.latitude, currentLocation?.longitude]);

    // ── Fetch search results (debounced query) ────────────────────────────────
    useEffect(() => {
        if (!debouncedQuery || !hasValidLocation) return;

        let cancelled = false;
        setIsLoading(true);

        customerApi.searchProducts({
            search: debouncedQuery,
            limit: 100,
            lat: currentLocation.latitude,
            lng: currentLocation.longitude,
        }).then((response) => {
            if (cancelled || !response?.data?.success) return;
            const raw = response.data.result;
            if (raw?.serviceAvailable === false) {
                setServiceAvailable(false);
                setServiceMessage(String(raw.message || '').trim());
            } else {
                setServiceAvailable(true);
                setServiceMessage('');
            }
            const list = Array.isArray(response.data.results) ? response.data.results
                : Array.isArray(raw?.items) ? raw.items
                    : Array.isArray(raw) ? raw
                        : [];
            setAllProducts(mapProducts(list));
        }).catch((err) => {
            if (!cancelled) { console.error('Error fetching quick search results:', err); setAllProducts([]); }
        }).finally(() => {
            if (!cancelled) setIsLoading(false);
        });

        return () => { cancelled = true; };
    }, [debouncedQuery, hasValidLocation, currentLocation?.latitude, currentLocation?.longitude]);

    // ── Derived lists (memoized) ──────────────────────────────────────────────
    const results = useMemo(() => {
        if (!debouncedQuery) return [];
        const q = debouncedQuery.toLowerCase();
        return allProducts.filter(
            (p) =>
                p.name?.toLowerCase().includes(q) ||
                p.categoryId?.name?.toLowerCase().includes(q),
        );
    }, [debouncedQuery, allProducts]);

    const lowestPriceProducts = useMemo(
        () => [...allProducts].sort((a, b) => a.price - b.price).slice(0, 10),
        [allProducts],
    );

    // ── Primary color (stable reference) ──────────────────────────────────────
    const primaryColor = settings?.primaryColor || 'var(--primary)';

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#F5F7F8] dark:bg-background font-outfit transition-colors duration-500">
            {/* Search Input */}
            <div className={cn(
                'sticky top-0 z-50 bg-[#F5F7F8] dark:bg-background shadow-sm border-b dark:border-white/5',
                isProductDetailOpen && 'hidden md:block',
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
                                'absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all',
                                isListening
                                    ? 'bg-[var(--primary)] text-white scale-110 animate-pulse'
                                    : 'text-slate-400 hover:bg-slate-100',
                            )}
                        >
                            <Mic size={20} className={isListening ? 'text-white' : 'text-slate-400'} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="mx-auto w-full max-w-7xl p-4 md:p-5 space-y-8 pb-28">
                {!hasValidLocation || !serviceAvailable ? (
                    <ZoneServiceUnavailable
                        message={
                            !hasValidLocation
                                ? 'Select your delivery location to see available products'
                                : (serviceMessage || 'Services not available in your area')
                        }
                        className="min-h-[40vh]"
                    />
                ) : debouncedQuery ? (
                    /* ── Search Results ── */
                    <section>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-200 tracking-tight transition-colors">
                                Search Results
                            </h2>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                {results.length} found
                            </span>
                        </div>

                        {results.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5">
                                {results.map((product) => (
                                    <div
                                        key={product.id}
                                        onClick={() => saveSearch(debouncedQuery)}
                                    >
                                        <ProductCard product={product} compact={isMobile} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-16 flex flex-col items-center text-center">
                                <div className="h-20 w-20 bg-slate-50 dark:bg-card rounded-full flex items-center justify-center mb-4">
                                    <Search size={32} className="text-slate-300 dark:text-slate-600" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">
                                    No products found
                                </h3>
                                <p className="text-slate-400 text-sm">Try different keywords or check spelling.</p>
                            </div>
                        )}
                    </section>
                ) : (
                    <>
                        {/* ── Recent Searches ── */}
                        {pastSearches.length > 0 && (
                            <section>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                                    Recently Searched
                                </h3>
                                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                                    {pastSearches.map((term) => (
                                        <div
                                            key={term}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-card dark:bg-background border border-border shadow-sm rounded-full whitespace-nowrap active:scale-95 transition-transform cursor-pointer"
                                            onClick={() => setQuery(term)}
                                        >
                                            <div
                                                className="h-5 w-5 rounded flex items-center justify-center"
                                                style={{ backgroundColor: `${primaryColor}20` }}
                                            >
                                                <History size={12} style={{ color: primaryColor }} />
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

                        {/* ── Lowest Price Ever ── */}
                        <section>
                            <div className="flex justify-between items-center mb-5">
                                <h2 className="text-xl font-black text-foreground tracking-tight">
                                    Lowest Price Ever!
                                </h2>
                                <button
                                    className="flex items-center gap-1 text-sm font-bold"
                                    style={{ color: primaryColor }}
                                >
                                    See All <ChevronRight size={16} />
                                </button>
                            </div>
                            <div className="flex gap-3 md:gap-4 overflow-x-auto no-scrollbar -mx-5 px-5 pb-4 snap-x">
                                {isLoading && allProducts.length === 0
                                    ? [...Array(4)].map((_, i) => (
                                        <div
                                            key={i}
                                            className="min-w-[130px] md:min-w-[170px] h-52 md:h-64 bg-slate-50 rounded-2xl animate-pulse"
                                        />
                                    ))
                                    : lowestPriceProducts.map((product) => (
                                        <div
                                            key={product.id}
                                            className="min-w-[130px] md:min-w-[180px] snap-start"
                                        >
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