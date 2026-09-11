import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react"
import { adminAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"

const PERMISSION_KEY = "food::dining_management::dining_banners"

const defaultFormData = { title: "", image: "", link: "", sortOrder: 0, isActive: true }

export default function DiningBanners() {
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

  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBanner, setEditingBanner] = useState(null)
  const [formData, setFormData] = useState(defaultFormData)
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef(null)

  const fetchBanners = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getDiningBanners()
      const list = response?.data?.data?.banners || []
      setBanners(Array.isArray(list) ? list : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load dining banners")
      setBanners([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBanners() }, [])

  const sortedBanners = useMemo(() => [...banners].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), [banners])

  const resetModal = () => {
    setIsModalOpen(false)
    setEditingBanner(null)
    setFormData(defaultFormData)
    setSelectedImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleAddNew = () => {
    if (!canCreate) { toast.error("Permission denied"); return }
    setEditingBanner(null)
    setFormData(defaultFormData)
    setSelectedImageFile(null)
    setImagePreview(null)
    setIsModalOpen(true)
  }

  const handleEdit = (banner) => {
    if (!canEdit) { toast.error("Permission denied"); return }
    setEditingBanner(banner)
    setFormData({
      title: banner?.title || "",
      image: banner?.image || "",
      link: banner?.link || "",
      sortOrder: banner?.sortOrder ?? 0,
      isActive: banner?.isActive !== false,
    })
    setSelectedImageFile(null)
    setImagePreview(banner?.image || null)
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
      const response = await adminAPI.toggleDiningBannerStatus(String(id))
      if (response?.data?.success) {
        toast.success("Status updated")
        fetchBanners()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update status")
    }
  }

  const handleDelete = async (id) => {
    if (!canDelete) { toast.error("Permission denied"); return }
    if (!window.confirm("Delete this banner? This action cannot be undone.")) return
    try {
      const response = await adminAPI.deleteDiningBanner(String(id))
      if (response?.data?.success) {
        toast.success("Banner deleted")
        fetchBanners()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete banner")
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (editingBanner && !canEdit) { toast.error("Permission denied"); return }
    if (!editingBanner && !canCreate) { toast.error("Permission denied"); return }

    try {
      setUploadingImage(true)
      let imageUrl = String(formData.image || "").trim()
      if (selectedImageFile) {
        const uploadRes = await uploadAPI.uploadMedia(selectedImageFile, { folder: "appzeto/dining-banners" })
        const payload = uploadRes?.data?.data || uploadRes?.data
        imageUrl = payload?.url || imageUrl
      }
      if (!imageUrl) {
        toast.error("Banner image is required")
        setUploadingImage(false)
        return
      }

      const payload = {
        title: String(formData.title || "").trim(),
        image: imageUrl,
        link: String(formData.link || "").trim(),
        sortOrder: Number(formData.sortOrder) || 0,
        isActive: Boolean(formData.isActive),
      }

      const id = editingBanner?._id || editingBanner?.id
      if (editingBanner) {
        const response = await adminAPI.updateDiningBanner(id, payload)
        if (response?.data?.success) toast.success("Banner updated")
      } else {
        const response = await adminAPI.createDiningBanner(payload)
        if (response?.data?.success) toast.success("Banner created")
      }
      resetModal()
      fetchBanners()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save banner")
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dining Banners</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">Promotional banners shown at the top of the Dining discovery page.</p>
          </div>
          {canCreate && (
            <button onClick={handleAddNew} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white">
              <Plus className="h-4 w-4" />
              Add Banner
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-slate-500">Loading banners...</p>
        </div>
      ) : sortedBanners.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center">
          <p className="text-lg font-semibold text-slate-700">No dining banners yet</p>
          <p className="mt-1 text-sm text-slate-500">Add one to promote dining offers to users.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedBanners.map((banner) => {
            const id = banner?._id || banner?.id
            return (
              <div key={id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="aspect-[16/7] w-full bg-slate-100">
                  {banner?.image ? (
                    <img src={banner.image} alt={banner.title || "Banner"} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900">{banner?.title || "Untitled banner"}</p>
                    <button
                      onClick={() => handleToggleStatus(id)}
                      disabled={!canEdit}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full ${banner?.isActive ? "bg-primary" : "bg-slate-300"} ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${banner?.isActive ? "translate-x-4.5" : "translate-x-1"}`} />
                    </button>
                  </div>
                  {banner?.link && <p className="truncate text-xs text-slate-400">{banner.link}</p>}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-400">Sort: {banner?.sortOrder ?? 0}</span>
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button onClick={() => handleEdit(banner)} className="rounded-lg p-2 text-primary hover:bg-[#f7f3fc]" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(id)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

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
                    className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl max-h-[min(680px,calc(100vh-32px))]"
                  >
                    <div className="flex items-center justify-between border-b px-6 py-4">
                      <h2 className="text-xl font-bold text-slate-900">{editingBanner ? "Edit Banner" : "Add Dining Banner"}</h2>
                      <button onClick={resetModal} className="rounded-lg p-1 hover:bg-slate-100">
                        <X className="h-5 w-5 text-slate-500" />
                      </button>
                    </div>
                    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Title</label>
                          <input
                            type="text"
                            value={formData.title}
                            onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                            placeholder="Optional headline"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Link (optional)</label>
                          <input
                            type="text"
                            value={formData.link}
                            onChange={(event) => setFormData((prev) => ({ ...prev, link: event.target.value }))}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                            placeholder="/food/user/dining/<restaurantId>"
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
                          <label className="mb-2 block text-sm font-medium text-slate-700">Banner Image *</label>
                          <div className="space-y-3">
                            {(imagePreview || formData.image) && (
                              <div className="relative aspect-[16/7] w-full overflow-hidden rounded-2xl border border-slate-300">
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
                                id="dining-banner-image-upload"
                              />
                              <label htmlFor="dining-banner-image-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700">
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
                          {uploadingImage ? "Saving..." : editingBanner ? "Update" : "Create"}
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
