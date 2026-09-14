import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle,
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

const INACTIVE_CATEGORY_WARNING = "This category is currently inactive and is not available for use."

const approvalBadgeClass = (status) => {
  const value = String(status || "pending").toLowerCase()
  if (value === "deactivated") return "bg-slate-100 text-slate-700 border-slate-300"
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
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deletingCategory, setDeletingCategory] = useState(false)
  const [isPureVegRestaurant, setIsPureVegRestaurant] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    let isMounted = true
    const fetchRestaurantProfile = async () => {
      try {
        const response = await restaurantAPI.getCurrentRestaurant()
        const profile =
          response?.data?.data?.restaurant ||
          response?.data?.restaurant ||
          response?.data?.data ||
          null
        if (!isMounted) return
        setIsPureVegRestaurant(profile?.pureVegRestaurant === true)
      } catch {
        if (isMounted) setIsPureVegRestaurant(false)
      }
    }
    fetchRestaurantProfile()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!isPureVegRestaurant) return
    setFormData((prev) => (
      prev.foodTypeScope === "Veg" ? prev : { ...prev, foodTypeScope: "Veg" }
    ))
  }, [isPureVegRestaurant, showModal])

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
    setFormData(isPureVegRestaurant ? { ...defaultFormData, foodTypeScope: "Veg" } : defaultFormData)
    setSelectedImageFile(null)
    setImagePreview(null)
    setShowModal(true)
  }

  const openEditModal = (category) => {
    if (!category?.canEdit) {
      toast.error("Admin controls this category now")
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

  const validateCategoryForm = () => {
    const name = String(formData.name || "").trim()
    if (!name) return "Category name is required"
    if (name.length > 200) return "Category name is too long"
    if (!["Veg", "Non-Veg"].includes(formData.foodTypeScope)) {
      return "Category diet type must be Veg or Non-Veg"
    }
    if (isPureVegRestaurant && formData.foodTypeScope !== "Veg") {
      return "Pure veg restaurants can only create veg categories"
    }
    if (selectedImageFile && selectedImageFile.size > 5 * 1024 * 1024) {
      return "Image size exceeds 5MB limit."
    }
    return null
  }

  const handleSaveCategory = async () => {
    const validationError = validateCategoryForm()
    if (validationError) {
      toast.error(validationError)
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

  const handleDeleteCategory = async () => {
    const category = deleteTarget
    if (!category?.canDelete && !category?.canEdit) {
      toast.error("Admin controls this category now")
      return
    }

    try {
      setDeletingCategory(true)
      const response = await restaurantAPI.deleteCategory(category._id || category.id)
      const deactivatedCount = Number(response?.data?.data?.deactivatedItemCount || 0)
      if (deactivatedCount > 0) {
        toast.success(`Category deleted. ${deactivatedCount} linked item(s) were marked inactive.`)
      } else {
        toast.success("Category deleted successfully")
      }
      setDeleteTarget(null)
      fetchCategories()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete category")
    } finally {
      setDeletingCategory(false)
    }
  }

  const handleToggleActive = async (category) => {
    if (!category?.canEdit) {
      toast.error("Admin controls this category now")
      return
    }
    try {
      await restaurantAPI.updateCategory(category._id || category.id, {
        isActive: !(category?.isActive !== false),
      })
      toast.success(category?.isActive !== false ? "Category deactivated" : "Category activated")
      fetchCategories()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update category")
    }
  }

  const categoryFormFields = (
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
          {!isPureVegRestaurant && <option value="Non-Veg">Non-Veg</option>}
        </select>
        {isPureVegRestaurant ? (
          <p className="mt-2 text-xs text-slate-500">Pure veg restaurants can only create veg categories.</p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">Choose whether this category is for veg or non-veg dishes.</p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Display Order</label>
        <input
          type="number"
          min="0"
          step="1"
          value={formData.sortOrder}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              sortOrder: Number(e.target.value) || 0,
            }))
          }
          className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
          placeholder="0"
        />
        <p className="mt-2 text-xs text-slate-500">Lower numbers appear first on your menu.</p>
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
  )

  const categoryFormActions = (
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
  )

  const categoryModalHeader = (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold text-slate-900">
          {editingCategory ? "Edit Category" : "Create Category"}
        </h2>
        <p className="text-xs text-slate-500 lg:text-sm">
          {editingCategory
            ? "Any edit sends this category back for admin approval."
            : "Choose the diet scope carefully before sending it for approval."}
        </p>
      </div>
      <button onClick={resetModal} className="rounded-full p-1 hover:bg-slate-100">
        <X className="h-5 w-5 text-slate-600" />
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 pb-24 lg:pb-8">
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="px-4 py-3 flex items-center gap-3 lg:max-w-5xl lg:mx-auto lg:px-8 lg:py-5">
          <button onClick={goBack} className="rounded-full p-1 hover:bg-slate-100 lg:hidden">
            <ArrowLeft className="h-5 w-5 text-slate-700" />
          </button>
          <div className="flex-1 lg:flex lg:items-center lg:justify-between lg:gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 lg:text-2xl">Menu Categories</h1>
              <p className="text-xs text-slate-500 lg:text-sm lg:mt-1">Create categories, track approvals, and resubmit edits safely.</p>
            </div>
            <button
              onClick={openCreateModal}
              className="hidden lg:flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add Category
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 lg:max-w-5xl lg:mx-auto lg:px-8 lg:py-6 lg:space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:p-5">
          <p className="text-sm font-semibold text-slate-900">How this works</p>
          <p className="mt-2 text-sm text-slate-600">
            New categories stay pending until admin approval. Editing an approved category sends it back for review.
            Only approved categories can be used for food uploads.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white lg:hidden"
        >
          <Plus className="h-5 w-5" />
          Add Category
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-12 lg:py-20">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : ownCategories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center lg:py-16">
            <p className="text-lg font-semibold text-slate-900">No restaurant categories yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Start with a category and choose whether it should accept veg or non-veg dishes.
            </p>
          </div>
        ) : (
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 xl:grid-cols-2">
            {ownCategories.map((category) => {
              const status = category?.isActive === false ? "deactivated" : (category?.approvalStatus || "pending")
              const isEditable = category?.canEdit
              const isGlobal = category?.isGlobal

              return (
                <motion.div
                  key={category._id || category.id}
                  layout
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5"
                >
                  <div className="flex gap-3 lg:items-start lg:justify-between">
                    <div className="flex min-w-0 flex-1 gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100 lg:h-14 lg:w-14">
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
                          {status === "approved" ? <BadgeCheck className="mr-1 h-3.5 w-3.5" /> : status === "deactivated" ? <EyeOff className="mr-1 h-3.5 w-3.5" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${scopePillClass(category?.foodTypeScope)}`}>
                          {category?.foodTypeScope || "Veg"}
                        </span>
                        {isGlobal && (
                          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                            <Globe className="mr-1 h-3.5 w-3.5" />
                            Global
                          </span>
                        )}
                      </div>

                      <div className="mt-2 space-y-1 text-sm text-slate-500">
                        <p>{category?.itemCount || 0} item(s) linked</p>
                        <p>Display order: {Number.isFinite(Number(category?.sortOrder)) ? Number(category.sortOrder) : 0}</p>
                        {isGlobal ? (
                          <p>Admin controls this category now, so you can use it but not rename or delete it.</p>
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

                  {!isGlobal && isEditable && (
                    <div className="mt-4 flex items-center gap-2 lg:mt-0 lg:shrink-0">
                      <button
                        onClick={() => handleToggleActive(category)}
                        className="rounded-xl bg-slate-100 p-2 text-slate-700 hover:bg-slate-200 transition-colors"
                        title={category?.isActive !== false ? "Deactivate" : "Activate"}
                      >
                        {category?.isActive !== false ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => openEditModal(category)}
                        className="rounded-xl bg-blue-50 p-2 text-blue-700 hover:bg-blue-100 transition-colors"
                        title="Edit category"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(category)}
                        className="rounded-xl bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 transition-colors"
                        title="Delete category"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
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
            {/* Mobile bottom sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl lg:hidden"
            >
              {categoryModalHeader}
              {categoryFormFields}
              {categoryFormActions}
            </motion.div>
            {/* Desktop centered dialog */}
            <div className="fixed inset-0 z-50 hidden lg:flex items-center justify-center p-6 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="pointer-events-auto w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {categoryModalHeader}
                {categoryFormFields}
                {categoryFormActions}
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !deletingCategory && setDeleteTarget(null)}
              className="fixed inset-0 z-50 bg-black/50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-white p-4 shadow-2xl lg:hidden"
            >
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-900">Delete category?</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {Number(deleteTarget?.itemCount || 0) > 0
                    ? `Deleting "${deleteTarget.name}" will remove the category and mark ${deleteTarget.itemCount} linked item(s) as inactive. You can reassign those items to another category before activating them again.`
                    : `Are you sure you want to delete "${deleteTarget.name}"?`}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deletingCategory}
                  className="flex-1 rounded-xl border border-slate-300 py-3 font-medium text-slate-700 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteCategory}
                  disabled={deletingCategory}
                  className="flex-1 rounded-xl bg-rose-600 py-3 font-medium text-white disabled:opacity-60"
                >
                  {deletingCategory ? "Deleting..." : "Delete category"}
                </button>
              </div>
            </motion.div>
            <div className="fixed inset-0 z-50 hidden lg:flex items-center justify-center p-6 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="pointer-events-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-bold text-slate-900">Delete category?</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {Number(deleteTarget?.itemCount || 0) > 0
                    ? `Deleting "${deleteTarget.name}" will remove the category and mark ${deleteTarget.itemCount} linked item(s) as inactive. You can reassign those items to another category before activating them again.`
                    : `Are you sure you want to delete "${deleteTarget.name}"?`}
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    disabled={deletingCategory}
                    className="flex-1 rounded-xl border border-slate-300 py-3 font-medium text-slate-700 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteCategory}
                    disabled={deletingCategory}
                    className="flex-1 rounded-xl bg-rose-600 py-3 font-medium text-white disabled:opacity-60"
                  >
                    {deletingCategory ? "Deleting..." : "Delete category"}
                  </button>
                </div>
              </motion.div>
            </div>
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
