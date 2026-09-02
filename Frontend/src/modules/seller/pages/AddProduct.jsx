import React, { useState, useMemo } from "react";
import Button from "@shared/components/ui/Button";
import Badge from "@shared/components/ui/Badge";
import {
  HiOutlineArrowLeft,
  HiOutlineCube,
  HiOutlineTag,
  HiOutlineCurrencyDollar,
  HiOutlineSwatch,
  HiOutlineFolderOpen,
  HiOutlinePhoto,
  HiOutlineScale,
  HiOutlineArrowPath,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineSquaresPlus,
  HiOutlineCurrencyRupee,
} from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { sellerApi } from "../services/sellerApi";


const AddProduct = () => {
  const navigate = useNavigate();
  const [modalTab, setModalTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);
  const mainImageInputRef = React.useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    sku: "",
    description: "",
    price: "",
    salePrice: "",
    stock: "",
    lowStockAlert: 5,
    category: "",
    subcategory: "",
    header: "",
    status: "active",
    tags: "",
    weight: "",
    brand: "",
    mainImage: null,
    galleryImages: [],
    variants: [
      {
        id: Date.now(),
        name: "Default",
        price: "",
        salePrice: "",
        stock: "",
        sku: "",
      },
    ],
  });

  const [dbCategories, setDbCategories] = useState([]);
  const [isLoadingCats, setIsLoadingCats] = useState(true);

  React.useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await sellerApi.getCategoryTree();
        if (res.data.success) {
          setDbCategories(res.data.results || res.data.result || []);
        }
      } catch (error) {
        toast.error("Failed to load categories");
      } finally {
        setIsLoadingCats(false);
      }
    };
    fetchCats();
  }, []);

  const categories = dbCategories;

  const handleSave = async () => {
    // Validate required fields
    if (!formData.name) {
      toast.error("Please fill in the Product Title");
      return;
    }

    // Validate all three category levels are selected
    if (!formData.header || !formData.category || !formData.subcategory) {
      toast.error("Please select all three category levels: Main Group, Specific Category, and Sub-Category");
      return;
    }

    const firstVariant = formData.variants[0] || {};
    const effectivePrice = firstVariant.price || formData.price;
    const effectiveStock = firstVariant.stock || formData.stock;

    if (!effectivePrice || !effectiveStock) {
      toast.error("Please fill in Price and Stock in the Pricing & Stock tab");
      return;
    }

    if (formData.salePrice && Number(formData.salePrice) < 1) {
      toast.error("Discounted price must be at least 1");
      return;
    }

    if (formData.stock && Number(formData.stock) < 1) {
      toast.error("Stock must be at least 1");
      return;
    }

    if (formData.variants.some((v) => v.salePrice && Number(v.salePrice) < 1)) {
      toast.error("Sale price must be at least 1");
      return;
    }

    if (formData.variants.some((v) => v.stock && Number(v.stock) < 1)) {
      toast.error("Stock must be at least 1");
      return;
    }

    setIsSaving(true);
    try {
      const data = new FormData();

      // Basic fields
      data.append("name", formData.name);
      data.append("slug", formData.slug);
      data.append("sku", formData.sku);
      data.append("description", formData.description);
      data.append("brand", formData.brand);
      data.append("weight", formData.weight);
      data.append("status", formData.status);

      // Map top-level price/stock — prefer pricing tab values, fallback to first variant
      data.append("price", formData.price || firstVariant.price);
      data.append("salePrice", formData.salePrice || firstVariant.salePrice || 0);
      data.append("stock", formData.stock || firstVariant.stock);
      data.append("lowStockAlert", formData.lowStockAlert || 5);

      // Category IDs
      data.append("headerId", formData.header);
      data.append("categoryId", formData.category);
      data.append("subcategoryId", formData.subcategory);

      // Tags
      data.append("tags", formData.tags);

      // Images
      if (formData.mainImageFile) {
        data.append("mainImage", formData.mainImageFile);
      }

      if (formData.galleryFiles && formData.galleryFiles.length > 0) {
        formData.galleryFiles.forEach(file => {
          data.append("galleryImages", file);
        });
      }

      // Variants
      data.append("variants", JSON.stringify(formData.variants));

      await sellerApi.createProduct(data);
      toast.success("Product saved successfully!");
      navigate("/seller/products");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save product");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e, type) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === "main") {
          setFormData({
            ...formData,
            mainImage: reader.result,
            mainImageFile: file
          });
        } else {
          setFormData({
            ...formData,
            galleryImages: [...formData.galleryImages, reader.result],
            galleryFiles: [...(formData.galleryFiles || []), file]
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <Button
          variant="ghost"
          className="pl-0 hover:bg-transparent hover:text-primary-600"
          onClick={() => navigate(-1)}>
          <HiOutlineArrowLeft className="mr-2 h-5 w-5" />
          Back to Products
        </Button>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="min-w-[140px] bg-[#E71D28] hover:bg-primary-hover active:bg-primary-dark text-white transition-colors">
            {isSaving ? (
              <>
                <HiOutlineArrowPath className="mr-2 h-5 w-5 animate-spin" />
                Publishing...
              </>
            ) : (
              "Save & Publish"
            )}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[600px] border border-slate-100">
        {/* Sidebar Tabs */}
        <div className="md:w-64 bg-slate-50/50 border-r border-slate-100 p-4 space-y-1 overflow-y-auto">
          {[
            { id: "general", label: "General Info", icon: HiOutlineTag },
            { id: "pricing", label: "Pricing & Stock", icon: HiOutlineCurrencyRupee },
            { id: "variants", label: "Item Variants", icon: HiOutlineSwatch },
            { id: "category", label: "Groups", icon: HiOutlineFolderOpen },
            { id: "media", label: "Photos", icon: HiOutlinePhoto },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setModalTab(tab.id)}
              className={cn(
                "w-full flex items-center space-x-3 px-4 py-3 rounded-md text-xs font-bold transition-all text-left",
                modalTab === tab.id
                  ? "bg-white text-[#E71D28] shadow-sm ring-1 ring-slate-100"
                  : "text-slate-600 hover:bg-slate-100",
              )}>
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}

          <div className="pt-8 px-4">
            <div className="p-4 bg-emerald-50 rounded-md border border-emerald-100">
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">
                Status
              </p>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="w-full bg-transparent border-none text-xs font-bold text-emerald-700 outline-none p-0 cursor-pointer focus:ring-0">
                <option value="active">PUBLISHED</option>
                <option value="inactive">DRAFT</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {modalTab === "general" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Product Title
                </label>
                <input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                  placeholder="e.g. Premium Basmati Rice"
                />
              </div>
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  About this item
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-sm font-semibold min-h-[160px] max-h-[260px] outline-none transition-all focus:ring-2 focus:ring-primary/5 resize-none overflow-y-auto custom-scrollbar"
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
                      setFormData({ ...formData, brand: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-semibold outline-none ring-primary/5 focus:ring-2 transition-all"
                    placeholder="e.g. Amul"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Product Code
                  </label>
                  <input
                    value={formData.sku}
                    readOnly
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-mono font-bold outline-none text-slate-400 cursor-not-allowed"
                    placeholder="AUTO-GENERATED"
                  />
                </div>
              </div>
            </div>
          )}

          {modalTab === "pricing" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="e.g. 500"
                    className="w-full px-4 py-3 bg-white shadow-sm ring-1 ring-slate-200 border-none rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-primary/10"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest ml-1">
                    Discounted Price (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
                    placeholder="e.g. 450"
                    className="w-full px-4 py-3 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-100 border-none rounded-xl text-lg font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] sm:text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                    How many in stock
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    placeholder="e.g. 10"
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold outline-none ring-primary/5 focus:ring-2"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[9px] font-bold text-rose-500 uppercase tracking-widest ml-1">
                    Alert me when stock is below
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.lowStockAlert}
                    onChange={(e) => setFormData({ ...formData, lowStockAlert: e.target.value })}
                    className="w-full px-4 py-2.5 bg-rose-50/30 border-none rounded-xl text-sm font-bold text-rose-600 outline-none ring-rose-100 focus:ring-2"
                  />
                </div>
              </div>
            </div>
          )}

          {modalTab === "variants" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Product Variants
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">
                    Add different sizes, colors or weights.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setFormData({
                      ...formData,
                      variants: [
                        ...formData.variants,
                        {
                          id: Date.now(),
                          name: "",
                          price: "",
                          salePrice: "",
                          stock: "",
                          sku: "",
                        },
                      ],
                    })
                  }
                  className="flex items-center space-x-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-bold hover:bg-primary/20 transition-all">
                  <HiOutlineSquaresPlus className="h-4 w-4" />
                  <span>ADD VARIANT</span>
                </button>
              </div>

              <div className="space-y-3">
                {(formData.variants || []).map((variant, index) => (
                  <div
                    key={variant.id}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-end group relative">
                    <div className="col-span-12 md:col-span-3 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Variant Name
                      </label>
                      <input
                        value={variant.name}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].name = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="e.g. 1kg Bag"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Price
                      </label>
                      <input
                        type="number"
                        value={variant.price}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].price = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="500"
                        className="w-full px-3 py-2 bg-white ring-1 ring-slate-200 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1">
                      <label className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest ml-1">
                        Sale
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={variant.salePrice}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].salePrice = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="450"
                        className={`w-full px-3 py-2 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 ${variant.salePrice && Number(variant.salePrice) < 1 ? "bg-red-50 ring-1 ring-red-300 text-red-600 focus:ring-red-300" : "bg-emerald-50 ring-1 ring-emerald-100 text-emerald-700 focus:ring-emerald-200"}`}
                      />
                      {variant.salePrice && Number(variant.salePrice) < 1 && (
                        <p className="text-[9px] font-semibold text-red-500 ml-1">Min value is 1</p>
                      )}
                    </div>
                    <div className="col-span-6 md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Stock
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={variant.stock}
                        onChange={(e) => {
                          const newVariants = [...formData.variants];
                          newVariants[index].stock = e.target.value;
                          setFormData({ ...formData, variants: newVariants });
                        }}
                        placeholder="10"
                        className={`w-full px-3 py-2 border-none rounded-xl text-xs font-bold outline-none focus:ring-2 ${variant.stock && Number(variant.stock) < 1 ? "bg-red-50 ring-1 ring-red-300 text-red-600 focus:ring-red-300" : "bg-white ring-1 ring-slate-200 focus:ring-primary/10"}`}
                      />
                      {variant.stock && Number(variant.stock) < 1 && (
                        <p className="text-[9px] font-semibold text-red-500 ml-1">Min value is 1</p>
                      )}
                    </div>
                    <div className="col-span-5 md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                        Product Code
                      </label>
                      <input
                        value={variant.sku}
                        readOnly
                        placeholder="AUTO-GENERATED"
                        className="w-full px-3 py-2 bg-slate-100 ring-1 ring-slate-200 border-none rounded-xl text-xs font-mono font-bold text-slate-400 cursor-not-allowed outline-none"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end pb-1">
                      <button
                        onClick={() => {
                          if (formData.variants.length > 1) {
                            const newVariants = formData.variants.filter(
                              (_, i) => i !== index,
                            );
                            setFormData({ ...formData, variants: newVariants });
                          }
                        }}
                        className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                        <HiOutlineTrash className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all">
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
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
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
              <div className="grid grid-cols-1 gap-6">
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
                    className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-md text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
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
            </div>
          )}

          {modalTab === "media" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
              {/* Main Image Section */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Main Cover Photo
                </label>
                <div className="flex flex-col md:flex-row items-start gap-6">
                  <div className="w-48 aspect-square rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer overflow-hidden relative">
                    <input
                      ref={mainImageInputRef}
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={(e) => handleImageUpload(e, "main")}
                    />
                    {formData.mainImage ? (
                      <img
                        src={formData.mainImage}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <>
                        <HiOutlinePhoto className="h-10 w-10 text-slate-200 group-hover:text-primary transition-colors" />
                        <p className="text-[9px] font-bold text-slate-600 mt-2 uppercase tracking-widest group-hover:text-primary">
                          Upload Cover
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex-1 space-y-2 pt-2">
                    <p className="text-xs font-bold text-slate-900">
                      Choose a primary image
                    </p>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      We show this image on the search page and the main
                      store listing. Make sure it is clear and bright.
                    </p>
                    <button
                      type="button"
                      onClick={() => mainImageInputRef.current?.click()}
                      className="text-[10px] font-black text-primary uppercase tracking-wider hover:underline">
                      Pick from Library
                    </button>
                  </div>
                </div>
              </div>

              {/* Gallery Section */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-widest ml-1">
                  Gallery Photos (Max 5)
                </label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-md border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group hover:border-primary hover:bg-primary/5 transition-all cursor-pointer relative overflow-hidden">
                      {formData.galleryImages[i - 1] ? (
                        <img
                          src={formData.galleryImages[i - 1]}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          <input
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            onChange={(e) => handleImageUpload(e, "gallery")}
                          />
                          <HiOutlinePlus className="h-5 w-5 text-slate-200 group-hover:text-primary transition-colors" />
                          <p className="text-[8px] font-bold text-slate-600 mt-1 uppercase tracking-widest group-hover:text-primary">
                            Add
                          </p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-slate-600 font-medium italic text-center pt-4 border-t border-slate-50">
                Quick Tip: Using WebP format at 800x800px makes your store load
                3x faster.
              </p>
            </div>
          )}

          
        </div>
      </div>
    </div>
  );
};

export default AddProduct;
