import React, { useEffect, useMemo, useState } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Modal from "@shared/components/ui/Modal";
import { useToast } from "@shared/components/ui/Toast";
import {
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlinePencilSquare,
  HiOutlineArrowUpCircle,
  HiOutlineArrowDownCircle,
  HiOutlinePhoto,
} from "react-icons/hi2";
import { cn } from "@/lib/utils";
import { adminApi } from "../services/adminApi";
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import {
  canPerformAdminPermissionAction,
  extractAdminPermissions,
  extractAdminRoleId,
  fetchAdminRolePermissions,
} from "@food/utils/adminPermissions";

const EMPTY_FORM = {
  sectionType: "fast_fav",
  label: "",
  subtitle: "",
  targetPath: "",
  status: "active",
  imageUrl: "",
};

const FastFavManagement = () => {
  const { showToast } = useToast();
  const { user: authUser } = useAuth();
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser]);
  const [resolvedPermissions, setResolvedPermissions] = useState({});
  const [activeTab, setActiveTab] = useState("fast_fav");
  const [tiles, setTiles] = useState([]);
  const [headings, setHeadings] = useState({
    fastFavHeading: "Fast Fav",
    moreHeading: "More",
  });
  const [headingDraft, setHeadingDraft] = useState({
    fastFavHeading: "Fast Fav",
    moreHeading: "More",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingHeadings, setIsSavingHeadings] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTile, setEditingTile] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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

  const loadTiles = async () => {
    setIsLoading(true);
    try {
      const res = await adminApi.getHomeTiles();
      const list = res.data.results || res.data.result || [];
      setTiles(Array.isArray(list) ? list : []);
      const nextHeadings = res.data.headings || {
        fastFavHeading: "Fast Fav",
        moreHeading: "More",
      };
      setHeadings(nextHeadings);
      setHeadingDraft(nextHeadings);
    } catch (e) {
      console.error(e);
      showToast("Failed to load Fast Fav / More tiles", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTiles();
  }, []);

  const filteredTiles = useMemo(
    () =>
      [...tiles]
        .filter((t) => t.sectionType === activeTab)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [tiles, activeTab],
  );

  const openCreateModal = () => {
    setEditingTile(null);
    setFormData({ ...EMPTY_FORM, sectionType: activeTab });
    setImageFile(null);
    setImagePreview("");
    setIsModalOpen(true);
  };

  const openEditModal = (tile) => {
    setEditingTile(tile);
    setFormData({
      sectionType: tile.sectionType || activeTab,
      label: tile.label || "",
      subtitle: tile.subtitle || "",
      targetPath: tile.targetPath || "",
      status: tile.status || "active",
      imageUrl: tile.imageUrl || "",
    });
    setImageFile(null);
    setImagePreview(tile.imageUrl || "");
    setIsModalOpen(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!formData.label.trim()) {
      showToast("Label is required", "error");
      return;
    }
    if (!editingTile && !imageFile && !formData.imageUrl) {
      showToast("Image is required", "error");
      return;
    }

    setIsSaving(true);
    try {
      const payload = new FormData();
      payload.append("sectionType", formData.sectionType || activeTab);
      payload.append("label", formData.label.trim());
      payload.append("subtitle", formData.subtitle.trim());
      payload.append("targetPath", formData.targetPath.trim());
      payload.append("status", formData.status || "active");
      if (imageFile) payload.append("image", imageFile);
      else if (formData.imageUrl) payload.append("imageUrl", formData.imageUrl);

      if (editingTile?._id) {
        await adminApi.updateHomeTile(editingTile._id, payload);
        showToast("Tile updated", "success");
      } else {
        await adminApi.createHomeTile(payload);
        showToast("Tile created", "success");
      }
      setIsModalOpen(false);
      await loadTiles();
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.message || "Failed to save tile", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this tile?")) return;
    try {
      await adminApi.deleteHomeTile(id);
      showToast("Tile deleted", "success");
      await loadTiles();
    } catch (e) {
      console.error(e);
      showToast("Failed to delete tile", "error");
    }
  };

  const handleReorder = async (index, direction) => {
    const list = [...filteredTiles];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= list.length) return;
    const a = list[index];
    const b = list[swapIndex];
    const items = [
      { id: a._id, order: b.sortOrder ?? swapIndex },
      { id: b._id, order: a.sortOrder ?? index },
    ];
    try {
      await adminApi.reorderHomeTiles(items);
      await loadTiles();
    } catch (e) {
      console.error(e);
      showToast("Failed to reorder", "error");
    }
  };

  const handleSaveHeadings = async () => {
    setIsSavingHeadings(true);
    try {
      const res = await adminApi.updateHomeHeadings({
        fastFavHeading: headingDraft.fastFavHeading,
        moreHeading: headingDraft.moreHeading,
      });
      const next = res.data?.result || headingDraft;
      setHeadings(next);
      setHeadingDraft(next);
      showToast("Headings saved", "success");
    } catch (e) {
      console.error(e);
      showToast("Failed to save headings", "error");
    } finally {
      setIsSavingHeadings(false);
    }
  };

  return (
    <div className="ds-section-spacing animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 px-1 mb-6">
        <div>
          <h1 className="ds-h1 flex items-center gap-3">
            Fast Fav & More
            <Badge variant="primary" className="text-[10px] font-black uppercase tracking-widest">
              Explore Cards
            </Badge>
          </h1>
          <p className="ds-description mt-1">
            Manage Explore Collection–style cards for the Quick home. Fast Fav shows first, then More
            right below it — same look as Food Explore More.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-6 py-3.5 bg-purple-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
          >
            <HiOutlinePlus className="h-5 w-5" />
            New {activeTab === "more" ? "More" : "Fast Fav"} Card
          </button>
        )}
      </div>

      <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden mb-6">
        <div className="p-5 space-y-4">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Section Headings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">Fast Fav Heading</label>
              <input
                value={headingDraft.fastFavHeading}
                onChange={(e) =>
                  setHeadingDraft((prev) => ({ ...prev, fastFavHeading: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
                placeholder="Fast Fav"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">More Heading</label>
              <input
                value={headingDraft.moreHeading}
                onChange={(e) =>
                  setHeadingDraft((prev) => ({ ...prev, moreHeading: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
                placeholder="More"
              />
            </div>
          </div>
          {canEdit && (
            <button
              onClick={handleSaveHeadings}
              disabled={isSavingHeadings}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {isSavingHeadings ? "Saving..." : "Save Headings"}
            </button>
          )}
          <p className="text-[11px] text-slate-400">
            Live headings: <span className="font-bold text-slate-600">{headings.fastFavHeading}</span> /{" "}
            <span className="font-bold text-slate-600">{headings.moreHeading}</span>
          </p>
        </div>
      </Card>

      <div className="flex gap-2 mb-4">
        {[
          { id: "fast_fav", label: "Fast Fav" },
          { id: "more", label: "More" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeTab === tab.id
                ? "bg-purple-600 text-white shadow-md"
                : "bg-white text-slate-500 ring-1 ring-slate-100 hover:bg-slate-50",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card className="border-none shadow-xl ring-1 ring-slate-100 bg-white rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {activeTab === "more" ? "More" : "Fast Fav"} Cards ({filteredTiles.length})
          </h2>
          {isLoading && (
            <span className="text-[10px] font-bold text-slate-400">Loading...</span>
          )}
        </div>
        <div className="divide-y divide-slate-50">
          {filteredTiles.length === 0 && !isLoading ? (
            <div className="p-10 text-center text-slate-400 text-sm font-medium">
              No cards yet. Add Explore-style tiles for the user home.
            </div>
          ) : (
            filteredTiles.map((tile, idx) => (
              <div
                key={tile._id}
                className="px-4 py-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50/40 transition-colors"
              >
                <div className="flex items-center gap-3 md:min-w-[240px]">
                  <div className="h-14 w-14 rounded-2xl flex-shrink-0 bg-slate-100 overflow-hidden ring-2 ring-slate-100">
                    {tile.imageUrl ? (
                      <img src={tile.imageUrl} alt={tile.label} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-slate-300">
                        <HiOutlinePhoto className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      #{idx + 1} {tile.label}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500">
                      {tile.subtitle || "No subtitle"} · {tile.targetPath || "/quick"}
                    </p>
                  </div>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-black uppercase",
                      tile.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {tile.status || "active"}
                  </span>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => handleReorder(idx, "up")}
                        disabled={idx === 0}
                        className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                      >
                        <HiOutlineArrowUpCircle className="h-5 w-5 text-slate-500" />
                      </button>
                      <button
                        onClick={() => handleReorder(idx, "down")}
                        disabled={idx === filteredTiles.length - 1}
                        className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                      >
                        <HiOutlineArrowDownCircle className="h-5 w-5 text-slate-500" />
                      </button>
                      <button
                        onClick={() => openEditModal(tile)}
                        className="p-2 rounded-lg hover:bg-blue-50 text-blue-600"
                      >
                        <HiOutlinePencilSquare className="h-5 w-5" />
                      </button>
                    </>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(tile._id)}
                      className="p-2 rounded-lg hover:bg-purple-50 text-purple-600"
                    >
                      <HiOutlineTrash className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTile ? "Edit Card" : `New ${activeTab === "more" ? "More" : "Fast Fav"} Card`}
      >
        <div className="space-y-4 p-1">
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Label</label>
            <input
              value={formData.label}
              onChange={(e) => setFormData((p) => ({ ...p, label: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
              placeholder="Collections"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Subtitle</label>
            <input
              value={formData.subtitle}
              onChange={(e) => setFormData((p) => ({ ...p, subtitle: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="Curated for you"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Link path</label>
            <input
              value={formData.targetPath}
              onChange={(e) => setFormData((p) => ({ ...p, targetPath: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="/quick or /shop-by-store"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Card image</label>
            <input type="file" accept="image/*" onChange={handleImageChange} />
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Preview"
                className="mt-3 h-24 w-24 rounded-2xl object-cover ring-1 ring-slate-100"
              />
            ) : null}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-black uppercase tracking-wider disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Card"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FastFavManagement;
