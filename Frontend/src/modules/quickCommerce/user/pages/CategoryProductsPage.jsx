
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import ProductCard from '../components/shared/ProductCard';
import ProductDetailSheet from '../components/shared/ProductDetailSheet';
import { useProductDetail } from '../context/ProductDetailContext';
import { customerApi } from '../services/customerApi';
import MiniCart from '../components/shared/MiniCart';
import SectionRenderer from "../components/experience/SectionRenderer";
import { useLocation as useAppLocation } from '../context/LocationContext';
import ZoneServiceUnavailable from '../components/shared/ZoneServiceUnavailable';
import { getQuickCategoryPath, getQuickCategoriesPath } from '../utils/routes';

const FALLBACK_HEADER_COLOR = "#FF0000";
const ALL_ICON = "https://cdn-icons-png.flaticon.com/128/2321/2321831.png";
const FALLBACK_SUB_ICON = "https://cdn-icons-png.flaticon.com/128/2321/2321801.png";

const getNodeId = (node) => String(node?._id || node?.id || "").trim();

const getParentId = (node) => {
    if (!node?.parentId) return null;
    if (typeof node.parentId === "object") {
        return String(node.parentId._id || node.parentId.id || "").trim() || null;
    }
    return String(node.parentId).trim() || null;
};

/** Resolve header + L2 scope for any category tree node. */
const resolveCategoryScope = (currentCat, fullMap = {}) => {
    if (!currentCat) {
        return {
            header: null,
            level2: null,
            level3: null,
            sidebarNodes: [],
            productCategoryId: null,
            activeSidebarId: null,
        };
    }

    const type = String(currentCat.type || "").toLowerCase();
    let header = null;
    let level2 = null;
    let level3 = null;

    if (type === "header") {
        header = currentCat;
    } else if (type === "category") {
        level2 = currentCat;
        header = fullMap[getParentId(currentCat)] || null;
    } else if (type === "subcategory") {
        level3 = currentCat;
        level2 = fullMap[getParentId(currentCat)] || null;
        header = level2 ? fullMap[getParentId(level2)] || null : null;
    } else {
        // Unknown type — treat like category/L2 if it has a parent, else header.
        const parent = fullMap[getParentId(currentCat)];
        if (!parent) {
            header = currentCat;
        } else if (String(parent.type || "").toLowerCase() === "header") {
            level2 = currentCat;
            header = parent;
        } else {
            level3 = currentCat;
            level2 = parent;
            header = fullMap[getParentId(parent)] || null;
        }
    }

    const sidebarNodes = Array.isArray(header?.children) ? header.children : [];
    const productCategoryId = getNodeId(currentCat);
    const activeSidebarId = level2
        ? getNodeId(level2)
        : header
            ? "all"
            : productCategoryId;

    return {
        header,
        level2,
        level3,
        sidebarNodes,
        productCategoryId,
        activeSidebarId,
    };
};

const SubCategoryButton = React.memo(function SubCategoryButton({
    cat,
    isSelected,
    onSelect,
}) {
    return (
        <button
            type="button"
            onClick={() => onSelect(cat.id)}
            className={cn(
                "flex flex-col items-center py-4 px-1 gap-2 transition-all relative border-l-4",
                isSelected
                    ? "bg-[#F7FCF5] dark:bg-emerald-950/20 border-[#0c831f]"
                    : "border-transparent hover:bg-gray-50 dark:hover:bg-white/5",
            )}
        >
            <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center p-2 transition-all duration-300",
                isSelected ? "scale-110" : "grayscale opacity-70",
            )}>
                <img src={cat.icon} alt={cat.name} loading="lazy" className="w-full h-full object-contain" />
            </div>
            <span className={cn(
                "text-[10px] text-center font-bold font-sans leading-tight px-1",
                isSelected ? "text-[#0c831f]" : "text-gray-500",
            )}>
                {cat.name}
            </span>
        </button>
    );
});

