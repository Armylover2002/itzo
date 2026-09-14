import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { adminAPI, uploadAPI } from "@food/api";
import { useAdminPermissions } from "@food/hooks/admin/useAdminPermissions";

const PERMISSION_KEY = "food::dining_management::dining_banners";

const emptyForm = { title: "", image: "", link: "", isActive: true, sortOrder: 0 };

export default function DiningBanners() {
  const { canCreate, canEdit, canDelete } = useAdminPermissions(PERMISSION_KEY);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getDiningBanners();
      setBanners(res?.data?.data?.banners || []);
    } catch {
      toast.error("Failed to load dining banners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBanners(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (banner) => {
    setEditingId(banner._id);
    setForm({ title: banner.title || "", image: banner.image, link: banner.link || "", isActive: banner.isActive, sortOrder: banner.sortOrder || 0 });
    setShowModal(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const res = await uploadAPI.uploadMedia(file, { folder: "appzeto/dining" });
      const payload = res?.data?.data || res?.data;
      if (payload?.url) setForm((prev) => ({ ...prev, image: payload.url }));
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.image) {
      toast.error("Image is required");
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await adminAPI.updateDiningBanner(editingId, form);
        toast.success("Banner updated");
      } else {
        await adminAPI.createDiningBanner(form);
        toast.success("Banner created");
      }
      setShowModal(false);
      fetchBanners();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save banner");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this banner?")) return;
    try {
      await adminAPI.deleteDiningBanner(id);
      toast.success("Banner deleted");
      fetchBanners();
    } catch {
      toast.error("Failed to delete banner");
    }
  };

  const handleToggle = async (id) => {
    try {
      await adminAPI.toggleDiningBannerStatus(id);
      fetchBanners();
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Dining Banners</h1>
          <p className="text-sm text-gray-500">Promotional banners shown on the Dining home screen</p>
        </div>
        {canCreate && (
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-[#FF0000] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c83c00]">
            <Plus className="h-4 w-4" /> Add Banner
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : banners.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-500">No dining banners yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {banners.map((banner) => (
            <div key={banner._id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <img src={banner.image} alt={banner.title || "Banner"} className="h-32 w-full object-cover" />
              <div className="p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="truncate text-sm font-semibold text-gray-900">{banner.title || "Untitled"}</span>
                  <button
                    onClick={() => canEdit && handleToggle(banner._id)}
                    disabled={!canEdit}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${banner.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {banner.isActive ? "Active" : "Inactive"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <button onClick={() => openEdit(banner)} className="flex-1 rounded-lg border border-gray-200 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
                      <Pencil className="mx-auto h-3.5 w-3.5" />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => handleDelete(banner._id)} className="flex-1 rounded-lg border border-red-200 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                      <Trash2 className="mx-auto h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editingId ? "Edit" : "Add"} Banner</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Title (optional)</label>
                <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Image</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="text-xs" />
                {uploading && <p className="mt-1 text-xs text-gray-400">Uploading...</p>}
                {form.image && <img src={form.image} alt="preview" className="mt-2 h-16 w-28 rounded-lg object-cover" />}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Link (optional)</label>
                <input value={form.link} onChange={(e) => setForm((p) => ({ ...p, link: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="/food/user/dining/..." />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Sort order</label>
                <input type="number" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#FF0000] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
