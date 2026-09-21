import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { adminAPI, uploadAPI } from "@food/api";
import { useAdminPermissions } from "@food/hooks/admin/useAdminPermissions";

const PERMISSION_KEY = "food::dining_management::dining_categories";

const emptyForm = { name: "", image: "", isActive: true, sortOrder: 0 };

export default function DiningCategories() {
  const { canCreate, canEdit, canDelete } = useAdminPermissions(PERMISSION_KEY);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getDiningCategories();
      setCategories(res?.data?.data?.categories || []);
    } catch {
      toast.error("Failed to load dining categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (category) => {
    setEditingId(category._id);
    setForm({ name: category.name, image: category.image, isActive: category.isActive, sortOrder: category.sortOrder || 0 });
    setShowModal(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const res = await uploadAPI.uploadMedia(file, { folder: "appzeto/dining" });
      const payload = res?.data?.data || res?.data;
      const url = payload?.url;
      if (url) setForm((prev) => ({ ...prev, image: url }));
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.image) {
      toast.error("Name and image are required");
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await adminAPI.updateDiningCategory(editingId, form);
        toast.success("Category updated");
      } else {
        await adminAPI.createDiningCategory(form);
        toast.success("Category created");
      }
      setShowModal(false);
      fetchCategories();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this dining category?")) return;
    try {
      await adminAPI.deleteDiningCategory(id);
      toast.success("Category deleted");
      fetchCategories();
    } catch {
      toast.error("Failed to delete category");
    }
  };

  const handleToggle = async (id) => {
    try {
      await adminAPI.toggleDiningCategoryStatus(id);
      fetchCategories();
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Dining Categories</h1>
          <p className="text-sm text-gray-500">Categories shown to users browsing dine-in restaurants</p>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-[#6412C6] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c83c00]"
          >
            <Plus className="h-4 w-4" /> Add Category
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-500">No dining categories yet.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {categories.map((cat) => (
            <div key={cat._id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <img src={cat.image} alt={cat.name} className="mb-2 h-20 w-full rounded-lg object-cover" />
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className="truncate text-sm font-semibold text-gray-900">{cat.name}</span>
              </div>
              <button
                onClick={() => canEdit && handleToggle(cat._id)}
                disabled={!canEdit}
                className={`mb-2 w-full rounded-full px-2 py-0.5 text-[11px] font-semibold ${cat.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
              >
                {cat.isActive ? "Active" : "Inactive"}
              </button>
              <div className="flex items-center gap-2">
                {canEdit && (
                  <button onClick={() => openEdit(cat)} className="flex-1 rounded-lg border border-gray-200 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    <Pencil className="mx-auto h-3.5 w-3.5" />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => handleDelete(cat._id)} className="flex-1 rounded-lg border border-red-200 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                    <Trash2 className="mx-auto h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editingId ? "Edit" : "Add"} Category</h2>
              <button onClick={() => setShowModal(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="e.g. Rooftop"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Image</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="text-xs" />
                {uploading && <p className="mt-1 text-xs text-gray-400">Uploading...</p>}
                {form.image && <img src={form.image} alt="preview" className="mt-2 h-16 w-16 rounded-lg object-cover" />}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Sort order</label>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-[#6412C6] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
