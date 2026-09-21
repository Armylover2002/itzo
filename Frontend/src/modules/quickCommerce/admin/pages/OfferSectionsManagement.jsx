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
  HiOutlineArrowUpCircle,
  HiOutlineArrowDownCircle,
} from "react-icons/hi2";
import { cn } from "@/lib/utils";
import { adminApi } from "../services/adminApi";
import {
  BACKGROUND_COLOR_OPTIONS,
  SIDE_IMAGE_OPTIONS,
} from "@/shared/constants/offerSectionOptions";
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions";

const OfferSectionsManagement = () => {
  const { showToast } = useToast();
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

  const permissionKey = "quick::core_management::marketing_tools::offer_sections";
  const canCreate = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "create");
  const canEdit = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "edit");
  const canDelete = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "delete");
  const [sections, setSections] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [productsFiltered, setProductsFiltered] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    backgroundColor: "#FCD34D",
    sideImageKey: "hair-care",
    categoryIds: [],
    sellerIds: [],
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

  const loadSellers = async () => {
    try {
      const res = await adminApi.getSellers();
      const list = res.data.results || res.data.result || res.data;
      setSellers(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      showToast("Failed to load sellers", "error");
    }
  };

  const loadProductsByCategoryAndSellers = async (categoryIds, sellerIds) => {
    const hasCategories = Array.isArray(categoryIds) && categoryIds.length > 0;
    const hasSellers = Array.isArray(sellerIds) && sellerIds.length > 0;
    if (!hasCategories && !hasSellers) {
      setProductsFiltered([]);
      return;
    }
    try {
      const params = { limit: 200 };
      if (hasCategories) params.categoryIds = categoryIds.join(",");
      if (hasSellers) params.sellerIds = sellerIds.join(",");
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

  const loadSections = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getOfferSections();
      const list = res.data.results || res.data.result || res.data;
      setSections(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      showToast("Failed to load offer sections", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    loadSellers();
    loadSections();
  }, []);

  useEffect(() => {
    loadProductsByCategoryAndSellers(formData.categoryIds, formData.sellerIds);
  }, [formData.categoryIds, formData.sellerIds]);

  const categoryMap = useMemo(() => {
    const m = {};
    categories.forEach((c) => (m[c._id] = c));
    return m;
  }, [categories]);
  const sellerMap = useMemo(() => {
    const m = {};
    sellers.forEach((s) => (m[s._id] = s));
    return m;
  }, [sellers]);

  const resetForm = () => {
    setFormData({
      title: "",
      backgroundColor: "#FCD34D",
      sideImageKey: "hair-care",
      categoryIds: [],
      sellerIds: [],
      productIds: [],
      order: sections.length,
      status: "active",
    });
    setEditingSection(null);
  };

  const openCreateModal = () => {
    resetForm();
    setProductsFiltered([]);
    setIsModalOpen(true);
  };

  const openEditModal = (section) => {
    setEditingSection(section);
    const catIds = (section.categoryIds || []).map((c) => (typeof c === "object" && c?._id ? c._id : c)).filter(Boolean);
    if (!catIds.length && (section.categoryId?._id || section.categoryId)) {
      catIds.push(section.categoryId?._id || section.categoryId);
    }
    const selIds = (section.sellerIds || []).map((s) => (typeof s === "object" && s?._id ? s._id : s)).filter(Boolean);
    setFormData({
      title: section.title || "",
      backgroundColor: section.backgroundColor || "#FCD34D",
      sideImageKey: section.sideImageKey || "hair-care",
      categoryIds: catIds,
      sellerIds: selIds,
      productIds: section.productIds || [],
      order: section.order ?? 0,
      status: section.status || "active",
    });
    loadProductsByCategoryAndSellers(catIds, selIds);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast("Section title is required", "warning");
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
      sellerIds: formData.sellerIds || [],
      productIds: formData.productIds,
      order: Number(formData.order) || 0,
      status: formData.status,
    };
    try {
      if (editingSection) {
        const res = await adminApi.updateOfferSection(editingSection._id, payload);
        const updated = res.data.result || res.data.results || res.data;
        setSections((prev) =>
          prev.map((s) => (s._id === editingSection._id ? updated : s))
        );
        showToast("Section updated", "success");
      } else {
        const res = await adminApi.createOfferSection(payload);
        const created = res.data.result || res.data.results || res.data;
        setSections((prev) => [...prev, created]);
        showToast("Section created", "success");
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast(
        err.response?.data?.message || "Failed to save section",
        "error"
      );
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this offer section?")) return;
    try {
      await adminApi.deleteOfferSection(id);
      setSections((prev) => prev.filter((s) => s._id !== id));
      showToast("Section deleted", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to delete section", "error");
    }
  };

  const handleReorder = async (direction, section) => {
    const idx = sections.findIndex((s) => s._id === section._id);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const copy = [...sections];
    const [removed] = copy.splice(idx, 1);
    copy.splice(newIdx, 0, removed);
    const items = copy.map((s, i) => ({ id: s._id, order: i }));
    try {
      await adminApi.reorderOfferSections(items);
      setSections(copy.map((s, i) => ({ ...s, order: i })));
    } catch (e) {
      console.error(e);
      showToast("Failed to reorder", "error");
    }
  };

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1 mb-6">
        <div>
          <h1 className="ds-h1 flex items-center gap-3">
            Offer Sections
            <Badge
              variant="primary"
              className="text-[10px] font-black uppercase tracking-widest"
            >
              Shop Aisles
            </Badge>
          </h1>
          <p className="ds-description mt-1">
            Product aisle carousels for Shop by Store. For Explore Collection–style home cards, use{" "}
            <a href="/ecs/quick-commerce/fast-fav" className="text-purple-600 font-bold underline">
              Fast Fav & More
            </a>
            .
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-6 py-3.5 bg-purple-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
          >
            <HiOutlinePlus className="h-5 w-5" />
            New Section
          </button>
        )}
      </div>

      <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Sections ({sections.length})
          </h2>
          {isLoading && (
            <span className="text-[10px] font-bold text-slate-400">
              Loading...
            </span>
          )}
        </div>
        <div className="divide-y divide-slate-50">
          {sections.map((section, idx) => {
            const sideOpt = SIDE_IMAGE_OPTIONS.find(
              (o) => o.key === section.sideImageKey
            );
            const sectionCatIds = (section.categoryIds || []).map((c) => (typeof c === "object" && c?._id ? c._id : c));
            const sectionSellerIds = (section.sellerIds || []).map((s) => (typeof s === "object" && s?._id ? s._id : s));
            const catNames = (section.categoryIds || []).length
              ? (section.categoryIds || []).map((c) => (typeof c === "object" && c?.name ? c.name : categoryMap[c]?.name || c)).join(", ")
              : (section.categoryId?.name || "—");
            const sellerNames = (section.sellerIds || []).length
              ? (section.sellerIds || []).map((s) => (typeof s === "object" && (s?.shopName || s?.name) ? (s.shopName || s.name) : (sellerMap[s]?.shopName || sellerMap[s]?.name || s))).join(", ")
              : "—";
            const productCount = (section.productIds || []).length;
            return (
              <div
                key={section._id}
                className="px-4 py-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50/40 transition-colors"
              >
                <div className="flex items-center gap-3 md:min-w-[200px]">
                  <div
                    className="h-14 w-14 rounded-2xl flex-shrink-0 bg-cover bg-center ring-2 ring-slate-100"
                    style={{
                      backgroundColor: section.backgroundColor || "#FCD34D",
                      backgroundImage: sideOpt?.imageUrl
                        ? `url(${sideOpt.imageUrl})`
                        : undefined,
                    }}
                  />
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      #{idx + 1} {section.title}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500">
                      {catNames} · Sellers: {sellerNames} · {productCount} product(s)
                    </p>
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <span
                    className="inline-block w-6 h-6 rounded-full border border-slate-200"
                    style={{
                      backgroundColor: section.backgroundColor || "#FCD34D",
                    }}
                    title={section.backgroundColor}
                  />
                  <span className="text-[10px] font-bold text-slate-500">
                    {section.sideImageKey || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleReorder("up", section)}
                        className={cn(
                          "p-1.5 rounded-xl border text-slate-400 hover:text-slate-700 hover:bg-slate-50",
                          idx === 0 && "opacity-30 cursor-not-allowed"
                        )}
                      >
                        <HiOutlineArrowUpCircle className="h-4 w-4" />
                      </button>
                      <button
                        disabled={idx === sections.length - 1}
                        onClick={() => handleReorder("down", section)}
                        className={cn(
                          "p-1.5 rounded-xl border text-slate-400 hover:text-slate-700 hover:bg-slate-50",
                          idx === sections.length - 1 &&
                            "opacity-30 cursor-not-allowed"
                        )}
                      >
                        <HiOutlineArrowDownCircle className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => openEditModal(section)}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl"
                    >
                      <HiOutlinePencilSquare className="h-5 w-5" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(section._id)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl"
                    >
                      <HiOutlineTrash className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {sections.length === 0 && !isLoading && (
            <div className="p-16 text-center">
              <HiOutlinePhoto className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <h3 className="text-lg font-black text-slate-900">
                No offer sections yet
              </h3>
              <p className="text-sm font-bold text-slate-400 mt-2">
                Click &quot;New Section&quot;: pick categories → sellers → products, then colour & side image.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSection ? "Edit Offer Section" : "New Offer Section"}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Section title
            </label>
            <input
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="E.g. Trending Tuesday!"
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none ring-1 ring-transparent focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Categories (choose one or more)
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

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Sellers (choose one or more – products will be from these sellers)
            </label>
            <div className="flex flex-wrap gap-1.5 border border-slate-100 rounded-xl p-3 bg-slate-50/50 max-h-32 overflow-y-auto">
              {sellers.map((s) => {
                const selected = formData.sellerIds.includes(s._id);
                return (
                  <button
                    key={s._id}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        sellerIds: selected
                          ? prev.sellerIds.filter((id) => id !== s._id)
                          : [...prev.sellerIds, s._id],
                        productIds: [],
                      }))
                    }
                    className={cn(
                      "px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition-all",
                      selected
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {s.shopName || s.name || s.email}
                  </button>
                );
              })}
            </div>
          </div>

          {(formData.categoryIds.length > 0 || formData.sellerIds.length > 0) && (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Products (from selected categories & sellers)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1 border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                {productsFiltered.length === 0 ? (
                  <span className="text-[11px] text-slate-400">
                    No products match. Add categories and/or sellers.
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
              Side image (choose one)
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
              {editingSection ? "Save changes" : "Create section"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default OfferSectionsManagement;
