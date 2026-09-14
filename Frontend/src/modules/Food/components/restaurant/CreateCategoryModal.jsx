import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Upload, X } from "lucide-react"
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

export default function CreateCategoryModal({
  isOpen,
  onClose,
  onCreated,
  isPureVegRestaurant = false,
}) {
  const [formData, setFormData] = useState(defaultFormData)
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    setFormData(isPureVegRestaurant ? { ...defaultFormData, foodTypeScope: "Veg" } : defaultFormData)
    setSelectedImageFile(null)
    setImagePreview(null)
    setUploadingImage(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [isOpen, isPureVegRestaurant])

  useEffect(() => {
    if (!isOpen || !isPureVegRestaurant) return
    setFormData((prev) => (
      prev.foodTypeScope === "Veg" ? prev : { ...prev, foodTypeScope: "Veg" }
    ))
  }, [isOpen, isPureVegRestaurant])

  const handleClose = () => {
    if (uploadingImage) return
    onClose?.()
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

      const response = await restaurantAPI.createCategory(payload)
      const created = response?.data?.data?.category || response?.data?.category || null
      toast.success("Category created and sent for admin approval")
      onCreated?.(created)
      handleClose()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save category")
    } finally {
      setUploadingImage(false)
    }
  }

  const formFields = (
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

  const formActions = (
    <div className="mt-6 flex gap-3">
      <button
        type="button"
        onClick={handleClose}
        disabled={uploadingImage}
        className="flex-1 rounded-xl border border-slate-300 py-3 font-medium text-slate-700 disabled:opacity-60"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleSaveCategory}
        disabled={uploadingImage}
        className="flex-1 rounded-xl bg-slate-900 py-3 font-medium text-white disabled:opacity-60"
      >
        {uploadingImage ? "Creating..." : "Create"}
      </button>
    </div>
  )

  const modalHeader = (
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Create Category</h2>
        <p className="text-xs text-slate-500 lg:text-sm">
          Choose the diet scope carefully before sending it for approval.
        </p>
      </div>
      <button type="button" onClick={handleClose} className="rounded-full p-1 hover:bg-slate-100">
        <X className="h-5 w-5 text-slate-600" />
      </button>
    </div>
  )

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 z-[80] bg-black/50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="fixed bottom-0 left-0 right-0 z-[81] max-h-[90vh] overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl lg:hidden"
            >
              {modalHeader}
              {formFields}
              {formActions}
            </motion.div>
            <div className="fixed inset-0 z-[81] hidden lg:flex items-center justify-center p-6 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                className="pointer-events-auto w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                {modalHeader}
                {formFields}
                {formActions}
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
    </>
  )
}
