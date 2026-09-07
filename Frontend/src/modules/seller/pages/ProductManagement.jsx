import React, { useState, useMemo, useRef, useEffect } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlinePlus,
  HiOutlineCube,
  HiOutlineMagnifyingGlass,
  HiOutlineFunnel,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlineEye,
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
  HiOutlineSquaresPlus,
} from "react-icons/hi2";
import Modal from "@shared/components/ui/Modal";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";
import VariantEditor, { newVariant } from "../components/VariantEditor";
import {
  validateVariantsForSubmit,
  appendVariantImageFiles,
  buildVariantMediaFromImages,
} from "@/shared/utils/variantMedia";

import { MagicCard } from "@/components/ui/magic-card";
import { BlurFade } from "@/components/ui/blur-fade";
import ShimmerButton from "@/components/ui/shimmer-button";
import Pagination from "@shared/components/ui/Pagination";

const ProductManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const qFromUrl = searchParams.get("q") || "";

  const [products, setProducts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const fetchProducts = async (requestedPage = 1) => {
    setIsLoading(true);
    try {
      const res = await sellerApi.getProducts({ page: requestedPage, limit: pageSize });
      if (res.data.success) {
        // Backend returns handleResponse(..., { items, page, limit, total, totalPages })
        const payload = res.data.result || {};
        const rawProducts = Array.isArray(payload.items)
          ? payload.items
          : (res.data.results || []);
        const safe = Array.isArray(rawProducts) ? rawProducts : [];
        setProducts(safe);
        if (typeof payload.total === "number") {
          setTotal(payload.total);
        } else {
          setTotal(safe.length);
        }
        if (typeof payload.page === "number") {
          setPage(payload.page);
        } else {
          setPage(requestedPage);
        }
      }
    } catch (error) {
      toast.error("Failed to fetch products");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await sellerApi.getCategoryTree();
      if (res.data.success) {
        setDbCategories(res.data.results || res.data.result || []);
      }
    } catch (error) {
      // fail silently
    }
  };

  React.useEffect(() => {
    fetchProducts(1);
    fetchCategories();
  }, []);

  const categories = dbCategories;

  const [searchTerm, setSearchTerm] = useState(qFromUrl);

  React.useEffect(() => {
    if (qFromUrl !== searchTerm) setSearchTerm(qFromUrl);
  }, [qFromUrl]);

  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("All");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterDropdownRef = useRef(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [viewingVariants, setViewingVariants] = useState(null);
  const [isVariantsViewModalOpen, setIsVariantsViewModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [modalTab, setModalTab] = useState("general");

  // Lock body scroll when any modal is open
  useEffect(() => {
    const anyOpen = isProductModalOpen || isDeleteModalOpen || isVariantsViewModalOpen;
    if (anyOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [isProductModalOpen, isDeleteModalOpen, isVariantsViewModalOpen]);

  // Close filter dropdown on outside click
  React.useEffect(() => {
    if (!isFilterOpen) return;
    const handleClickOutside = (event) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(event.target)
      ) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterOpen]);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    sku: "",
    description: "",
    lowStockAlert: 5,
    category: "",
    header: "",
    subcategory: "",
    status: "active",
    brand: "",
    variants: [newVariant()],
  });

  const safeProducts = useMemo(
    () => (Array.isArray(products) ? products : []),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const min = priceMin ? Number(priceMin) : null;
    const max = priceMax ? Number(priceMax) : null;

    return safeProducts.filter((p) => {
      const variantSkus = Array.isArray(p.variants)
        ? p.variants
            .map((v) => (v?.sku || "").toString().toLowerCase())
            .filter(Boolean)
        : [];
      const skuCandidate =
        (p.sku || "").toString().toLowerCase() ||
        (variantSkus.length > 0 ? variantSkus[0] : "");

      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (!!skuCandidate && skuCandidate.includes(term));
      const matchesCategory =
        filterCategory === "all" ||
        (p.categoryId?._id || p.categoryId) === filterCategory ||
        (p.headerId?._id || p.headerId) === filterCategory;

      let matchesStatus = filterStatus === "All";
      if (filterStatus === "Active") matchesStatus = p.status === "active";
      if (filterStatus === "Low Stock")
        matchesStatus = p.stock > 0 && p.stock <= 10;
      if (filterStatus === "Out of Stock") matchesStatus = p.stock === 0;

      let matchesPrice = true;
      const effectivePrice = Number(p.salePrice ?? p.price ?? 0);
      if (min !== null && !Number.isNaN(min)) {
        matchesPrice = matchesPrice && effectivePrice >= min;
      }
      if (max !== null && !Number.isNaN(max)) {
        matchesPrice = matchesPrice && effectivePrice <= max;
      }

      return matchesSearch && matchesCategory && matchesStatus && matchesPrice;
    });
  }, [safeProducts, searchTerm, filterCategory, filterStatus, priceMin, priceMax]);

  const stats = useMemo(
    () => ({
      total: safeProducts.length,
      lowStock: safeProducts.filter((p) => p.stock > 0 && p.stock <= 10).length,
      outOfStock: safeProducts.filter((p) => p.stock === 0).length,
      active: safeProducts.filter((p) => p.status === "active").length,
    }),
    [safeProducts],
  );

  const handleSave = async () => {
    try {
      if (!formData.name || !formData.header || !formData.category || !formData.subcategory) {
        toast.error("Please fill all required fields, including categories");
        return;
      }

      const variantError = validateVariantsForSubmit(formData.variants);
      if (variantError) {
        toast.error(variantError);
        setModalTab("variants");
        return;
      }

      const data = new FormData();
      data.append("name", formData.name);
      data.append("slug", formData.slug);
      data.append("sku", formData.sku);
      data.append("description", formData.description);
      data.append("headerId", formData.header);
      data.append("categoryId", formData.category);
      data.append("subcategoryId", formData.subcategory);
      data.append("status", formData.status);
      data.append("brand", formData.brand);

      // Variants carry price/stock/sku/images — the only source of truth now.
      const serializedVariants = formData.variants.map(({ id, media, ...rest }) => ({
        ...rest,
        images: (media || [])
          .filter((item) => item?.url && !String(item.url).startsWith("data:"))
          .map((item) => item.url),
      }));
      data.append("variants", JSON.stringify(serializedVariants));
      appendVariantImageFiles(data, formData.variants);

      if (editingItem) {
        await sellerApi.updateProduct(editingItem._id || editingItem.id, data);
        toast.success("Product updated successfully");
      } else {
        await sellerApi.createProduct(data);
        toast.success("Product created successfully");
      }

      setIsProductModalOpen(false);
      setEditingItem(null);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save product");
    }
  };


  const exportProducts = () => {
    console.log("Exporting products...");
    alert("Exporting " + safeProducts.length + " products as CSV (Simulation)");
  };

  const handleDeleteClick = (product) => {
    setItemToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    try {
      await sellerApi.deleteProduct(itemToDelete._id || itemToDelete.id);
      toast.success("Product deleted successfully");
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      fetchProducts();
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  const openEditModal = (item = null) => {
    if (item) {
      const legacyImages = [item.mainImage, ...(item.galleryImages || [])].filter(Boolean);
      const variants =
        item.variants && item.variants.length > 0
          ? item.variants.map((v) => ({
              ...v,
              costPrice: v.costPrice ?? "",
              id: v._id || newVariant().id,
              media: buildVariantMediaFromImages(
                Array.isArray(v.images) && v.images.length > 0 ? v.images : legacyImages,
              ),
            }))
          : [
              {
                ...newVariant(),
                name: "Default",
                costPrice: item.costPrice ?? "",
                price: item.price || "",
                salePrice: item.salePrice || "",
                stock: item.stock || "",
                sku: item.sku || "",
                media: buildVariantMediaFromImages(legacyImages),
              },
            ];

      setFormData({
        name: item.name || "",
        slug: item.slug || "",
        sku: item.sku || "",
        description: item.description || "",
        lowStockAlert: item.lowStockAlert || 5,
        header: item.headerId?._id || item.headerId || "",
        category: item.categoryId?._id || item.categoryId || "",
        subcategory: item.subcategoryId?._id || item.subcategoryId || "",
        status: item.status || "active",
        brand: item.brand || "",
        variants,
      });
      setEditingItem(item);
    } else {
      setFormData({
        name: "",
        slug: "",
        sku: "",
        description: "",
        lowStockAlert: 5,
        category: "",
        header: "",
        status: "active",
        brand: "",
        variants: [newVariant()],
      });
      setEditingItem(null);
    }
    setModalTab("general");
    setIsProductModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-16 font-['Roboto',sans-serif]">
      {/* Page Header */}
      <BlurFade delay={0.1}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/60 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/70 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2 text-slate-900 tracking-tight">
              Product Catalog
              <Badge
                variant="primary"
                className="text-[9px] px-2 py-0.5 font-extrabold tracking-wider uppercase bg-[#fde8ea] text-[#E71D28] border border-rose-200 rounded-full">
                LIVE MARKET
              </Badge>
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5 font-medium">
              Manage items, prices, variants, and real-time inventory levels.
            </p>
          </div>
          <ShimmerButton
            onClick={() => navigate("/seller/products/add")}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-lg shadow-rose-500/20 flex items-center space-x-2 text-white bg-[#E71D28] hover:bg-[#c41922] active:scale-95 transition-all self-start lg:self-auto"
            background="#E71D28">
            <HiOutlinePlus className="h-4 w-4 mr-1.5" />
            <span>ADD NEW PRODUCT</span>
          </ShimmerButton>
        </div>
      </BlurFade>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {[
          {
            label: "All Items",
            val: stats.total,
            icon: HiOutlineCube,
            color: "text-white",
            bg: "bg-indigo-600 shadow-md shadow-indigo-500/30",
            cardBg: "bg-indigo-50/90 border border-indigo-200/90 shadow-xs shadow-indigo-500/10",
            gradientColor: "#c7d2fe",
            status: "All",
          },
          {
            label: "Active Items",
            val: stats.active,
            icon: HiOutlineCheckCircle,
            color: "text-white",
            bg: "bg-emerald-600 shadow-md shadow-emerald-500/30",
            cardBg: "bg-emerald-50/90 border border-emerald-200/90 shadow-xs shadow-emerald-500/10",
            gradientColor: "#a7f3d0",
            status: "Active",
          },
          {
            label: "Low Stock",
            val: stats.lowStock,
            icon: HiOutlineExclamationCircle,
            color: "text-white",
            bg: "bg-amber-600 shadow-md shadow-amber-500/30",
            cardBg: "bg-amber-50/90 border border-amber-200/90 shadow-xs shadow-amber-500/10",
            gradientColor: "#fde68a",
            status: "Low Stock",
          },
          {
            label: "Out of Stock",
            val: stats.outOfStock,
            icon: HiOutlineArchiveBox,
            color: "text-white",
            bg: "bg-rose-600 shadow-md shadow-rose-500/30",
            cardBg: "bg-rose-50/90 border border-rose-200/90 shadow-xs shadow-rose-500/10",
            gradientColor: "#fecdd3",
            status: "Out of Stock",
          },
        ].map((stat, i) => (
          <BlurFade key={i} delay={0.1 + i * 0.05}>
            <div
              onClick={() => setFilterStatus(stat.status)}
              className={cn(
                "cursor-pointer rounded-xl md:rounded-2xl transition-all duration-300",
                filterStatus === stat.status
                  ? "ring-2 ring-[#E71D28] shadow-md scale-[1.02]"
                  : "hover:shadow-sm hover:-translate-y-0.5",
              )}>
              <MagicCard
                className={cn("border-none shadow-xs p-0 overflow-hidden group rounded-xl md:rounded-2xl", stat.cardBg)}
                gradientColor={stat.gradientColor}>
                <div className="flex items-center gap-2 md:gap-3 p-2.5 sm:p-3.5 relative z-10">
                  <div
                    className={cn(
                      "h-8 w-8 sm:h-10 sm:w-10 md:h-11 md:w-11 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-300 shadow-xs",
                      stat.bg,
                      stat.color,
                    )}>
                    <stat.icon className="h-4 w-4 sm:h-5 sm:w-5 md:h-5 md:w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 truncate">
                      {stat.label}
                    </p>
                    <h3 className="text-sm sm:text-lg md:text-xl font-black text-slate-900 tracking-tight mt-0.5">
                      {stat.val}
                    </h3>
                  </div>
                </div>
              </MagicCard>
            </div>
          </BlurFade>
        ))}
      </div>

      {/* Toolbox */}
      <BlurFade delay={0.25}>
        <Card className="relative z-30 border border-slate-200/80 shadow-xs p-3 bg-white/90 backdrop-blur-xl rounded-2xl">
          <div className="flex flex-col lg:flex-row gap-3 items-center">
            <div className="relative flex-1 group w-full">
              <HiOutlineMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#E71D28] transition-colors" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchTerm(value);
                  const next = new URLSearchParams(searchParams);
                  if (value) {
                    next.set("q", value);
                  } else {
                    next.delete("q");
                  }
                  setSearchParams(next);
                }}
                placeholder="Search products by name or SKU code..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200/70 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#E71D28]/20 focus:border-[#E71D28] transition-all outline-none"
              />
            </div>
            <div className="relative flex gap-2 shrink-0 w-full lg:w-auto">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="flex-1 lg:flex-none px-3.5 py-2.5 bg-slate-50 border border-slate-200/70 rounded-xl text-xs font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#E71D28]/20 outline-none cursor-pointer">
                <option value="all">All Categories</option>
                {categories.map((h) => (
                  <optgroup key={h._id || h.id} label={h.name}>
                    {(h.children || []).map((c) => (
                      <option key={c._id || c.id} value={c._id || c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                onClick={() => setIsFilterOpen((prev) => !prev)}
                className={cn(
                  "flex items-center space-x-2 px-4 py-2.5 border rounded-xl text-xs font-bold transition-all",
                  isFilterOpen
                    ? "bg-[#E71D28] text-white border-[#E71D28] shadow-md shadow-rose-500/20"
                    : "bg-slate-50 text-slate-700 border-slate-200/70 hover:bg-slate-100"
                )}
              >
                <HiOutlineFunnel className="h-4 w-4" />
                <span>Filters</span>
              </button>
            </div>
          </div>
        </Card>
      </BlurFade>

      {/* Product Table */}
      <BlurFade delay={0.3}>
        <Card className="relative z-10 border border-slate-200/80 shadow-md ring-1 ring-slate-100 overflow-hidden rounded-2xl bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80">
                  <th className="px-5 py-3.5 text-xs font-black text-slate-700 uppercase tracking-wider text-left">
                    Product
                  </th>
                  <th className="px-4 py-3.5 text-xs font-black text-slate-700 uppercase tracking-wider text-left">
                    SKU Code
                  </th>
                  <th className="px-4 py-3.5 text-xs font-black text-slate-700 uppercase tracking-wider text-left">
                    Header
                  </th>
                  <th className="px-4 py-3.5 text-xs font-black text-slate-700 uppercase tracking-wider text-left">
                    Category
                  </th>
                  <th className="px-4 py-3.5 text-xs font-black text-slate-700 uppercase tracking-wider text-left">
                    Price
                  </th>
                  <th className="px-4 py-3.5 text-xs font-black text-slate-700 uppercase tracking-wider text-center">
                    Variants
                  </th>
                  <th className="px-4 py-3.5 text-xs font-black text-slate-700 uppercase tracking-wider text-center">
                    Stock
                  </th>
                  <th className="px-5 py-3.5 text-xs font-black text-slate-700 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <HiOutlineCube className="h-10 w-10 text-slate-300 mb-2" />
                        <p className="text-sm font-bold text-slate-700">No products found</p>
                        <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search query or category filters.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr
                      key={p._id || p.id}
                      className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 shrink-0 shadow-xs">
                            <img
                              src={p.mainImage || p.image || "https://images.unsplash.com/photo-1550989460-0adf9ea622e2"}
                              alt={p.name}
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#E71D28] transition-colors truncate max-w-[200px] sm:max-w-[280px]">
                              {p.name}
                            </p>
                            {p.brand && (
                              <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                                Brand: {p.brand}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200/60 inline-block">
                          {p.sku ||
                            (Array.isArray(p.variants) && p.variants.length > 0 && p.variants[0]?.sku) ||
                            "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-[10px] sm:text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full inline-block">
                          {p.headerId?.name || "General"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-semibold text-slate-700">
                          {p.categoryId?.name || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          {p.salePrice && Number(p.salePrice) < Number(p.price) ? (
                            <>
                              <span className="text-xs sm:text-sm font-extrabold text-[#E71D28]">
                                ₹{p.salePrice}
                              </span>
                              <span className="text-[10px] text-slate-400 line-through font-semibold">
                                ₹{p.price}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                              ₹{p.price}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {p.variants?.length > 0 ? (
                          <button
                            onClick={() => {
                              setViewingVariants(p);
                              setIsVariantsViewModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition-all active:scale-95">
                            <span>{p.variants.length}</span>
                            <span className="text-[10px] uppercase">Variants</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400 italic">
                            Single
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {(() => {
                          const totalStock = p.variants?.length > 0
                            ? p.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
                            : p.stock;
                          return (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold border",
                                totalStock === 0
                                  ? "bg-rose-50 text-rose-600 border-rose-200"
                                  : totalStock <= 10
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200",
                              )}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", totalStock === 0 ? "bg-rose-500" : totalStock <= 10 ? "bg-amber-500" : "bg-emerald-500")} />
                              {totalStock === 0 ? "Out of Stock" : `${totalStock} in stock`}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => openEditModal(p)}
                            title="Edit Product"
                            className="p-1.5 hover:bg-slate-100 hover:text-[#E71D28] text-slate-600 rounded-lg transition-all border border-slate-200/70 shadow-xs">
                            <HiOutlinePencilSquare className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(p)}
                            title="Delete Product"
                            className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-lg transition-all border border-slate-200/70 shadow-xs">
                            <HiOutlineTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </BlurFade>

      {isFilterOpen && (
        <div
          ref={filterDropdownRef}
          className="absolute z-[9999] right-36 top-[350px] w-64 rounded-xl border border-slate-200 bg-white shadow-xl p-4 space-y-3"
        >
          <div>
            <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.18em] mb-1">
              Status
            </p>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-primary/10 outline-none bg-white"
            >
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.18em] mb-1">
                Min Price
              </p>
              <input
                type="number"
                min="0"
                value={priceMin}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || Number(val) >= 0) setPriceMin(val);
                }}
                placeholder="e.g. 100"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-primary/10 outline-none bg-white"
              />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-[0.18em] mb-1">
                Max Price
              </p>
              <input
                type="number"
                min="1"
                value={priceMax}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || Number(val) >= 1) setPriceMax(val);
                }}
                placeholder="e.g. 1000"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-primary/10 outline-none bg-white"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                setFilterCategory("all");
                setFilterStatus("All");
                setPriceMin("");
                setPriceMax("");
                setSearchTerm("");
                setSearchParams({});
              }}
              className="text-[11px] font-bold text-slate-600 hover:text-slate-700"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setIsFilterOpen(false)}
              className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={Math.ceil(total / pageSize) || 1}
          total={total}
          pageSize={pageSize}
          onPageChange={(p) => fetchProducts(p)}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
            fetchProducts(1);
          }}
          loading={isLoading}
        />
      </div>

      {/* Edit Modal (Copy from Admin) */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-12 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-md"
              onClick={() => setIsProductModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-5xl relative z-10 bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
                    <HiOutlineCube className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Edit Product
                    </h3>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <Badge
                        variant="primary"
                        className="text-[7px] font-bold uppercase tracking-widest px-1 bg-[#fde8ea] text-[#a2141c]">
                        SELLER
                      </Badge>
                      <HiOutlineChevronRight className="h-2.5 w-2.5 text-slate-300" />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                        {formData.sku || "PENDING SKU"}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
                  <HiOutlineXMark className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-col lg:flex-row flex-1 min-h-[400px] max-h-[calc(100vh-200px)] overflow-hidden">
                {/* Modal Sidebar Tabs */}
                <div className="lg:w-1/4 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1 overflow-y-auto">
                  {[
                    {
                      id: "general",
                      label: "General Info",
                      icon: HiOutlineTag,
                    },
                    {
                      id: "variants",
                      label: "Item Variants",
                      icon: HiOutlineSwatch,
                    },
                    {
                      id: "category",
                      label: "Groups",
                      icon: HiOutlineFolderOpen,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setModalTab(tab.id)}
                      className={cn(
                        "w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left",
                        modalTab === tab.id
                          ? "bg-white text-primary shadow-sm ring-1 ring-slate-100"
                          : "text-slate-600 hover:bg-slate-100",
                      )}>
                      <tab.icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  ))}

                  <div className="pt-8 px-4">
                    <div className="p-4 bg-[#fef4f4] rounded-2xl border border-[#fde8ea]">
                      <p className="text-[9px] font-bold text-[#E71D28] uppercase tracking-widest mb-1">
                        Status
                      </p>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                        className="w-full bg-transparent border-none text-xs font-bold text-[#a2141c] outline-none p-0 cursor-pointer focus:ring-0">
                        <option value="active">PUBLISHED</option>
                        <option value="inactive">DRAFT</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Modal Content Area */}
                <div className="flex-1 p-8 overflow-y-auto">
                  {modalTab === "general" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Product Title
                          </label>
                          <input
                            value={formData.name}
                            onChange={(e) =>
                              setFormData({ ...formData, name: e.target.value })
                            }
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
                            placeholder="e.g. Premium Basmati Rice"
                          />
                        </div>
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Web Address
                          </label>
                          <div className="flex items-center bg-slate-50 rounded-xl px-4 py-2.5">
                            <span className="text-[10px] text-slate-600 font-bold mr-1">
                              /product/
                            </span>
                            <input
                              value={formData.slug}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  slug: e.target.value,
                                })
                              }
                              className="flex-1 bg-transparent border-none text-sm text-slate-600 font-semibold outline-none"
                              placeholder="premium-basmati-rice"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          About this item
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              description: e.target.value,
                            })
                          }
                          onWheel={(e) => e.stopPropagation()}
                          onTouchMove={(e) => e.stopPropagation()}
                          className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[160px] max-h-[260px] outline-none resize-none overflow-y-auto custom-scrollbar"
                          placeholder="Describe the item here..."
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Brand Name
                          </label>
                          <input
                            value={formData.brand}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                brand: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-semibold outline-none ring-primary/5 focus:ring-2"
                            placeholder="e.g. Amul"
                          />
                        </div>
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Product Code
                          </label>
                          <input
                            value={formData.sku}
                            onChange={(e) =>
                              setFormData({ ...formData, sku: e.target.value })
                            }
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-mono font-bold outline-none ring-primary/5 focus:ring-2"
                            placeholder="AUTO-GENERATED"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Additional tabs populated as needed */}
                  {modalTab === "category" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Main Group <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={formData.header}
                            onChange={(e) =>
                              setFormData({ ...formData, header: e.target.value, category: "", subcategory: "" })
                            }
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer">
                            <option value="">Select Main Group</option>
                            {categories.map((h) => (
                              <option key={h._id || h.id} value={h._id || h.id}>
                                {h.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                            Specific Category <span className="text-rose-500">*</span>
                          </label>
                          <select
                            value={formData.category}
                            onChange={(e) =>
                              setFormData({ ...formData, category: e.target.value, subcategory: "" })
                            }
                            disabled={!formData.header}
                            className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50">
                            <option value="">Select Category</option>
                            {categories
                              .find((h) => (h._id || h.id) === formData.header)
                              ?.children?.map((c) => (
                                <option key={c._id || c.id} value={c._id || c.id}>
                                  {c.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                          Sub-Category <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={formData.subcategory}
                          onChange={(e) =>
                            setFormData({ ...formData, subcategory: e.target.value })
                          }
                          disabled={!formData.category}
                          className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none cursor-pointer disabled:opacity-50">
                          <option value="">Select Sub-Category</option>
                          {categories
                            .find((h) => (h._id || h.id) === formData.header)
                            ?.children?.find((c) => (c._id || c.id) === formData.category)
                            ?.children?.map((sc) => (
                              <option key={sc._id || sc.id} value={sc._id || sc.id}>
                                {sc.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {modalTab === "variants" && (
                    <VariantEditor
                      variants={formData.variants}
                      onChange={(variants) => setFormData({ ...formData, variants })}
                    />
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100">
                  CLOSE
                </button>
                <button
                  onClick={handleSave}
                  className="bg-[#E71D28] hover:bg-primary-hover active:bg-primary-dark text-white px-10 py-2.5 rounded-xl text-xs font-bold shadow-xl hover:-translate-y-0.5 transition-all">
                  SAVE CHANGES
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Deletion"
        size="sm"
        footer={
          <div className="flex gap-4 justify-end w-full">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-700 transition-colors">
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="px-6 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all active:scale-95">
              Delete product
            </button>
          </div>
        }>
        <div className="px-6 py-6 flex flex-col items-center text-center space-y-5">
          <div className="h-18 w-18 md:h-20 md:w-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
            <HiOutlineTrash className="h-9 w-9 md:h-10 md:w-10" />
          </div>
          <div className="space-y-2 max-w-md">
            <h4 className="text-lg font-semibold text-slate-900">
              Are you absolutely sure?
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              This action cannot be undone. This will permanently remove{" "}
              <span className="font-semibold text-slate-900">
                {itemToDelete?.name}
              </span>{" "}
              from the catalog.
            </p>
          </div>
        </div>
      </Modal>

      {/* Viewing Variants Modal */}
      <Modal
        isOpen={isVariantsViewModalOpen}
        onClose={() => setIsVariantsViewModalOpen(false)}
        title="Product Variants Details"
        size="xl"
      >
        <div className="py-2">
          <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="h-16 w-16 bg-white rounded-xl shadow-sm overflow-hidden flex items-center justify-center border border-slate-100 flex-shrink-0">
              {viewingVariants?.mainImage || viewingVariants?.galleryImages?.[0] || viewingVariants?.image ? (
                <img src={viewingVariants.mainImage || viewingVariants.galleryImages?.[0] || viewingVariants.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <HiOutlineCube className="h-8 w-8 text-slate-200" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 leading-tight">{viewingVariants?.name}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="primary" className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5">{viewingVariants?.categoryId?.name || 'Category'}</Badge>
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Master SKU: {viewingVariants?.sku || viewingVariants?._id?.slice(-6).toUpperCase() || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm bg-white">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-5 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap">Variant Specification</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center whitespace-nowrap">Cost Price</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center whitespace-nowrap">Selling Price</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center whitespace-nowrap">Available Stock</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center whitespace-nowrap">Stock Valuation</th>
                  <th className="px-5 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right whitespace-nowrap">Variant SKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {viewingVariants?.variants?.map((v, idx) => {
                  const vCost = Number(v.costPrice) > 0 ? Number(v.costPrice) : (Number(v.salePrice) > 0 ? Number(v.salePrice) : Number(v.price) || 0);
                  const vStock = Number(v.stock) || 0;
                  const vValuation = vStock * vCost;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/30 transition-all cursor-default">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-700 group-hover:text-primary transition-colors">{v.name}</span>
                          <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest mt-0.5">Variation {idx + 1}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <span className="text-xs font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/60">
                          ₹{v.costPrice != null && v.costPrice !== "" ? v.costPrice : 0}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center">
                          <span className={cn("text-xs font-bold", v.salePrice > 0 ? "text-slate-600 line-through scale-90" : "text-slate-900")}>₹{v.price}</span>
                          {v.salePrice > 0 && <span className="text-xs font-bold text-emerald-600">₹{v.salePrice}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <Badge variant={v.stock === 0 ? "rose" : v.stock <= 10 ? "amber" : "emerald"} className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 shadow-sm">
                          {v.stock === 0 ? 'OUT OF STOCK' : `${v.stock} UNITS`}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-black text-slate-900">₹{vValuation.toLocaleString('en-IN')}</span>
                          <span className="text-[9px] text-slate-400 font-semibold">{vStock} × ₹{vCost}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <span className="text-[10px] font-bold text-slate-600 font-mono tracking-tighter uppercase bg-slate-100 px-2.5 py-1 rounded-lg">
                          {v.sku || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-end">
            <button
              onClick={() => setIsVariantsViewModalOpen(false)}
              className="bg-[#E71D28] hover:bg-primary-hover active:bg-primary-dark text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
            >
              CLOSE VIEWER
            </button>
          </div>
        </div>
      </Modal>
    </div >
  );
};

export default ProductManagement;
