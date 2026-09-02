import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowLeft,
  BadgeCheck,
  Clock3,
  Edit2,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { restaurantAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
import { ImageSourcePicker } from "@food/components/ImageSourcePicker"
import { isFlutterBridgeAvailable } from "@food/utils/imageUploadUtils"

const defaultFormData = {
  name: "",
  type: "",
  image: "",
  isActive: true,
  sortOrder: 0,
  foodTypeScope: "Veg",
}

const approvalBadgeClass = (status) => {
  const value = String(status || "pending").toLowerCase()
  if (value === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (value === "rejected") return "bg-rose-50 text-rose-700 border-rose-200"
  return "bg-amber-50 text-amber-700 border-amber-200"
}

const scopePillClass = (scope) => {
  if (scope === "Veg") return "bg-green-50 text-green-700 border-green-200"
  if (scope === "Non-Veg") return "bg-red-50 text-red-700 border-red-200"
  return "bg-slate-100 text-slate-700 border-slate-200"
}

export default function MenuCategoriesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const goBack = useRestaurantBackNavigation()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [formData, setFormData] = useState(defaultFormData)
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    const draftCategoryName = String(location.state?.draftCategoryName || "").trim()
    if (!draftCategoryName) return
    setEditingCategory(null)
    setFormData((prev) => ({ ...prev, ...defaultFormData, name: draftCategoryName }))
    setSelectedImageFile(null)
    setImagePreview(null)
    setShowModal(true)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  const ownCategories = useMemo(
    () => categories.filter((category) => category.ownedByRestaurant),
    [categories],
  )

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getAllCategories()
      const list = response?.data?.data?.categories || []
      setCategories(Array.isArray(list) ? list : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load categories")
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  const resetModal = () => {
    setShowModal(false)
    setEditingCategory(null)
    setFormData(defaultFormData)
    setSelectedImageFile(null)
    setImagePreview(null)
    setUploadingImage(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const openCreateModal = () => {
    setEditingCategory(null)
    setFormData(defaultFormData)
    setSelectedImageFile(null)
    setImagePreview(null)
    setShowModal(true)
  }

  const openEditModal = (category) => {
    if (!category?.canEdit) {
      toast.error("ECS controls this category now")
      return
    }
    setEditingCategory(category)
    setFormData({
      name: category?.name || "",
      type: category?.type || "",
      image: category?.image || "",
      isActive: category?.isActive !== false,
      sortOrder: Number.isFinite(Number(category?.sortOrder)) ? Number(category.sortOrder) : 0,
      foodTypeScope: category?.foodTypeScope || "Veg",
    })
    setSelectedImageFile(null)
    setImagePreview(category?.image || null)
    setShowModal(true)
  }

  const handleImageFileChange = (file) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size exceeds 5MB limit.")
      return
    }
    setSelectedImageFile(file)
    try {
      setImagePreview(URL.createObjectURL(file))
    } catch {
      setImagePreview(null)
    }
  }

  const handleImageClick = () => {
    if (isFlutterBridgeAvailable()) {
      setIsPhotoPickerOpen(true)
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleSaveCategory = async () => {
    if (!String(formData.name || "").trim()) {
      toast.error("Category name is required")
      return
    }

    try {
      setUploadingImage(true)
      let imageUrl = String(formData.image || "").trim()

      if (selectedImageFile) {
        const res = await uploadAPI.uploadMedia(selectedImageFile, { folder: "food/categories" })
        const url = res?.data?.data?.url || res?.data?.url
        if (url) imageUrl = String(url)
      }

      const payload = {
        name: String(formData.name || "").trim(),
        type: String(formData.type || "").trim(),
        image: imageUrl,
        isActive: formData.isActive !== false,
        sortOrder: Number.isFinite(Number(formData.sortOrder)) ? Number(formData.sortOrder) : 0,
        foodTypeScope: formData.foodTypeScope,
      }

      if (editingCategory) {
        await restaurantAPI.updateCategory(editingCategory._id || editingCategory.id, payload)
        toast.success("Category updated and sent for admin approval")
      } else {
        await restaurantAPI.createCategory(payload)
        toast.success("Category created and sent for admin approval")
      }

      resetModal()
      fetchCategories()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save category")
    } finally {
      setUploadingImage(false)
    }
  }

  const handleDeleteCategory = async (category) => {
    if (!category?.canDelete) {
      toast.error(category?.canEdit ? "Remove foods from this category before deleting it" : "ECS controls this category now")
      return
    }
    if (!window.confirm(`Delete "${category.name}"?`)) return

    try {
      await restaurantAPI.deleteCategory(category._id || category.id)
      toast.success("Category deleted successfully")
      fetchCategories()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete category")
    }
  }

  const handleToggleActive = async (category) => {
    if (!category?.canEdit) {
      toast.error("ECS controls this category now")
      return
    }
    try {
      await restaurantAPI.updateCategory(category._id || category.id, {
        isActive: !(category?.isActive !== false),
      })
      toast.success("Category updated and sent for admin approval")
      fetchCategories()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update category")
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={goBack} className="rounded-full p-1 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5 text-slate-700" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Menu Categories</h1>
            <p className="text-xs text-slate-500">Create categories, track approvals, and resubmit edits safely.</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">How this works</p>
          <p className="mt-2 text-sm text-slate-600">
            New categories stay pending until admin approval. Editing an approved category sends it back for review.
            Only approved categories can be used for food uploads.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white"
        >
          <Plus className="h-5 w-5" />
          Add Category
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : ownCategories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <p className="text-lg font-semibold text-slate-900">No restaurant categories yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Start with a category and choose whether it should accept veg, non-veg, or both kinds of dishes.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {ownCategories.map((category) => {
              const status = category?.approvalStatus || "pending"
              const isEditable = category?.canEdit
              const isGlobal = category?.isGlobal

              return (
                <motion.div
                  key={category._id || category.id}
                  layout
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                      {category?.image ? (
                        <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-bold text-slate-500">
                          {String(category?.name || "C").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">{category.name}</h3>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${approvalBadgeClass(status)}`}>
                          {status === "approved" ? <BadgeCheck className="mr-1 h-3.5 w-3.5" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${scopePillClass(category?.foodTypeScope)}`}>
                          {category?.foodTypeScope || "Both"}
                        </span>
                        {isGlobal && (
                          <span className="inline-flex items-center rounded-full border border-[#c3ccd6] bg-[#f3f5f7] px-2.5 py-1 text-[11px] font-semibold text-[#092240]">
                            <Globe className="mr-1 h-3.5 w-3.5" />
                            Global
                          </span>
                        )}
                      </div>

                      <div className="mt-2 space-y-1 text-sm text-slate-500">
                        <p>{category?.itemCount || 0} item(s) linked</p>
                        {isGlobal ? (
                          <p>ECS controls this category now, so you can use it but not rename or delete it.</p>
                        ) : status === "approved" ? (
                          <p>Editing this category will send it back for admin approval.</p>
                        ) : (
                          <p>Foods can be added only after approval.</p>
                        )}
                        {status === "rejected" && category?.rejectionReason && (
                          <p className="text-rose-600">Reason: {category.rejectionReason}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(category)}
                      className="rounded-xl bg-slate-100 p-2 text-slate-700 hover:bg-slate-200 transition-colors"
                      title={category?.isActive !== false ? "Deactivate" : "Activate"}
                    >
                      {category?.isActive !== false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    {status !== "approved" && (
                      <button
                        onClick={() => openEditModal(category)}
                        className="rounded-xl bg-[#f3f5f7] p-2 text-[#092240] hover:bg-[#e7eaef] transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteCategory(category)}
                      className="rounded-xl bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetModal}
              className="fixed inset-0 z-50 bg-black/50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {editingCategory ? "Edit Category" : "Create Category"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {editingCategory
                      ? "Any edit sends this category back for admin approval."
                      : "Choose the diet scope carefully before sending it for approval."}
                  </p>
                </div>
                <button onClick={resetModal}>
                  <X className="h-5 w-5 text-slate-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Category Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter category name"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Diet Scope</label>
                  <select
                    value={formData.foodTypeScope}
                    onChange={(e) => setFormData((prev) => ({ ...prev, foodTypeScope: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                  >
                    <option value="Veg">Veg</option>
                    <option value="Non-Veg">Non-Veg</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Optional Type Label</label>
                  <input
                    type="text"
                    value={formData.type}
                    onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
                    placeholder="Examples: Starters, Desserts, Drinks"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                  />
                </div>

                <div className="flex items-center gap-3">
                  {(imagePreview || formData.image) && (
                    <img
                      src={imagePreview || formData.image}
                      alt="Category preview"
                      className="h-16 w-16 rounded-2xl object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleImageClick}
                    className="flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Image
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => handleImageFileChange(e.target.files?.[0])}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
                  />
                  Keep category active
                </label>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={resetModal} className="flex-1 rounded-xl border border-slate-300 py-3 font-medium text-slate-700">
                  Cancel
                </button>
                <button
                  onClick={handleSaveCategory}
                  disabled={uploadingImage}
                  className="flex-1 rounded-xl bg-slate-900 py-3 font-medium text-white disabled:opacity-60"
                >
                  {uploadingImage ? "Uploading..." : editingCategory ? "Save & Resubmit" : "Create"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ImageSourcePicker
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onFileSelect={handleImageFileChange}
        title="Category Image"
        description="Choose how to upload your category image"
        fileNamePrefix="category-photo"
        galleryInputRef={fileInputRef}
      />
    </div>
  )
}
