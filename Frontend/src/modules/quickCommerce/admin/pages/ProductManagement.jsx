import React, { useState, useMemo, useEffect, useRef } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import { adminApi } from '../services/adminApi';
import { toast } from 'sonner';
import {
    HiOutlineCube,
    HiOutlineMagnifyingGlass,
    HiOutlineFunnel,
    HiOutlineTrash,
    HiOutlineEye,
    HiOutlinePencilSquare,
    HiOutlinePhoto,
    HiOutlineArchiveBox,
    HiOutlineTag,
    HiOutlineArrowPath,
    HiOutlineXMark,
    HiOutlineChevronRight,
    HiOutlineCheckCircle,
    HiOutlineExclamationCircle,
    HiOutlineFolderOpen,
    HiOutlineSwatch,
    HiOutlineCurrencyDollar,
} from 'react-icons/hi2';
import Modal from '@shared/components/ui/Modal';
import Pagination from '@shared/components/ui/Pagination';
import { PAGINATION_CONFIG } from '@/shared/constants/pagination';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { convertToWebP } from '@/shared/utils/imageUploadUtils';
import ProductImage from '@shared/components/ProductImage';
import { handleProductImageError } from '@/shared/utils/productImage';
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions";
import VariantImageSlots from "@/shared/components/products/VariantImageSlots";
import {
    MAX_PRODUCT_VARIANTS,
    MAX_VARIANT_IMAGES,
    MIN_VARIANT_IMAGES,
    countVariantMedia,
    appendVariantImageFiles,
    serializeVariantsForApi,
    buildVariantMediaFromImages,
} from "@/shared/utils/variantMedia";


const isCategorySelectable = (node = {}) =>
  node?.status !== 'inactive' && node?.isActive !== false;

const filterActiveCategoryTree = (nodes = []) =>
  (Array.isArray(nodes) ? nodes : [])
    .filter(isCategorySelectable)
    .map((node) => ({
      ...node,
      children: filterActiveCategoryTree(node.children),
    }));

/** Match seller form: category refs may be populated objects or raw ids. */
const toCategoryId = (value) => {
  if (value == null || value === '') return '';
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value);
};

const categoryNodeId = (node = {}) => toCategoryId(node._id || node.id);

/**
 * Keep the product's current header/category/sub visible in the dropdowns even when
 * that branch was deactivated (otherwise selects look empty while form state has ids).
 */
const mergeCurrentCategoriesIntoTree = (tree = [], product = null) => {
  if (!product) return tree;
  const next = Array.isArray(tree) ? tree.map((n) => ({ ...n, children: [...(n.children || [])] })) : [];

  const ensureChild = (parentList, node) => {
    if (!node?.id && !node?._id) return;
    const id = categoryNodeId(node);
    if (!id) return;
    const existing = parentList.find((item) => categoryNodeId(item) === id);
    if (existing) return existing;
    const created = {
      ...node,
      _id: node._id || node.id || id,
      id: node.id || node._id || id,
      name: node.name || 'Current selection',
      status: node.status || 'inactive',
      children: [],
    };
    parentList.push(created);
    return created;
  };

  const header = product.headerId && typeof product.headerId === 'object' ? product.headerId : null;
  const category = product.categoryId && typeof product.categoryId === 'object' ? product.categoryId : null;
  const subcategory =
    product.subcategoryId && typeof product.subcategoryId === 'object' ? product.subcategoryId : null;

  const headerNode = ensureChild(next, header);
  if (headerNode && category) {
    headerNode.children = [...(headerNode.children || [])];
    const categoryNode = ensureChild(headerNode.children, category);
    if (categoryNode && subcategory) {
      categoryNode.children = [...(categoryNode.children || [])];
      ensureChild(categoryNode.children, subcategory);
    }
  }

  return next;
};

