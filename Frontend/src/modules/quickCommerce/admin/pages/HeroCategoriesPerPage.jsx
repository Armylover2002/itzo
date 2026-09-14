import React, { useEffect, useState } from "react";
import {
  HiOutlinePencilSquare,
  HiOutlinePhoto,
  HiOutlinePlus,
  HiOutlineXMark,
} from "react-icons/hi2";
import { adminApi } from "../services/adminApi";
import Card from "@shared/components/ui/Card";
import Modal from "@shared/components/ui/Modal";
import { useToast } from "@shared/components/ui/Toast";
import { cn } from "@/lib/utils";

const emptyBannerItem = () => ({
  imageUrl: "",
  title: "",
  subtitle: "",
  linkType: "none",
  linkValue: "",
  isUploading: false,
});

export default function HeroCategoriesPerPage() {
  const { showToast } = useToast();
  const [headers, setHeaders] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [pageData, setPageData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [formBanners, setFormBanners] = useState([emptyBannerItem()]);
  const [formCategoryIds, setFormCategoryIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const treeRes = await adminApi.getCategoryTree();
        const tree = treeRes.data?.results || treeRes.data?.result || [];
        const headerList = Array.isArray(tree) ? tree : [];
        if (cancelled) return;
        setHeaders(headerList);

        const flatCategories = headerList.flatMap((h) => (h.children || []).map((c) => ({ ...c, headerName: h.name, headerId: h._id })));
        setAllCategories(flatCategories);

        const allRes = await adminApi.getHeroConfig({ fetchAll: true });
        const allConfigs = allRes.data?.results || [];

        const homeConfig = allConfigs.find(c => c.pageType === 'home') || {};
        const homeBanners = homeConfig.banners?.items || [];
        const homeCatIds = homeConfig.categoryIds || [];

        const rows = [
          {
            id: "home",
            label: "Home",
            pageType: "home",
            headerId: null,
            bannerCount: homeBanners.length,
            categoryCount: homeCatIds.length,
          },
        ];

        headerList.forEach((h) => {
          const config = allConfigs.find(c => c.pageType === 'header' && String(c.headerId) === String(h._id)) || {};
          const items = config.banners?.items || [];
          const catIds = config.categoryIds || [];
          rows.push({
            id: h._id,
            label: h.name || "Unnamed",
            pageType: "header",
            headerId: h._id,
            bannerCount: items.length,
            categoryCount: catIds.length,
          });
        });

        if (!cancelled) setPageData(rows);
      } catch (e) {
        if (!cancelled) console.error(e);
        showToast("Failed to load hero config", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [showToast]);

  const openEdit = async (row) => {
    setEditingRow(row);
    setFormCategoryIds([]);
    setFormBanners([emptyBannerItem()]);
    try {
      const res = await adminApi.getHeroConfig({
        pageType: row.pageType,
        headerId: row.headerId || undefined,
      });
      const result = res.data?.result || res.data || {};
      const items = result.banners?.items || [];
      const catIds = result.categoryIds || [];
      setFormBanners(
        items.length
          ? items.map((b) => ({ ...b, isUploading: false }))
          : [emptyBannerItem()]
      );
      setFormCategoryIds(Array.isArray(catIds) ? catIds : []);
    } catch (e) {
      console.error(e);
    }
    setModalOpen(true);
  };

  const updateBannerItem = (idx, changes) => {
    setFormBanners((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...changes };
      return next;
    });
  };

  const addBannerItem = () => {
    setFormBanners((prev) => [...prev, emptyBannerItem()]);
  };

  const removeBannerItem = (idx) => {
    setFormBanners((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleBannerFileChange = async (idx, file) => {
    if (!file) return;
    updateBannerItem(idx, { isUploading: true });
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await adminApi.uploadExperienceBanner(fd);
      const url = res.data?.result?.url || res.data?.url;
      if (!url) throw new Error("Upload failed");
      updateBannerItem(idx, { imageUrl: url, isUploading: false });
      showToast("Banner image uploaded", "success");
    } catch (e) {
      console.error(e);
      updateBannerItem(idx, { isUploading: false });
      showToast("Failed to upload banner image", "error");
    }
  };

  const toggleCategory = (catId) => {
    setFormCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleSave = async () => {
    const items = formBanners.filter((b) => b.imageUrl).map((b) => ({
      imageUrl: b.imageUrl,
      title: b.title || "",
      subtitle: b.subtitle || "",
      linkType: b.linkType || "none",
      linkValue: b.linkValue || "",
      status: b.status || "active",
    }));

    if (!editingRow) return;
    setSaving(true);
    try {
      await adminApi.setHeroConfig({
        pageType: editingRow.pageType,
        headerId: editingRow.headerId || undefined,
        banners: { items },
        categoryIds: formCategoryIds,
      });
      showToast("Hero config saved", "success");
      setPageData((prev) =>
        prev.map((p) =>
          p.id === editingRow.id
            ? {
                ...p,
                bannerCount: items.length,
                categoryCount: formCategoryIds.length,
              }
            : p
        )
      );
      setModalOpen(false);
      setEditingRow(null);
    } catch (e) {
      console.error(e);
      showToast(e.response?.data?.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
          Hero & categories per page
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure the <strong>separate</strong> hero banners and categories strip at the top of each page.
          If a header page has no config, the storefront shows the home page hero and categories.
          Content Manager sections are for the main content area only.
        </p>
      </div>

      <Card className="p-4 md:p-6 border border-slate-100 bg-white rounded-xl shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-slate-400 font-bold">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Page
                  </th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Hero (top banners)
                  </th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Categories below hero
                  </th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-slate-50 last:border-0",
                      "hover:bg-slate-50/50 transition-colors"
                    )}
                  >
                    <td className="py-4 pr-4">
                      <span className="font-bold text-slate-800">{row.label}</span>
                    </td>
                    <td className="py-4 pr-4">
                      {row.bannerCount > 0 ? (
                        <span className="text-xs font-semibold text-slate-600">
                          {row.bannerCount} banner(s)
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      {row.categoryCount > 0 ? (
                        <span className="text-xs font-semibold text-slate-600">
                          {row.categoryCount} categor
                          {row.categoryCount === 1 ? "y" : "ies"}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not set</span>
                      )}
                    </td>
                    <td className="py-4">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0c831f] hover:underline"
                      >
                        <HiOutlinePencilSquare className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-xs text-slate-400">
        This is a <strong>separate</strong> hero section. Experience sections in Content Manager
        are unchanged and used for the main content area below.
      </p>

      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title={editingRow ? `Edit hero & categories — ${editingRow.label}` : "Edit"}
        size="xl"
        footer={
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-[#0c831f] text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        {editingRow && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Hero banners
                </label>
                <button
                  type="button"
                  onClick={addBannerItem}
                  className="flex items-center gap-1 text-[10px] font-bold text-[#0c831f]"
                >
                  <HiOutlinePlus className="h-3 w-3" />
                  Add banner
                </button>
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {formBanners.map((item, idx) => (
                  <Card key={idx} className="p-3 bg-white border-slate-100">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.title || `Banner ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <HiOutlinePhoto className="h-6 w-6 text-slate-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              id={`hero-banner-file-${idx}`}
                              onChange={(e) => handleBannerFileChange(idx, e.target.files?.[0])}
                            />
                            <label
                              htmlFor={`hero-banner-file-${idx}`}
                              className="inline-block px-2 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600 cursor-pointer hover:bg-slate-200"
                            >
                              {item.isUploading ? "Uploading…" : item.imageUrl ? "Change" : "Upload"}
                            </label>
                            <input
                              value={item.title || ""}
                              onChange={(e) => updateBannerItem(idx, { title: e.target.value })}
                              className="w-full p-2 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none"
                              placeholder="Title (optional)"
                            />
                            <input
                              value={item.subtitle || ""}
                              onChange={(e) => updateBannerItem(idx, { subtitle: e.target.value })}
                              className="w-full p-2 bg-slate-50 rounded-xl text-xs font-bold border-none outline-none"
                              placeholder="Subtitle (optional)"
                            />
                          </div>
                        </div>
                      </div>
                      {formBanners.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBannerItem(idx)}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <HiOutlineXMark className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Categories below hero
              </label>
              <div className="flex flex-wrap gap-2">
                {allCategories
                  .filter((c) => !editingRow?.headerId || c.headerId === editingRow.headerId)
                  .map((c) => {
                  const isSelected = formCategoryIds.includes(c._id);
                  return (
                    <button
                      key={c._id}
                      type="button"
                      onClick={() => toggleCategory(c._id)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all",
                        isSelected
                          ? "bg-[#0c831f] text-white border-[#0c831f]"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-white"
                      )}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
              {allCategories.length === 0 && (
                <p className="text-xs text-slate-400">No main categories found. Add categories in Header / Main Categories first.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
