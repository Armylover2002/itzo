import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Search } from 'lucide-react';
import LocationDrawer from '../components/shared/LocationDrawer';
import { useLocation } from '../context/LocationContext';
import { customerApi } from '../services/customerApi';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveQuickImageUrl } from '../utils/image';

const COLORS = [
    "#FDF2F2", "#F2F9F2", "#F2F2FD", "#FDFDF2",
    "#F2FDFD", "#FDF2FD", "#FFF8F0", "#F0FFF8",
];

const FALLBACK_ICON = "https://cdn-icons-png.flaticon.com/128/2321/2321831.png";

const getCategoryImageSrc = (cat = {}) => {
    const candidate =
        cat.image ||
        cat.icon ||
        cat.thumbnail ||
        cat.imageUrl ||
        cat.iconUrl ||
        cat.media?.image ||
        cat.media?.url ||
        "";
    return resolveQuickImageUrl(candidate) || FALLBACK_ICON;
};

const CategoryCard = React.memo(function CategoryCard({ category }) {
    const [broken, setBroken] = useState(false);
    const src = broken ? FALLBACK_ICON : category.image;

    return (
        <div className="flex flex-col items-center gap-1.5 w-full group">
            <div
                className="relative w-full aspect-square rounded-full p-2 shadow-[0_6px_16px_-8px_rgba(0,0,0,0.1)] border border-border flex items-center justify-center overflow-hidden transition-transform duration-300 group-hover:scale-[1.04]"
                style={{ backgroundColor: category.color || "#F8FAFC" }}
            >
                <img
                    src={src}
                    alt={category.name}
                    loading="lazy"
                    onError={() => setBroken(true)}
                    className="w-[78%] h-[78%] object-contain"
                />
            </div>
            <span className="text-[11px] md:text-[12px] font-normal text-slate-700 text-center leading-snug line-clamp-2 px-0.5 tracking-normal">
                {category.name}
            </span>
        </div>
    );
});

const CategoriesHeader = () => {
    const { currentLocation, isFetchingLocation } = useLocation();
    const [isLocationDrawerOpen, setIsLocationDrawerOpen] = useState(false);
    const navigate = useNavigate();

    const handleLocationClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsLocationDrawerOpen(true);
    };

    const handleSearchClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigate('/quick/search');
    };

    return (
        <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm px-4 pt-4 pb-4">
            <div className="max-w-[1400px] mx-auto">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col cursor-pointer" onClick={handleLocationClick}>
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] font-normal text-gray-500 uppercase tracking-wide">Delivery in</span>
                            <span className="bg-[#FF0000] text-white text-[9px] font-medium px-1.5 py-0.5 rounded uppercase">App</span>
                        </div>
                        <div className="flex items-center gap-1 group">
                            <span className="text-[20px] md:text-[24px] font-medium text-slate-900 leading-none tracking-tight">
                                {currentLocation?.time || "12-15 mins"}
                            </span>
                            <ChevronDown className="w-5 h-5 text-gray-500 group-hover:text-gray-800 transition-colors" />
                        </div>
                        <span className="text-[11px] font-normal text-gray-500 truncate max-w-[200px] mt-1">
                            {isFetchingLocation ? "Detecting location..." : (currentLocation?.name || "Select Location")}
                        </span>
                    </div>
                </div>
                
                <div className="relative cursor-pointer" onClick={handleSearchClick}>
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <Search className="h-[18px] w-[18px] text-[#FF0000]" />
                    </div>
                    <input 
                        type="text"
                        placeholder="Search for bread, milk, eggs..."
                        className="w-full bg-gray-50/80 border border-gray-200 text-gray-900 rounded-[12px] py-3.5 pl-11 pr-4 focus:outline-none focus:ring-1 focus:ring-[#FF0000]/30 text-[13px] font-normal placeholder:font-normal placeholder:text-gray-400 cursor-pointer shadow-inner"
                        readOnly
                        onClick={handleSearchClick}
                    />
                </div>
            </div>
            <LocationDrawer open={isLocationDrawerOpen} onClose={() => setIsLocationDrawerOpen(false)} />
        </div>
    );
};

const CategoriesPage = () => {
    const [groups, setGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchCategories = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await customerApi.getCategories({ tree: true });
            if (res.data.success) {
                const results = res.data.results || res.data.result || [];
                const allCategories = Array.isArray(results) ? results : [];
                const headers = allCategories.filter(
                    (cat) => !cat.parentId || (cat.children && cat.children.length > 0),
                );
                const formattedGroups = headers
                    .filter((header) => (header.name || '').trim().toLowerCase() !== 'all')
                    .map((header, idx) => {
                        let subs = header.children && header.children.length > 0
                            ? header.children
                            : allCategories.filter((cat) => cat.parentId === header._id);
                        if (subs.length === 0) return null;
                        return {
                            id: header._id || idx,
                            title: header.name,
                            categories: subs.map((cat, cIdx) => ({
                                id: cat._id || `${idx}-${cIdx}`,
                                name: cat.name,
                                image: getCategoryImageSrc(cat),
                                color: COLORS[(idx + cIdx) % COLORS.length],
                            })),
                        };
                    })
                    .filter(Boolean);

                setGroups(formattedGroups);
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    return (
        <div className="min-h-screen bg-white transition-colors duration-500">
            <CategoriesHeader />
            <div className="max-w-[1400px] mx-auto px-4 pt-[180px] md:pt-[200px] pb-20">
                <AnimatePresence mode="wait">
                    {isLoading ? (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex items-center justify-center h-64"
                        >
                            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        </motion.div>
                    ) : (
                        <div className="space-y-6 md:space-y-8">
                            {groups.map((group, groupIdx) => (
                                <motion.section
                                    key={group.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: groupIdx * 0.1 }}
                                    className="space-y-4 md:space-y-5"
                                >
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-[14px] md:text-[15px] font-medium text-slate-800 tracking-normal normal-case">
                                            {group.title}
                                        </h2>
                                        <div className="h-[1px] flex-1 bg-gray-100" />
                                    </div>
                                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-x-2 gap-y-5 md:gap-4">
                                        {group.categories.map((category) => (
                                            <Link key={category.id} to={`/quick/categories/${category.id}`} className="block">
                                                <CategoryCard category={category} />
                                            </Link>
                                        ))}
                                    </div>
                                </motion.section>
                            ))}
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default CategoriesPage;