const ProductManagement = () => {
    const { user: authUser } = useAuth();
    const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser]);
    const [resolvedPermissions, setResolvedPermissions] = useState({});

    useEffect(() => {
        let isMounted = true;

        const resolvePermissions = async () => {
            if (!currentUser || currentUser.role === "ADMIN") {
                if (isMounted) setResolvedPermissions({});
                return;
            }

            const existingPermissions = extractAdminPermissions(currentUser);
            if (Object.keys(existingPermissions).length > 0) {
                if (isMounted) setResolvedPermissions(existingPermissions);
                return;
            }

            const roleId = extractAdminRoleId(currentUser);
            if (!roleId) {
                if (isMounted) setResolvedPermissions({});
                return;
            }

            try {
                const rolePermissions = await fetchAdminRolePermissions(roleId);
                if (isMounted) setResolvedPermissions(rolePermissions);
            } catch {
                if (isMounted) setResolvedPermissions({});
            }
        };

        resolvePermissions();
        return () => {
            isMounted = false;
        };
    }, [currentUser]);

    const permissionKey = "quick::core_management::products";
    const canEdit = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "edit");

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]); // All categories for dropdowns
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGINATION_CONFIG.defaultPageSize);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all'); // Added filterStatus
    const [filterBusinessType, setFilterBusinessType] = useState('all'); // Added filterBusinessType
    const [filterSeller, setFilterSeller] = useState('all');
    const [sellerOptions, setSellerOptions] = useState([]);

    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isViewMode, setIsViewMode] = useState(false);
    const [modalTab, setModalTab] = useState('general');

    const modalTabs = useMemo(() => [
        { id: 'general', label: 'General Info', icon: HiOutlineTag },
        { id: 'variants', label: 'Item Variants', icon: HiOutlineSwatch },
        { id: 'category', label: 'Groups', icon: HiOutlineFolderOpen },
    ], []);

    useEffect(() => {
        if (modalTab === 'pricing') {
            setModalTab('variants');
        }
    }, [modalTab]);

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        sku: '',
        description: '',
        price: '',
        salePrice: '',
        packingFee: '',
        stock: '',
        lowStockAlert: 5,
        unit: 'packet',
        header: '',
        categoryId: '',
        subcategoryId: '',
        status: 'active',
        approvalStatus: 'approved',
        isFeatured: false,
        tags: '',
        weight: '',
        brand: '',
        mainImage: null,
        galleryImages: [],
        variants: [
            { id: Date.now(), name: 'Default', price: '', salePrice: '', stock: '', sku: '', media: [] }
        ]
    });

    const [viewingVariants, setViewingVariants] = useState(null);
    const [isVariantsViewModalOpen, setIsVariantsViewModalOpen] = useState(false);

    const fetchProductsRequestId = useRef(0);
    const editModalProductIdRef = useRef(null);

    const fetchCategories = async () => {
        try {
            const response = await adminApi.getCategoryTree();
            if (response.data.success) {
                setCategories(response.data.results || response.data.result || []);
            }
        } catch (error) {
            console.error('Failed to fetch categories');
        }
    };

    const fetchSellerOptions = async () => {
        try {
            const response = await adminApi.getSellerOptions();
            const items =
                response?.data?.result?.items ||
                response?.data?.data?.items ||
                response?.data?.result ||
                [];
            const list = Array.isArray(items) ? items : [];
            setSellerOptions(
                list
                    .map((seller) => ({
                        id: String(seller._id || seller.id || ''),
                        label: seller.shopName || seller.ownerName || 'Seller',
                    }))
                    .filter((seller) => seller.id)
                    .sort((a, b) => a.label.localeCompare(b.label)),
            );
        } catch (error) {
            console.error('Failed to fetch sellers for product filter');
            setSellerOptions([]);
        }
    };

    const fetchProducts = async (requestedPage = 1, requestSeq) => {
        setIsLoading(true);
        const seq = requestSeq ?? ++fetchProductsRequestId.current;
        try {
            const params = { page: requestedPage, limit: pageSize };
            if (searchTerm) params.search = searchTerm;
            if (filterCategory !== 'all') params.category = filterCategory;
            if (filterStatus !== 'all') params.status = filterStatus;
            if (filterBusinessType !== 'all') params.businessType = filterBusinessType;
            if (filterSeller !== 'all') params.sellerId = filterSeller;

            const response = await adminApi.getProducts(params);
            if (seq !== fetchProductsRequestId.current) return;
            if (response.data.success) {
                const payload = response.data.result || {};
                const list = Array.isArray(payload.items) ? payload.items : (response.data.results || []);
                // Hide legacy mock/seed rows that have no seller (UI used to label them "Admin").
                const sellerProducts = list.filter((p) => p.sellerId || p.seller?.shopName || p.storeName || p.restaurantName);
                setProducts(sellerProducts);
                setTotal(typeof payload.total === 'number' ? payload.total : sellerProducts.length);
                setPage(typeof payload.page === 'number' ? payload.page : requestedPage);
            }
        } catch (error) {
            if (seq !== fetchProductsRequestId.current) return;
            toast.error('Failed to fetch products');
        } finally {
            if (seq === fetchProductsRequestId.current) setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
        fetchSellerOptions();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts(1);
        }, 500); // Debounce search
        return () => clearTimeout(timer);
    }, [searchTerm, filterCategory, filterStatus, filterBusinessType, filterSeller, pageSize]);

    const activeCategories = useMemo(
        () => filterActiveCategoryTree(categories),
        [categories],
    );

    const categorySelectTree = useMemo(
        () => mergeCurrentCategoriesIntoTree(activeCategories, editingItem),
        [activeCategories, editingItem],
    );

    const selectedHeaderNode = useMemo(
        () => categorySelectTree.find((h) => categoryNodeId(h) === formData.header) || null,
        [categorySelectTree, formData.header],
    );

    const selectedCategoryNode = useMemo(
        () =>
            selectedHeaderNode?.children?.find((c) => categoryNodeId(c) === formData.categoryId) ||
            null,
        [selectedHeaderNode, formData.categoryId],
    );

    const handleSave = async () => {
        if (isSaving || !editingItem || !canEdit) return;

        if (!formData.name || !formData.header || !formData.categoryId || !formData.subcategoryId) {
            toast.error('Please fill all required fields, including categories');
            return;
        }

        const variants = Array.isArray(formData.variants) ? formData.variants : [];
        if (!variants.length) {
            toast.error('Add at least one variant with price and stock');
            setModalTab('variants');
            return;
        }
        for (const variant of variants) {
            if (!String(variant.name || '').trim() || !(Number(variant.price) > 0)) {
                toast.error('Each variant needs a name and price');
                setModalTab('variants');
                return;
            }
            if (variant.stock === '' || variant.stock == null || Number(variant.stock) < 0) {
                toast.error(`Variant "${variant.name}": stock is required`);
                setModalTab('variants');
                return;
            }
            if (countVariantMedia(variant) < MIN_VARIANT_IMAGES) {
                toast.error(`Variant "${variant.name || `#${variants.indexOf(variant) + 1}`}": add at least ${MIN_VARIANT_IMAGES} photo`);
                setModalTab('variants');
                return;
            }
            if (countVariantMedia(variant) > MAX_VARIANT_IMAGES) {
                toast.error(`Variant "${variant.name}": maximum ${MAX_VARIANT_IMAGES} photos allowed`);
                setModalTab('variants');
                return;
            }
        }

        if (variants.length > MAX_PRODUCT_VARIANTS) {
            toast.error(`Maximum ${MAX_PRODUCT_VARIANTS} variants allowed`);
            setModalTab('variants');
            return;
        }

        const firstVariant = variants[0] || {};

        setIsSaving(true);
        try {
            const data = new FormData();
            data.append('name', formData.name);
            data.append('slug', formData.slug);
            data.append('sku', formData.sku);
            data.append('description', formData.description);
            data.append('brand', formData.brand);
            data.append('weight', formData.weight);
            data.append('status', formData.status);
            data.append('price', Number(firstVariant.price) || 0);
            data.append('salePrice', Number(firstVariant.salePrice) || 0);
            data.append('packingFee', Number(formData.packingFee) || 0);
            data.append(
                'stock',
                variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0),
            );
            data.append('lowStockAlert', Number(formData.lowStockAlert) || 5);
            data.append('headerId', formData.header);
            data.append('categoryId', formData.categoryId);
            data.append('subcategoryId', formData.subcategoryId);
            data.append('tags', formData.tags);
            data.append('variants', JSON.stringify(serializeVariantsForApi(formData.variants)));
            appendVariantImageFiles(data, formData.variants);

            const productId = editingItem._id || editingItem.id;
            const response = await adminApi.updateProduct(productId, data);
            const updated = response.data?.result;

            toast.success('Product updated successfully');
            closeProductModal();
            setEditingItem(null);
            fetchProducts(page);

            if (updated) {
                setProducts((prev) =>
                    prev.map((row) =>
                        String(row._id || row.id) === String(productId)
                            ? { ...row, ...updated }
                            : row,
                    ),
                );
            }
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to update product');
        } finally {
            setIsSaving(false);
        }
    };

    const handleImageUpload = async (e, type) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const originalFile = e.target.files[0];
                const webpFile = await convertToWebP(originalFile);
                
                const reader = new FileReader();
                reader.onloadend = () => {
                    if (type === 'main') {
                        setFormData({ ...formData, mainImage: reader.result, mainImageFile: webpFile });
                    } else {
                        setFormData({
                            ...formData,
                            galleryImages: [...formData.galleryImages, reader.result],
                            galleryFiles: [...(formData.galleryFiles || []), webpFile]
                        });
                    }
                };
                reader.readAsDataURL(webpFile);
            } catch (error) {
                console.error("WebP conversion failed:", error);
                toast.error("Failed to process image");
            }
        }
    };

    const closeProductModal = () => {
        editModalProductIdRef.current = null;
        setIsProductModalOpen(false);
    };

    const applyProductToForm = (product) => {
        setFormData({
            name: product.name || '',
            slug: product.slug || '',
            sku: product.sku || '',
            description: product.description || '',
            price: product.price ?? '',
            salePrice: product.salePrice ?? product.discountPrice ?? '',
            packingFee: product.packingFee ?? '',
            stock: product.stock ?? '',
            lowStockAlert: product.lowStockAlert ?? 5,
            unit: product.unit || 'packet',
            header: toCategoryId(product.headerId),
            categoryId: toCategoryId(product.categoryId),
            subcategoryId: toCategoryId(product.subcategoryId),
            status: product.status || (product.isActive === false ? 'inactive' : 'active'),
            approvalStatus: product.approvalStatus || 'approved',
            isFeatured: product.isFeatured || false,
            tags: Array.isArray(product.tags) ? product.tags.join(', ') : product.tags || '',
            weight: product.weight || '',
            brand: product.brand || '',
            mainImage: product.mainImage || product.image || null,
            galleryImages: Array.isArray(product.galleryImages) ? product.galleryImages : [],
            variants: (product.variants && product.variants.length > 0)
                ? product.variants.map((v, idx) => ({
                    ...v,
                    id: v._id || v.id || `variant-${Date.now()}-${idx}`,
                    price: v.price ?? '',
                    salePrice: v.salePrice ?? '',
                    stock: v.stock ?? '',
                    sku: v.sku || '',
                    name: v.name || '',
                    media: buildVariantMediaFromImages(
                        Array.isArray(v.images) && v.images.length
                            ? v.images
                            : idx === 0
                                ? [product.mainImage || product.image, ...(product.galleryImages || [])].filter(Boolean)
                                : [],
                    ),
                }))
                : [
                    {
                        id: `variant-${Date.now()}-0`,
                        name: product.weight || product.unit || 'Default',
                        price: product.price ?? '',
                        salePrice: product.salePrice ?? product.discountPrice ?? '',
                        stock: product.stock ?? '',
                        sku: product.sku || '',
                        media: buildVariantMediaFromImages(
                            [product.mainImage || product.image, ...(product.galleryImages || [])].filter(Boolean),
                        ),
                    },
                ],
        });
        setEditingItem(product);
    };

    const openEditModal = (item = null, viewMode = true) => {
        if (!canEdit) {
            viewMode = true;
        }
        setIsViewMode(viewMode);
        setModalTab('general');

        if (!item) {
            editModalProductIdRef.current = null;
            setFormData({
                name: '', slug: '', sku: '', description: '', price: '',
                salePrice: '', packingFee: '', stock: '', lowStockAlert: 5, unit: 'packet',
                header: '', categoryId: '', subcategoryId: '', status: 'active',
                approvalStatus: 'approved',
                isFeatured: false, tags: '', weight: '', brand: '',
                mainImage: null, galleryImages: [],
                variants: [
                    { id: `variant-${Date.now()}-0`, name: '', price: '', salePrice: '', stock: '', sku: '' },
                ],
            });
            setEditingItem(null);
            setIsProductModalOpen(true);
            return;
        }

        // Open instantly with list-row data; refresh details in background.
        const productId = String(item._id || item.id || '');
        editModalProductIdRef.current = productId;
        applyProductToForm(item);
        setIsProductModalOpen(true);

        if (!productId) return;

        adminApi.getProductById(productId)
            .then((response) => {
                if (editModalProductIdRef.current !== productId) return;
                if (!response.data?.success || !response.data?.result) return;
                applyProductToForm(response.data.result);
            })
            .catch((error) => {
                console.warn('Failed to fetch product details, using list payload', error);
            });
    };

    const productsList = Array.isArray(products) ? products : [];
    
    const getProductTotalStock = (product) => {
        if (product.variants?.length > 0) {
            return product.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
        }
        return Number(product.stock) || 0;
    };

    const stats = useMemo(() => ({
        total: total,
        lowStock: productsList.filter(p => {
            const stock = getProductTotalStock(p);
            return stock > 0 && stock <= 10;
        }).length,
        outOfStock: productsList.filter(p => getProductTotalStock(p) === 0).length,
        active: productsList.filter(p => p.status === 'active').length
    }), [productsList, total]);

    const StatusBadge = ({ status, stock }) => {
        if (stock === 0) return <Badge variant="error" className="text-[10px] px-1.5 py-0">Out of Stock</Badge>;
        if (stock <= 10) return <Badge variant="warning" className="text-[10px] px-1.5 py-0">Low Stock</Badge>;
        if (status === 'active') return <Badge variant="success" className="text-[10px] px-1.5 py-0">Active</Badge>;
        return <Badge variant="gray" className="text-[10px] px-1.5 py-0">Draft</Badge>;
    };

    return (
        <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-2 duration-700 pb-16">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="ds-h1 flex items-center gap-2">
                        Product List
                        <Badge variant="primary" className="text-[9px] px-1.5 py-0 font-bold tracking-wider uppercase">Live</Badge>
                    </h1>
                    <p className="ds-description mt-0.5">Track your items, prices, and how many are left in stock.</p>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'All Items', val: stats.total, icon: HiOutlineCube, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Active Items', val: stats.active, icon: HiOutlineCheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Low Stock', val: stats.lowStock, icon: HiOutlineExclamationCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Out of Stock', val: stats.outOfStock, icon: HiOutlineArchiveBox, color: 'text-rose-600', bg: 'bg-rose-50' }
                ].map((stat, i) => (
                    <Card key={i} className="border-none shadow-sm ring-1 ring-slate-100 p-4 relative overflow-hidden group">
                        <div className="flex items-center gap-3">
                            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300", stat.bg, stat.color)}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="ds-label">{stat.label}</p>
                                <h4 className="ds-stat-medium">{stat.val}</h4>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Toolbox */}
            <Card className="border-none shadow-sm ring-1 ring-slate-100 p-3 bg-white/60 backdrop-blur-xl">
                <div className="flex flex-col lg:flex-row gap-3 items-center">
                    <div className="relative flex-1 group w-full">
                        <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-all" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name, SKU or slug..."
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 border-none rounded-xl text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/5 transition-all outline-none"
                        />
                    </div>
                    <div className="flex gap-2 shrink-0 w-full lg:w-auto flex-wrap">
                        <select
                            value={filterSeller}
                            onChange={(e) => setFilterSeller(e.target.value)}
                            className="flex-1 lg:flex-none min-w-[160px] px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/5 outline-none appearance-none cursor-pointer"
                        >
                            <option value="all">All Sellers</option>
                            {sellerOptions.map((seller) => (
                                <option key={seller.id} value={seller.id}>
                                    {seller.label}
                                </option>
                            ))}
                        </select>
                        <select
                            value={filterBusinessType}
                            onChange={(e) => setFilterBusinessType(e.target.value)}
                            className="flex-1 lg:flex-none px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/5 outline-none appearance-none cursor-pointer"
                        >
                            <option value="all">All Types</option>
                            <option value="quick_commerce">Products</option>
                        </select>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="flex-1 lg:flex-none px-4 py-2.5 bg-white ring-1 ring-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-primary/5 outline-none appearance-none cursor-pointer"
                        >
                            <option value="all">All Categories</option>
                            {categories.map(h => (
                                <optgroup key={h._id} label={h.name}>
                                    <option value={h._id}>All {h.name}</option>
                                    {(h.children || []).map(c => (
                                        <option key={c._id} value={c._id}>{c.name}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <button
                            onClick={() => {
                                const nextStatus = filterStatus === 'all' ? 'active' : filterStatus === 'active' ? 'inactive' : 'all';
                                setFilterStatus(nextStatus);
                            }}
                            className={cn(
                                "flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                                filterStatus === 'active' ? "bg-emerald-500 text-white shadow-md shadow-emerald-100" :
                                    filterStatus === 'inactive' ? "bg-amber-500 text-white shadow-md shadow-amber-100" :
                                        "bg-white ring-1 ring-slate-200 text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            <HiOutlineFunnel className="h-4 w-4" />
                            <span>
                                {filterStatus === 'active' ? 'ONLY LIVE' :
                                    filterStatus === 'inactive' ? 'ONLY DRAFT' :
                                        'SHOW ALL'}
                            </span>
                        </button>
                    </div>
                </div>
            </Card>

            {/* Product Table */}
            <Card className="border-none shadow-xl ring-1 ring-slate-100 overflow-hidden rounded-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Seller</th>
                                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Variant</th>
                                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                                <th className="px-6 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Subcategory</th>
                                <th className="px-6 py-3 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Price</th>
                                <th className="px-6 py-3 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Stock</th>
                                <th className="px-6 py-3 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-right text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <HiOutlineArrowPath className="h-8 w-8 text-primary animate-spin" />
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Products...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : productsList.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-20 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">No products found</td>
                                </tr>
                            ) : productsList.map((p) => (
                                <tr key={p._id} className="hover:bg-slate-50/30 transition-colors group">
                                    {/* Product Column */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg overflow-hidden bg-slate-100 ring-1 ring-slate-200">
                                                <ProductImage
                                                    product={p}
                                                    alt={p.name}
                                                    className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-900">{p.name}</p>
                                                <p className="text-[9px] font-semibold text-slate-400">{p.unit}</p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Seller Column */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                                            <span className="text-xs font-bold text-slate-700">
                                                {p.seller?.shopName || p.storeName || p.restaurantName || 'Unknown Store'}
                                            </span>
                                        </div>
                                    </td>

                                    {/* Variant Column */}
                                    <td
                                        className="px-6 py-4 cursor-pointer hover:bg-purple-50/50 transition-colors group/variant"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setViewingVariants(p);
                                            setIsVariantsViewModalOpen(true);
                                        }}
                                    >
                                        {p.variants && p.variants.length > 0 ? (
                                            <div className="flex items-center gap-1.5">
                                                <HiOutlineSwatch className="h-3.5 w-3.5 text-purple-500 group-hover/variant:scale-110 transition-transform" />
                                                <span className="text-xs font-bold text-purple-700 underline underline-offset-4 decoration-purple-200 group-hover/variant:decoration-purple-500">{p.variants.length} Variant{p.variants.length > 1 ? 's' : ''}</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs font-semibold text-slate-400">No variants</span>
                                        )}
                                    </td>

                                    {/* Category Column */}
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">{p.categoryId?.name || 'N/A'}</span>
                                    </td>

                                    {/* Subcategory Column */}
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-bold text-slate-600">{p.subcategoryId?.name || 'N/A'}</span>
                                    </td>

                                    {/* Price Column */}
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center">
                                            {(() => {
                                                const first = Array.isArray(p.variants) && p.variants[0] ? p.variants[0] : null;
                                                const price = Number(first?.price ?? p.price) || 0;
                                                const sale = Number(first?.salePrice ?? p.salePrice) || 0;
                                                const showSale = sale > 0 && sale < price;
                                                return (
                                                    <>
                                                        <span className={cn("text-xs font-bold", showSale ? "text-slate-400 line-through scale-90" : "text-slate-900")}>₹{price}</span>
                                                        {showSale && <span className="text-xs font-bold text-emerald-600">₹{sale}</span>}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </td>

                                    {/* Stock Column */}
                                    <td className="px-6 py-4 text-center">
                                        {(() => {
                                            const totalStock = getProductTotalStock(p);
                                            return (
                                                <span className={cn("text-xs font-bold", totalStock === 0 ? "text-rose-500" : totalStock <= 10 ? "text-amber-500" : "text-emerald-500")}>
                                                    {totalStock}
                                                </span>
                                            );
                                        })()}
                                    </td>

                                    {/* Status Column */}
                                    <td className="px-6 py-4 text-center">
                                        <StatusBadge status={p.status} stock={getProductTotalStock(p)} />
                                    </td>

                                    {/* Actions Column */}
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(p, true)}
                                                className="p-1.5 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-all text-gray-400 shadow-sm ring-1 ring-gray-100"
                                                title="View Details"
                                            >
                                                <HiOutlineEye className="h-3.5 w-3.5" />
                                            </button>
                                            {canEdit && (
                                                <button
                                                    onClick={() => openEditModal(p, false)}
                                                    className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all text-gray-400 shadow-sm ring-1 ring-gray-100"
                                                    title="Edit Product"
                                                >
                                                    <HiOutlinePencilSquare className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-3 border-t border-slate-100">
                    <Pagination
                        page={page}
                        totalPages={Math.ceil(total / pageSize) || 1}
                        total={total}
                        pageSize={pageSize}
                        onPageChange={(p) => fetchProducts(p)}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setPage(1);
                        }}
                        loading={isLoading}
                    />
                </div>
            </Card>

            {/* Super Detailed Modal */}
            <AnimatePresence>
                {isProductModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={closeProductModal}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="w-full max-w-5xl relative z-10 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-slate-100">
                                <div className="flex items-center space-x-3">
                                    <div className="h-10 w-10 bg-red-600 text-white rounded-xl flex items-center justify-center">
                                        <HiOutlineCube className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="admin-h3">
                                            {isViewMode ? 'Product Details' : 'Edit Product'}
                                        </h3>
                                        <div className="flex items-center space-x-2 mt-0.5">
                                            <Badge variant="primary" className="text-[7px] font-bold uppercase tracking-widest px-1">SYSTEM</Badge>
                                            <HiOutlineChevronRight className="h-2.5 w-2.5 text-slate-300" />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formData.sku || 'PENDING SKU'}</span>
                                            {(editingItem?.storeName || editingItem?.seller?.shopName || editingItem?.restaurantName) && (
                                                <>
                                                    <HiOutlineChevronRight className="h-2.5 w-2.5 text-slate-300" />
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[160px]">
                                                        {editingItem.storeName || editingItem.seller?.shopName || editingItem.restaurantName}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={closeProductModal} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                                    <HiOutlineXMark className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="flex flex-col lg:flex-row flex-1 min-h-[400px] max-h-[calc(100vh-200px)] overflow-hidden">
                                {/* Modal Sidebar Tabs */}
                                <div className="lg:w-1/4 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1 overflow-y-auto scrollbar-hide">
                                    {modalTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setModalTab(tab.id)}
                                            className={cn(
                                                "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all",
                                                modalTab === tab.id
                                                    ? "bg-white text-primary shadow-sm ring-1 ring-slate-100"
                                                    : "text-slate-500 hover:bg-slate-100"
                                            )}
                                        >
                                            <tab.icon className="h-4 w-4" />
                                            <span>{tab.label}</span>
                                        </button>
                                    ))}

                                    <div className="pt-8 px-4">
                                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                            <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Status</p>
                                            <select
                                                value={formData.status === 'inactive' ? 'inactive' : 'active'}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                disabled={isViewMode}
                                                className="w-full bg-transparent border-none text-xs font-bold text-emerald-700 outline-none p-0 cursor-pointer disabled:opacity-80"
                                            >
                                                <option value="active">ACTIVE</option>
                                                <option value="inactive">INACTIVE</option>
                                            </select>
                                            {!isViewMode && editingItem?.deactivatedByParentId && formData.status === 'active' && (
                                                <p className="mt-2 text-[10px] font-semibold text-amber-700 leading-snug">
                                                    Category was deactivated. Assign an active category before saving as active.
                                                </p>
                                            )}
                                        </div>
                                        <div className="mt-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                                            <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mb-1">Approval</p>
                                            <p className="text-xs font-bold text-amber-700 uppercase">{formData.approvalStatus || 'approved'}</p>
                                        </div>
                                        <div className="mt-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between">
                                            <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">Featured</p>
                                            <p className="text-xs font-bold text-indigo-700">{formData.isFeatured ? 'Yes' : 'No'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Content Area */}
                                <div className="flex-1 p-4 overflow-y-auto">
                                    {modalTab === 'general' && (
                                        <div className="ds-section-spacing animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Product Title</label>
                                                    <input
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
                                                        placeholder="e.g. Premium Basmati Rice"
                                                        disabled={isViewMode}
                                                    />
                                                </div>
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Web Address</label>
                                                    <div className="flex items-center bg-slate-50 rounded-xl px-4 py-2.5">
                                                        <span className="text-[10px] text-slate-400 font-bold mr-1">/product/</span>
                                                        <input
                                                            value={formData.slug}
                                                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                                            className="flex-1 bg-transparent border-none text-sm text-slate-500 font-semibold outline-none"
                                                            placeholder="premium-basmati-rice"
                                                            disabled={isViewMode}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">About this item</label>
                                                <textarea
                                                    value={formData.description}
                                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                    onWheel={(e) => e.stopPropagation()}
                                                    onTouchMove={(e) => e.stopPropagation()}
                                                    className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[160px] max-h-[260px] outline-none resize-none overflow-y-auto custom-scrollbar"
                                                    placeholder="Describe the item here..."
                                                    disabled={isViewMode}
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Brand Name</label>
                                                    <input
                                                        value={formData.brand}
                                                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
                                                        placeholder="e.g. Amul"
                                                        disabled={isViewMode}
                                                    />
                                                </div>
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Product Code</label>
                                                    <input
                                                        value={formData.sku}
                                                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-mono font-bold outline-none ring-primary/5 focus:ring-2"
                                                        placeholder="AUTO-GENERATED"
                                                        disabled={isViewMode}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {modalTab === 'category' && (
                                        <div className="ds-section-spacing animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Main Group (Header) <span className="text-rose-500">*</span></label>
                                                    <select
                                                        value={formData.header}
                                                        onChange={(e) => setFormData({ ...formData, header: e.target.value, categoryId: '', subcategoryId: '' })}
                                                        disabled={isViewMode}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50"
                                                    >
                                                        <option value="">Select Main Group</option>
                                                        {categorySelectTree.map((h) => (
                                                            <option key={categoryNodeId(h)} value={categoryNodeId(h)}>
                                                                {h.name}{!isCategorySelectable(h) ? ' (inactive)' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Specific Category <span className="text-rose-500">*</span></label>
                                                    <select
                                                        value={formData.categoryId}
                                                        onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subcategoryId: '' })}
                                                        disabled={isViewMode || !formData.header}
                                                        className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50"
                                                    >
                                                        <option value="">Select Category</option>
                                                        {(selectedHeaderNode?.children || []).map((c) => (
                                                            <option key={categoryNodeId(c)} value={categoryNodeId(c)}>
                                                                {c.name}{!isCategorySelectable(c) ? ' (inactive)' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5 flex flex-col">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Sub-Category <span className="text-rose-500">*</span></label>
                                                <select
                                                    value={formData.subcategoryId}
                                                    onChange={(e) => setFormData({ ...formData, subcategoryId: e.target.value })}
                                                    disabled={isViewMode || !formData.categoryId}
                                                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50"
                                                >
                                                    <option value="">Select Sub-Category</option>
                                                    {(selectedCategoryNode?.children || []).map((sc) => (
                                                        <option key={categoryNodeId(sc)} value={categoryNodeId(sc)}>
                                                            {sc.name}{!isCategorySelectable(sc) ? ' (inactive)' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            {editingItem?.deactivatedByParentId && (
                                                <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                                                    This product&apos;s category was deactivated. Choose an active category path before saving as Active.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {modalTab === 'variants' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-slate-600 uppercase tracking-widest ml-1">Packing Fee (₹)</label>
                                                    <input
                                                        type="number"
                                                        value={formData.packingFee}
                                                        onChange={(e) => setFormData({ ...formData, packingFee: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-white shadow-sm ring-1 ring-slate-200 border-none rounded-xl text-sm font-bold outline-none"
                                                        disabled={isViewMode}
                                                        placeholder="e.g. 10"
                                                    />
                                                </div>
                                                <div className="space-y-1.5 flex flex-col">
                                                    <label className="text-[9px] font-bold text-rose-500 uppercase tracking-widest ml-1">Low Stock Alert Level</label>
                                                    <input
                                                        type="number"
                                                        value={formData.lowStockAlert}
                                                        onChange={(e) => setFormData({ ...formData, lowStockAlert: e.target.value })}
                                                        className="w-full px-4 py-2.5 bg-rose-50/50 border-none rounded-xl text-sm font-bold text-rose-600 outline-none ring-rose-100"
                                                        disabled={isViewMode}
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-bold">Product Variants</h4>
                                                {!isViewMode && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if ((formData.variants || []).length >= MAX_PRODUCT_VARIANTS) {
                                                                toast.error(`Maximum ${MAX_PRODUCT_VARIANTS} variants allowed`);
                                                                return;
                                                            }
                                                            setFormData({
                                                                ...formData,
                                                                variants: [
                                                                    ...formData.variants,
                                                                    { id: Date.now(), name: '', price: '', salePrice: '', stock: '', sku: '', media: [] },
                                                                ],
                                                            });
                                                        }}
                                                        disabled={(formData.variants || []).length >= MAX_PRODUCT_VARIANTS}
                                                        className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-[10px] font-bold disabled:opacity-50"
                                                    >
                                                        + ADD
                                                    </button>
                                                )}
                                            </div>
                                            <div className="space-y-3">
                                                {formData.variants?.length > 0 ? (
                                                    formData.variants.map((v, i) => (
                                                    <div key={v.id || i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                                                        <input
                                                            value={v.name || ''}
                                                            onChange={(e) => {
                                                                const next = [...formData.variants];
                                                                next[i] = { ...next[i], name: e.target.value };
                                                                setFormData({ ...formData, variants: next });
                                                            }}
                                                            placeholder="Name"
                                                            className="bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none"
                                                            disabled={isViewMode}
                                                        />
                                                        <input
                                                            type="number"
                                                            value={v.price ?? ''}
                                                            onChange={(e) => {
                                                                const next = [...formData.variants];
                                                                next[i] = { ...next[i], price: e.target.value };
                                                                setFormData({ ...formData, variants: next });
                                                            }}
                                                            placeholder="Price"
                                                            className="bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none"
                                                            disabled={isViewMode}
                                                        />
                                                        <input
                                                            type="number"
                                                            value={v.salePrice ?? ''}
                                                            onChange={(e) => {
                                                                const next = [...formData.variants];
                                                                next[i] = { ...next[i], salePrice: e.target.value };
                                                                setFormData({ ...formData, variants: next });
                                                            }}
                                                            placeholder="Sale Price"
                                                            className="bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none"
                                                            disabled={isViewMode}
                                                        />
                                                        <input
                                                            type="number"
                                                            value={v.stock ?? ''}
                                                            onChange={(e) => {
                                                                const next = [...formData.variants];
                                                                next[i] = { ...next[i], stock: e.target.value };
                                                                setFormData({ ...formData, variants: next });
                                                            }}
                                                            placeholder="Stock"
                                                            className="bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none"
                                                            disabled={isViewMode}
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                value={v.sku || ''}
                                                                onChange={(e) => {
                                                                    const next = [...formData.variants];
                                                                    next[i] = { ...next[i], sku: e.target.value };
                                                                    setFormData({ ...formData, variants: next });
                                                                }}
                                                                placeholder="SKU"
                                                                className="bg-white px-3 py-2 rounded-xl text-xs ring-1 ring-slate-100 outline-none font-mono flex-1"
                                                                disabled={isViewMode}
                                                            />
                                                            {!isViewMode && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setFormData((prev) => ({
                                                                            ...prev,
                                                                            variants: (prev.variants || []).filter((_, idx) => idx !== i),
                                                                        }))
                                                                    }
                                                                    className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg shrink-0"
                                                                >
                                                                    <HiOutlineTrash className="h-4 w-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {!isViewMode ? (
                                                            <VariantImageSlots
                                                                variant={v}
                                                                compact
                                                                onChange={(nextVariant) => {
                                                                    const next = [...formData.variants];
                                                                    next[i] = nextVariant;
                                                                    setFormData({ ...formData, variants: next });
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="col-span-full flex flex-wrap gap-2">
                                                                {(v.media || buildVariantMediaFromImages(v.images || [])).map((item, imageIndex) => (
                                                                    <img
                                                                        key={item.id || imageIndex}
                                                                        src={item.preview || item.url}
                                                                        alt=""
                                                                        className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    ))
                                                ) : (
                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-semibold text-slate-500">
                                                        No variants yet. Add at least one variant with name, price, and stock.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                                <button
                                    onClick={closeProductModal}
                                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    CLOSE
                                </button>
                                {!isViewMode && canEdit && editingItem && (
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="bg-red-600 text-white px-10 py-2.5 rounded-xl text-sm font-bold shadow-xl hover:bg-red-700 transition-all disabled:opacity-50"
                                    >
                                        {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* Viewing Variants Modal */}
            <Modal
                isOpen={isVariantsViewModalOpen}
                onClose={() => setIsVariantsViewModalOpen(false)}
                title="Product Variants Details"
                size="lg"
            >
                <div className="py-2">
                    <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="h-16 w-16 bg-white rounded-xl shadow-sm overflow-hidden flex items-center justify-center border border-slate-100">
                            <ProductImage
                                product={viewingVariants}
                                alt={viewingVariants?.name || 'Product'}
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 leading-tight">{viewingVariants?.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="primary" className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5">{viewingVariants?.categoryId?.name || 'Category'}</Badge>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Master SKU: {viewingVariants?.sku || viewingVariants?._id?.slice(-6).toUpperCase() || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Variant Specification</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Unit Price</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Available Stock</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Variant SKU</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {viewingVariants?.variants?.map((v, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/30 transition-all cursor-default">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-slate-700 group-hover:text-primary transition-colors">{v.name}</span>
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Variation {idx + 1}</span>
                                                </div>
                                                {Array.isArray(v.images) && v.images.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {v.images.slice(0, 3).map((image, imageIndex) => (
                                                            <img
                                                                key={`${image}-${imageIndex}`}
                                                                src={image}
                                                                alt=""
                                                                className="w-10 h-10 rounded-md object-cover border border-slate-200"
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className={cn("text-xs font-bold", v.salePrice > 0 ? "text-slate-400 line-through scale-90" : "text-slate-900")}>₹{v.price}</span>
                                                {v.salePrice > 0 && <span className="text-xs font-bold text-emerald-600">₹{v.salePrice}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge variant={v.stock === 0 ? "rose" : v.stock <= 10 ? "amber" : "emerald"} className="text-[10px] font-black uppercase tracking-widest px-2 shadow-sm">
                                                {v.stock === 0 ? 'OUT OF STOCK' : `${v.stock} UNITS`}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-[10px] font-bold text-slate-400 font-mono tracking-tighter uppercase bg-slate-100 px-2 py-1 rounded-lg">
                                                {v.sku || 'N/A'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button
                            onClick={() => setIsVariantsViewModalOpen(false)}
                            className="bg-red-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
                        >
                            CLOSE VIEWER
                        </button>
                    </div>
                </div>
            </Modal>

        </div>
    );
};

export default ProductManagement;
