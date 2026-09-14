import React, { useEffect, useMemo, useState } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Modal from "@shared/components/ui/Modal";
import { useToast } from "@shared/components/ui/Toast";
import {
  HiOutlinePlus,
  HiOutlinePhoto,
  HiOutlineTrash,
  HiOutlinePencilSquare,
} from "react-icons/hi2";
import { cn } from "@/lib/utils";
import { adminApi } from "../services/adminApi";
import {
  BACKGROUND_COLOR_OPTIONS,
  SIDE_IMAGE_OPTIONS,
} from "@/shared/constants/offerSectionOptions";

// Uses the same backend collection as offer sections,
// but presents it as a dedicated "Shop by Store" manager.

const ShopByStoreManagement = () => {
  const { showToast } = useToast();
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [productsFiltered, setProductsFiltered] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    backgroundColor: "#FCD34D",
    sideImageKey: "grocery",
    categoryIds: [],
    productIds: [],
    order: 0,
    status: "active",
  });

  const loadCategories = async () => {
    try {
      const res = await adminApi.getCategories();
      const list = res.data.results || res.data.result || [];
      const cats = (Array.isArray(list) ? list : []).filter(
        (c) => c.type === "category"
      );
      setCategories(cats);
    } catch (e) {
      console.error(e);
      showToast("Failed to load categories", "error");
    }
  };

  const loadProductsByCategory = async (categoryIds) => {
    const hasCategories = Array.isArray(categoryIds) && categoryIds.length > 0;
    if (!hasCategories) {
      setProductsFiltered([]);
      return;
    }
    try {
      const params = { limit: 200, categoryIds: categoryIds.join(",") };
      const res = await adminApi.getProducts(params);
      const raw = res.data.result;
      const list = Array.isArray(res.data.results)
        ? res.data.results
        : Array.isArray(raw?.items)
        ? raw.items
        : Array.isArray(raw)
        ? raw
        : [];
      setProductsFiltered(list);
    } catch (e) {
      console.error(e);
      setProductsFiltered([]);
      showToast("Failed to load products", "error");
    }
  };

  const loadStores = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getOfferSections();
      const list = res.data.results || res.data.result || res.data;
      setStores(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      showToast("Failed to load stores", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    loadStores();
  }, []);

  useEffect(() => {
    loadProductsByCategory(formData.categoryIds);
  }, [formData.categoryIds]);

  const categoryMap = useMemo(() => {
    const m = {};
    categories.forEach((c) => (m[c._id] = c));
    return m;
  }, [categories]);

  const resetForm = () => {
    setFormData({
      title: "",
      backgroundColor: "#FCD34D",
      sideImageKey: "grocery",
      categoryIds: [],
      productIds: [],
      order: stores.length,
      status: "active",
    });
    setEditingStore(null);
  };

  const openCreateModal = () => {
    resetForm();
    setProductsFiltered([]);
    setIsModalOpen(true);
  };

  const openEditModal = (store) => {
    setEditingStore(store);
    const catIds = (store.categoryIds || [])
      .map((c) => (typeof c === "object" && c?._id ? c._id : c))
      .filter(Boolean);
    setFormData({
      title: store.title || "",
      backgroundColor: store.backgroundColor || "#FCD34D",
      sideImageKey: store.sideImageKey || "grocery",
      categoryIds: catIds,
      productIds: store.productIds || [],
      order: store.order ?? 0,
      status: store.status || "active",
    });
    loadProductsByCategory(catIds);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast("Store name is required", "warning");
      return;
    }
    if (!formData.categoryIds?.length) {
      showToast("Please select at least one category", "warning");
      return;
    }
    const payload = {
      title: formData.title.trim(),
      backgroundColor: formData.backgroundColor,
      sideImageKey: formData.sideImageKey,
      categoryIds: formData.categoryIds,
      productIds: formData.productIds,
      order: Number(formData.order) || 0,
      status: formData.status,
    };
    try {
      if (editingStore) {
        const res = await adminApi.updateOfferSection(editingStore._id, payload);
        const updated = res.data.result || res.data.results || res.data;
        setStores((prev) =>
          prev.map((s) => (s._id === editingStore._id ? updated : s))
        );
        showToast("Store updated", "success");
      } else {
        const res = await adminApi.createOfferSection(payload);
        const created = res.data.result || res.data.results || res.data;
        setStores((prev) => [...prev, created]);
        showToast("Store created", "success");
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast(
        err.response?.data?.message || "Failed to save store",
        "error"
      );
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this store?")) return;
    try {
      await adminApi.deleteOfferSection(id);
      setStores((prev) => prev.filter((s) => s._id !== id));
      showToast("Store deleted", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to delete store", "error");
    }
  };

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1 mb-6">
        <div>
          <h1 className="ds-h1 flex items-center gap-3">
            Shop by Store
            <Badge
              variant="primary"
              className="text-[10px] font-black uppercase tracking-widest"
            >
              Curated Storefronts
            </Badge>
          </h1>
          <p className="ds-description mt-1">
            Create themed stores like &quot;Summer Coolers&quot; or
            &quot;Breakfast Essentials&quot;. Pick categories and hero
            products, choose banner colour and imagery – these power the
            customer &quot;Shop by Store&quot; page.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-6 py-3.5 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
        >
          <HiOutlinePlus className="h-5 w-5" />
          New Store
        </button>
      </div>

      <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Stores ({stores.length})
          </h2>
          {isLoading && (
            <span className="text-[10px] font-bold text-slate-400">
              Loading...
            </span>
          )}
        </div>
        <div className="divide-y divide-slate-50">
          {stores.map((store, idx) => {
            const sideOpt = SIDE_IMAGE_OPTIONS.find(
              (o) => o.key === store.sideImageKey
            );
            const catNames = (store.categoryIds || []).length
              ? (store.categoryIds || [])
                  .map((c) =>
                    typeof c === "object" && c?.name
                      ? c.name
                      : categoryMap[c]?.name || c
                  )
                  .join(", ")
              : "—";
            const productCount = (store.productIds || []).length;
            return (
              <div
                key={store._id}
                className="px-4 py-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50/40 transition-colors"
              >
                <div className="flex items-center gap-3 md:min-w-[200px]">
                  <div
                    className="h-14 w-14 rounded-2xl flex-shrink-0 bg-cover bg-center ring-2 ring-slate-100"
                    style={{
                      backgroundColor: store.backgroundColor || "#FCD34D",
                      backgroundImage: sideOpt?.imageUrl
                        ? `url(${sideOpt.imageUrl})`
                        : undefined,
                    }}
                  />
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {idx + 1}. {store.title}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500">
                      Categories: {catNames} · {productCount} product(s)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => openEditModal(store)}
                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl"
                  >
                    <HiOutlinePencilSquare className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(store._id)}
                    className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl"
                  >
                    <HiOutlineTrash className="h-5 w-5" />
                  </button>
                </div>
              </div>
            );
          })}
          {stores.length === 0 && !isLoading && (
            <div className="p-16 text-center">
              <HiOutlinePhoto className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <h3 className="text-lg font-black text-slate-900">
                No stores created yet
              </h3>
              <p className="text-sm font-bold text-slate-400 mt-2">
                Click &quot;New Store&quot; to design your first curated
                storefront.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStore ? "Edit Store" : "New Store"}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Store name
            </label>
            <input
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder='E.g. "Summer Coolers"'
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none ring-1 ring-transparent focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Categories inside this store
            </label>
            <div className="flex flex-wrap gap-1.5 border border-slate-100 rounded-xl p-3 bg-slate-50/50 max-h-32 overflow-y-auto">
              {categories.map((c) => {
                const selected = formData.categoryIds.includes(c._id);
                return (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        categoryIds: selected
                          ? prev.categoryIds.filter((id) => id !== c._id)
                          : [...prev.categoryIds, c._id],
                        productIds: [],
                      }))
                    }
                    className={cn(
                      "px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-all",
                      selected
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {formData.categoryIds.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Featured products (optional)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                {productsFiltered.length === 0 ? (
                  <span className="text-[11px] text-slate-400">
                    No products match. Add categories first.
                  </span>
                ) : (
                  productsFiltered.map((p) => {
                    const selected = formData.productIds.includes(p._id);
                    return (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            productIds: selected
                              ? prev.productIds.filter((id) => id !== p._id)
                              : [...prev.productIds, p._id],
                          }))
                        }
                        className={cn(
                          "px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-all",
                          selected
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {p.name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Banner colour
            </label>
            <div className="flex flex-wrap gap-2">
              {BACKGROUND_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      backgroundColor: opt.value,
                    }))
                  }
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-2xl text-[11px] font-bold border-2 transition-all",
                    formData.backgroundColor === opt.value
                      ? "border-slate-900 ring-2 ring-offset-2 ring-slate-400"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                  title={opt.label}
                >
                  <span
                    className="w-5 h-5 rounded-full border border-slate-200"
                    style={{ backgroundColor: opt.value }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Hero image
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SIDE_IMAGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      sideImageKey: opt.key,
                    }))
                  }
                  className={cn(
                    "rounded-xl overflow-hidden border-2 transition-all aspect-square bg-slate-100",
                    formData.sideImageKey === opt.key
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <img
                    src={opt.imageUrl}
                    alt={opt.label}
                    className="w-full h-full object-cover"
                  />
                  <span className="block text-[10px] font-bold text-slate-600 p-1 truncate">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Display order
              </label>
              <input
                type="number"
                min={0}
                value={formData.order}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, order: e.target.value }))
                }
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, status: e.target.value }))
                }
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20"
            >
              {editingStore ? "Save changes" : "Create store"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ShopByStoreManagement;