const CategoryProductsPage = () => {
    const { categoryId: catId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { currentLocation } = useAppLocation();
    const { isOpen: isProductDetailOpen } = useProductDetail();

    const [category, setCategory] = useState(null);
    const [scope, setScope] = useState({
        header: null,
        level2: null,
        level3: null,
        sidebarNodes: [],
        productCategoryId: null,
        activeSidebarId: null,
    });
    const [subFilterId, setSubFilterId] = useState(
        location.state?.activeSubcategoryId || "all",
    );
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [headerTheme] = useState(FALLBACK_HEADER_COLOR);
    const [experienceSections, setExperienceSections] = useState([]);
    const [categoryMap, setCategoryMap] = useState({});
    const [subcategoryMap, setSubcategoryMap] = useState({});
    const [categoryFullMap, setCategoryFullMap] = useState({});
    const [serviceAvailable, setServiceAvailable] = useState(true);
    const [serviceMessage, setServiceMessage] = useState("");

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const hasValidLocation =
                Number.isFinite(currentLocation?.latitude) &&
                Number.isFinite(currentLocation?.longitude);

            const locationParams = hasValidLocation
                ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
                : {};

            const catRes = await customerApi.getCategories({ tree: true });
            const results = catRes?.data?.results || catRes?.data?.result || [];
            const allCats = Array.isArray(results) ? results : [];
            const cMap = {};
            const sMap = {};
            const fullMap = {};
            const bySlug = {};

            const flatten = (items) => {
                (items || []).forEach((item) => {
                    const id = getNodeId(item);
                    if (id) fullMap[id] = item;
                    const slug = String(item.slug || "").toLowerCase().trim();
                    if (slug) bySlug[slug] = item;
                    const nameSlug = String(item.name || "")
                        .toLowerCase()
                        .trim()
                        .replace(/\s+/g, "-");
                    if (nameSlug && !bySlug[nameSlug]) bySlug[nameSlug] = item;
                    if (item.type === "category") cMap[id] = item;
                    else if (item.type === "subcategory") sMap[id] = item;
                    if (item.children?.length > 0) flatten(item.children);
                });
            };
            flatten(allCats);
            setCategoryMap(cMap);
            setSubcategoryMap(sMap);
            setCategoryFullMap(fullMap);

            const lookupKey = String(catId || "").trim();
            const currentCat =
                fullMap[lookupKey] ||
                bySlug[lookupKey.toLowerCase()] ||
                null;
            const nextScope = resolveCategoryScope(currentCat, fullMap);
            const resolvedCategoryId = String(
                nextScope.productCategoryId || lookupKey,
            );

            setCategory(currentCat);
            setScope(nextScope);

            // Reset L3 chip filter on route change (unless deep-linked)
            const linkedSub = location.state?.activeSubcategoryId;
            if (linkedSub) {
                setSubFilterId(linkedSub);
            } else if (nextScope.level3) {
                setSubFilterId(getNodeId(nextScope.level3));
            } else {
                setSubFilterId("all");
            }

            const experienceHeaderId = getNodeId(nextScope.header) || resolvedCategoryId;

            const [prodRes, expRes] = await Promise.all([
                hasValidLocation
                    ? customerApi.getProducts({
                        categoryId: resolvedCategoryId,
                        ...locationParams,
                    })
                    : Promise.resolve({
                        data: {
                            success: true,
                            result: {
                                items: [],
                                serviceAvailable: false,
                                message: "Select your delivery location to see available products",
                            },
                        },
                    }),
                customerApi.getExperienceSections({
                    pageType: "header",
                    headerId: experienceHeaderId,
                    ...locationParams,
                }).catch(() => null),
            ]);

            if (prodRes.data.success) {
                const rawResult = prodRes.data.result;
                if (rawResult?.serviceAvailable === false || !hasValidLocation) {
                    setServiceAvailable(false);
                    setServiceMessage(
                        String(
                            rawResult?.message || "Services not available in your area",
                        ).trim(),
                    );
                } else {
                    setServiceAvailable(true);
                    setServiceMessage("");
                }
                const dbProds = Array.isArray(prodRes.data.results)
                    ? prodRes.data.results
                    : Array.isArray(rawResult?.items)
                        ? rawResult.items
                        : Array.isArray(rawResult)
                            ? rawResult
                            : [];
                setProducts(
                    dbProds.map((p) => ({
                        ...p,
                        id: p._id,
                        image:
                            p.mainImage ||
                            p.image ||
                            "https://images.unsplash.com/photo-1550989460-0adf9ea622e2",
                        price: p.salePrice || p.price,
                        originalPrice: p.price,
                        weight: p.weight || "1 unit",
                        deliveryTime: "8-15 mins",
                    })),
                );
            }

            if (expRes?.data?.success) {
                setExperienceSections(expRes.data.result || expRes.data.results || []);
            } else {
                setExperienceSections([]);
            }
        } catch (error) {
            console.error("Error fetching category data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [
        catId,
        currentLocation?.latitude,
        currentLocation?.longitude,
        location.state?.activeSubcategoryId,
    ]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const sidebarItems = useMemo(() => {
        const siblings = (scope.sidebarNodes || []).map((s) => ({
            id: getNodeId(s),
            name: s.name,
            icon: s.image || FALLBACK_SUB_ICON,
        }));
        const headerId = getNodeId(scope.header);
        if (!headerId) return siblings;
        return [
            {
                id: "all",
                name: "All",
                icon: ALL_ICON,
            },
            ...siblings,
        ];
    }, [scope.sidebarNodes, scope.header]);

    const level3Filters = useMemo(() => {
        const children = Array.isArray(scope.level2?.children)
            ? scope.level2.children
            : [];
        if (!children.length) return [];
        return [
            { id: "all", name: "All" },
            ...children.map((s) => ({
                id: getNodeId(s),
                name: s.name,
            })),
        ];
    }, [scope.level2]);

    const safeProducts = Array.isArray(products) ? products : [];

    const filteredProducts = useMemo(() => {
        if (subFilterId === "all") return safeProducts;
        return safeProducts.filter(
            (p) =>
                p.subcategoryId?._id === subFilterId ||
                p.subcategoryId === subFilterId ||
                String(p.subcategoryId) === String(subFilterId),
        );
    }, [safeProducts, subFilterId]);

    const productsById = useMemo(() => {
        const map = {};
        safeProducts.forEach((p) => {
            map[p._id || p.id] = p;
        });
        return map;
    }, [safeProducts]);

    const mainExperienceSections = useMemo(
        () =>
            experienceSections.filter(
                (s) => (s.title || "").trim().toLowerCase() !== "best sellers",
            ),
        [experienceSections],
    );

    const handleSidebarSelect = useCallback(
        (id) => {
            if (id === "all") {
                const headerId = getNodeId(scope.header);
                if (headerId) {
                    navigate(getQuickCategoryPath(headerId), { replace: false });
                }
                return;
            }
            if (String(id) === String(scope.activeSidebarId) && !scope.level3) {
                return;
            }
            navigate(getQuickCategoryPath(id), { replace: false });
        },
        [navigate, scope.header, scope.activeSidebarId, scope.level3],
    );

    const titleName =
        category?.name ||
        scope.level2?.name ||
        scope.header?.name ||
        catId;

    return (
        <div className="flex min-h-screen flex-col bg-white dark:bg-background font-sans pt-0 transition-colors duration-500">
            <div className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col">
                <header
                    className={cn(
                        "sticky top-0 z-30 px-4 py-4 flex items-center justify-between border-b border-white/20 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-md",
                        isProductDetailOpen && "hidden md:flex",
                    )}
                    style={{
                        backgroundImage: `linear-gradient(180deg, ${headerTheme} 0%, ${headerTheme}F2 100%)`,
                    }}
                >
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate(getQuickCategoriesPath())}
                            className="p-1 hover:bg-white/15 rounded-full transition-colors"
                            aria-label="Back to categories"
                        >
                            <ChevronLeft size={24} className="text-white" />
                        </button>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/75">
                                Quick Category
                            </span>
                            <h1 className="text-[18px] font-bold text-white tracking-tight">
                                {titleName}
                            </h1>
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 relative items-start">
                    <aside className="w-20 md:w-28 border-r border-gray-50 dark:border-white/5 flex flex-col bg-white dark:bg-card overflow-y-auto hide-scrollbar sticky top-0 h-screen pb-32 transition-colors">
                        {sidebarItems.map((cat) => (
                            <SubCategoryButton
                                key={cat.id}
                                cat={cat}
                                isSelected={
                                    String(scope.activeSidebarId || "") === String(cat.id)
                                }
                                onSelect={handleSidebarSelect}
                            />
                        ))}
                    </aside>

                    <main className="flex-1 px-3 pt-1 pb-24 bg-white dark:bg-background transition-colors">
                        {!serviceAvailable ? (
                            <ZoneServiceUnavailable
                                message={
                                    serviceMessage || "Services not available in your area"
                                }
                                className="min-h-[40vh]"
                            />
                        ) : (
                            <>
                                {level3Filters.length > 0 && (
                                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-3 mb-1">
                                        {level3Filters.map((chip) => {
                                            const active =
                                                String(subFilterId) === String(chip.id);
                                            return (
                                                <button
                                                    key={chip.id}
                                                    type="button"
                                                    onClick={() => setSubFilterId(chip.id)}
                                                    className={cn(
                                                        "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors",
                                                        active
                                                            ? "bg-[#0c831f] text-white"
                                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                                                    )}
                                                >
                                                    {chip.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {subFilterId === "all" &&
                                    mainExperienceSections.length > 0 && (
                                        <div className="mb-4">
                                            <SectionRenderer
                                                sections={mainExperienceSections}
                                                productsById={productsById}
                                                categoriesById={categoryMap}
                                                subcategoriesById={subcategoryMap}
                                            />
                                        </div>
                                    )}

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2 gap-y-4 md:gap-4 lg:gap-6">
                                    {filteredProducts.map((product) => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            compact
                                        />
                                    ))}
                                    {filteredProducts.length === 0 && !isLoading && (
                                        <div className="col-span-full py-10 md:py-20 text-center flex justify-center w-full">
                                            <p className="text-slate-400 font-black italic md:text-xl w-full">
                                                No products found in this category
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </main>
                </div>

                <MiniCart />
                <ProductDetailSheet />
            </div>
            <style
                dangerouslySetInnerHTML={{
                    __html: `.hide-scrollbar::-webkit-scrollbar{display:none}.hide-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`,
                }}
            />
        </div>
    );
};

export default CategoryProductsPage;
