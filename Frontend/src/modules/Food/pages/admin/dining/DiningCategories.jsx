import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react"
import { adminAPI, uploadAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { toast } from "sonner"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"

const PERMISSION_KEY = "food::dining_management::dining_categories"

const defaultFormData = { name: "", image: "", sortOrder: 0, isActive: true }

export default function DiningCategories() {
  const { user: authUser } = useAuth()
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser])
  const [resolvedPermissions, setResolvedPermissions] = useState({})

  useEffect(() => {
    let isMounted = true
    const resolvePermissions = async () => {
      if (!currentUser || currentUser.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({})
        return
      }
      const existingPermissions = extractAdminPermissions(currentUser)
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions)
        return
      }
      const roleId = extractAdminRoleId(currentUser)
      if (!roleId) {
        if (isMounted) setResolvedPermissions({})
        return
      }
      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId)
        if (isMounted) setResolvedPermissions(rolePermissions)
      } catch {
        if (isMounted) setResolvedPermissions({})
      }
    }
    resolvePermissions()
    return () => { isMounted = false }
  }, [currentUser])

  const canCreate = useMemo(() => canPerformAdminPermissionAction(currentUser, resolvedPermissions, PERMISSION_KEY, "create"), [currentUser, resolvedPermissions])
  const canEdit = useMemo(() => canPerformAdminPermissionAction(currentUser, resolvedPermissions, PERMISSION_KEY, "edit"), [currentUser, resolvedPermissions])
  const canDelete = useMemo(() => canPerformAdminPermissionAction(currentUser, resolvedPermissions, PERMISSION_KEY, "delete"), [currentUser, resolvedPermissions])

  const [searchQuery, setSearchQuery] = useState("")
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [formData, setFormData] = useState(defaultFormData)
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef(null)

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getDiningCategories(searchQuery ? { search: searchQuery } : {})
      const list = response?.data?.data?.categories || []
      setCategories(Array.isArray(list) ? list : [])
    } catch (error) {
      if (error?.code === "ERR_NETWORK" || error?.message === "Network Error") {
        toast.error("Cannot connect to server. Please check if backend is running on " + API_BASE_URL.replace("/api", ""))
      } else {
        toast.error(error?.response?.data?.message || "Failed to load dining categories")
      }
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(fetchCategories, 300)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery])

  const filteredCategories = useMemo(() => {
    return [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }, [categories])

  const resetModal = () => {
    setIsModalOpen(false)
    setEditingCategory(null)
    setFormData(defaultFormData)
    setSelectedImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleAddNew = () => {
    if (!canCreate) { toast.error("Permission denied"); return }
    setEditingCategory(null)
    setFormData(defaultFormData)
    setSelectedImageFile(null)
    setImagePreview(null)
    setIsModalOpen(true)
  }

  const handleEdit = (category) => {
    if (!canEdit) { toast.error("Permission denied"); return }
    setEditingCategory(category)
    setFormData({
      name: category?.name || "",
      image: category?.image || "",
      sortOrder: category?.sortOrder ?? 0,
      isActive: category?.isActive !== false,
    })
    setSelectedImageFile(null)
    setImagePreview(category?.image || null)
    setIsModalOpen(true)
  }

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Please upload PNG, JPG, JPEG, or WEBP.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit.")
      return
    }
    setSelectedImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result)
    reader.readAsDataURL(file)
  }

  const handleToggleStatus = async (id) => {
    if (!canEdit) { toast.error("Permission denied"); return }
    try {
      const response = await adminAPI.toggleDiningCategoryStatus(String(id))
      if (response?.data?.success) {
        toast.success("Status updated")
        fetchCategories()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update status")
    }
  }

  const handleDelete = async (id) => {
    if (!canDelete) { toast.error("Permission denied"); return }
    const name = categories.find((c) => String(c?._id || c?.id) === String(id))?.name || "this category"
    if (!window.confirm(`Delete "${name}"? This action cannot be undone.`)) return
    try {
      const response = await adminAPI.deleteDiningCategory(String(id))
      if (response?.data?.success) {
        toast.success("Dining category deleted")
        fetchCategories()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete category")
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (editingCategory && !canEdit) { toast.error("Permission denied"); return }
    if (!editingCategory && !canCreate) { toast.error("Permission denied"); return }

    if (!String(formData.name || "").trim()) {
      toast.error("Category name is required")
      return
    }

    if (!selectedImageFile && !String(formData.image || "").trim()) {
      toast.error("Category image is required")
      return
    }

    try {
      setUploadingImage(true)
      let imageUrl = String(formData.image || "").trim()
      if (selectedImageFile) {
        const uploadRes = await uploadAPI.uploadMedia(selectedImageFile, { folder: "appzeto/dining-categories" })
        const payload = uploadRes?.data?.data || uploadRes?.data
        imageUrl = payload?.url || imageUrl
      }

      if (!imageUrl) {
        toast.error("Category image is required")
        setUploadingImage(false)
        return
      }

      const payload = {
        name: String(formData.name || "").trim(),
        image: imageUrl || "",
        sortOrder: Number(formData.sortOrder) || 0,
        isActive: Boolean(formData.isActive),
      }

      const id = editingCategory?._id || editingCategory?.id
      if (editingCategory) {
        const response = await adminAPI.updateDiningCategory(id, payload)
        if (response?.data?.success) toast.success("Dining category updated")
      } else {
        const response = await adminAPI.createDiningCategory(payload)
        if (response?.data?.success) toast.success("Dining category created")
      }
      resetModal()
      fetchCategories()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save category")
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dining Categories</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Tags shown to users when browsing dining restaurants — e.g. Rooftop, Fine Dining, Buffet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search categories"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-slate-900"
              />
            </div>
            {canCreate && (
              <button onClick={handleAddNew} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white">
                <Plus className="h-4 w-4" />
                Add Category
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="w-[40%] px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Category</th>
                <th className="w-[15%] px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">Sort Order</th>
                <th className="w-[15%] px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">Status</th>
                <th className="w-[30%] px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-20 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                  <p className="mt-2 text-sm text-slate-500">Loading categories...</p>
                </td></tr>
              ) : filteredCategories.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-20 text-center">
                  <p className="text-lg font-semibold text-slate-700">No dining categories yet</p>
                  <p className="mt-1 text-sm text-slate-500">Add one to let users filter dining restaurants.</p>
                </td></tr>
              ) : (
                filteredCategories.map((category) => {
                  const id = category?._id || category?.id
                  return (
                    <tr key={id} className="align-top hover:bg-slate-50/80">
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 overflow-hidden rounded-2xl bg-slate-100">
                            {category?.image ? (
                              <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-500">
                                {String(category?.name || "C").slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <p className="truncate text-base font-semibold text-slate-900">{category?.name || "-"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-5 text-center text-sm text-slate-600">{category?.sortOrder ?? 0}</td>
                      <td className="px-4 py-5 text-center">
                        <button
                          onClick={() => handleToggleStatus(id)}
                          disabled={!canEdit}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full ${category?.isActive ? "bg-primary" : "bg-slate-300"} ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${category?.isActive ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button onClick={() => handleEdit(category)} className="rounded-lg p-2 text-primary hover:bg-[#f7f3fc]" title="Edit">
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button onClick={() => handleDelete(id)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isModalOpen && (
              <div className="fixed inset-0 z-[200]">
                <div className="absolute inset-0 bg-black/50" onClick={resetModal} />
                <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl max-h-[min(640px,calc(100vh-32px))]"
                  >
                    <div className="flex items-center justify-between border-b px-6 py-4">
                      <h2 className="text-xl font-bold text-slate-900">{editingCategory ? "Edit Category" : "Add Dining Category"}</h2>
                      <button onClick={resetModal} className="rounded-lg p-1 hover:bg-slate-100">
                        <X className="h-5 w-5 text-slate-500" />
                      </button>
                    </div>
                    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Category Name</label>
                          <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                            placeholder="e.g. Rooftop, Fine Dining"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Sort Order</label>
                          <input
                            type="number"
                            value={formData.sortOrder}
                            onChange={(event) => setFormData((prev) => ({ ...prev, sortOrder: event.target.value }))}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Category Image *</label>
                          <div className="space-y-3">
                            {(imagePreview || formData.image) && (
                              <div className="relative h-32 w-32 overflow-hidden rounded-2xl border border-slate-300">
                                <img src={imagePreview || formData.image} alt="Preview" className="h-full w-full object-cover" />
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                onChange={handleImageSelect}
                                className="hidden"
                                id="dining-category-image-upload"
                              />
                              <label htmlFor="dining-category-image-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700">
                                <Upload className="h-4 w-4" />
                                {imagePreview ? "Change Image" : "Upload Image"}
                              </label>
                              {uploadingImage && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                            </div>
                          </div>
                        </div>

                        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={formData.isActive}
                            onChange={(event) => setFormData((prev) => ({ ...prev, isActive: event.target.checked }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Active Status
                        </label>
                      </div>
                      <div className="flex items-center gap-3 border-t bg-white px-6 py-4">
                        <button type="button" onClick={resetModal} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-slate-700">
                          Cancel
                        </button>
                        <button type="submit" disabled={uploadingImage} className="flex-1 rounded-xl bg-primary px-4 py-3 text-white disabled:opacity-60">
                          {uploadingImage ? "Saving..." : editingCategory ? "Update" : "Create"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  )
}
