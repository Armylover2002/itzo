import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  BadgeCheck,
  Download,
  Globe,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { adminAPI, uploadAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { toast } from "sonner"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

const defaultFormData = {
  name: "",
  image: "",
  status: true,
  type: "",
  zoneId: "global",
  foodTypeScope: "Both",
}

const approvalBadgeClass = (status) => {
  const value = String(status || "pending").toLowerCase()
  if (value === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (value === "rejected") return "bg-rose-50 text-rose-700 border-rose-200"
  return "bg-amber-50 text-amber-700 border-amber-200"
}

const scopeBadgeClass = (scope) => {
  if (scope === "Veg") return "bg-green-50 text-green-700 border-green-200"
  if (scope === "Non-Veg") return "bg-red-50 text-red-700 border-red-200"
  return "bg-slate-100 text-slate-700 border-slate-200"
}

const zoneLabel = (zone) => {
  if (!zone) return "Global"
  if (typeof zone === "string") {
    const value = zone.trim()
    if (/^[a-f0-9]{24}$/i.test(value)) return `Zone ID ${value.slice(-6)}`
    return value
  }
  return zone?.name || zone?.zoneName || zone?.serviceLocation || "Zone"
}

export default function Category() {
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

    return () => {
      isMounted = false
    }
  }, [currentUser])

  const canCreate = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::food_management::categories::list", "create")
  }, [currentUser, resolvedPermissions])

  const canEdit = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::food_management::categories::list", "edit")
  }, [currentUser, resolvedPermissions])

  const canDelete = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::food_management::categories::list", "delete")
  }, [currentUser, resolvedPermissions])

  const [searchQuery, setSearchQuery] = useState("")
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPendingOnly, setShowPendingOnly] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [zones, setZones] = useState([])
  const [zonesLoading, setZonesLoading] = useState(false)
  const [formData, setFormData] = useState(defaultFormData)
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const adminToken = localStorage.getItem("admin_accessToken")
    if (!adminToken) {
      toast.error("Please login to access categories")
      setLoading(false)
      return
    }
    fetchCategories()
  }, [])

  useEffect(() => {
    let cancelled = false
    setZonesLoading(true)
    adminAPI
      .getZones({ limit: 1000 })
      .then((res) => {
        const list =
          res?.data?.data?.zones ||
          res?.data?.data?.data?.zones ||
          res?.data?.data ||
          []
        if (!cancelled) setZones(Array.isArray(list) ? list : [])
      })
      .catch(() => {
        if (!cancelled) setZones([])
      })
      .finally(() => {
        if (!cancelled) setZonesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchCategories()
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchQuery, showPendingOnly])

  const filteredCategories = useMemo(() => {
    const query = String(searchQuery || "").trim().toLowerCase()
    if (!query) return categories
    return categories.filter((category) => {
      const creator = category?.createdByRestaurant?.name || category?.restaurant?.name || ""
      return (
        String(category?.name || "").toLowerCase().includes(query) ||
        String(category?.foodTypeScope || "").toLowerCase().includes(query) ||
        String(creator || "").toLowerCase().includes(query) ||
        String(category?.id || "").toLowerCase().includes(query)
      )
    })
  }, [categories, searchQuery])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const params = {}
      if (searchQuery) params.search = searchQuery
      if (showPendingOnly) params.approvalStatus = "pending"

      const response = await adminAPI.getCategories(params)
      const list = response?.data?.data?.categories || response?.data?.categories || []
      setCategories(Array.isArray(list) ? list : [])
    } catch (error) {
      if (error?.response?.status === 401) {
        toast.error("Authentication required. Please login again.")
      } else if (error?.response?.status === 403) {
        toast.error("Access denied. You do not have permission.")
      } else if (error?.response?.status === 404) {
        toast.error("Categories endpoint not found. Please check backend server.")
      } else if (error?.code === "ERR_NETWORK" || error?.message === "Network Error") {
        toast.error("Cannot connect to server. Please check if backend is running on " + API_BASE_URL.replace("/api", ""))
      } else {
        toast.error(error?.response?.data?.message || "Failed to load categories")
      }
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  const resetModal = () => {
    setIsModalOpen(false)
    setEditingCategory(null)
    setFormData(defaultFormData)
    setSelectedImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleAddNew = () => {
    if (!canCreate) {
      toast.error("Permission denied")
      return
    }
    setEditingCategory(null)
    setFormData(defaultFormData)
    setSelectedImageFile(null)
    setImagePreview(null)
    setIsModalOpen(true)
  }

  const handleEdit = (category) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    setEditingCategory(category)
    const zoneIdValue =
      typeof category?.zoneId === "string"
        ? category.zoneId
        : category?.zoneId?._id || category?.zoneId?.id || "global"

    setFormData({
      name: category?.name || "",
      image: category?.image || "",
      status: category?.status !== false,
      type: category?.type || "",
      zoneId: zoneIdValue || "global",
      foodTypeScope: category?.foodTypeScope || "Both",
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
    reader.onloadend = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const handleToggleStatus = async (id) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    try {
      const response = await adminAPI.toggleCategoryStatus(String(id))
      if (response?.data?.success) {
        toast.success("Category status updated successfully")
        fetchCategories()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update category status")
    }
  }

  const handleApprove = async (id) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    try {
      const response = await adminAPI.approveCategory(String(id))
      if (response?.data?.success) {
        toast.success("Category approved successfully")
        fetchCategories()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to approve category")
    }
  }

  const handleReject = async (category) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    const reason = window.prompt(`Reject "${category?.name}" with a reason:`)
    if (reason == null) return
    if (!String(reason).trim()) {
      toast.error("Rejection reason is required")
      return
    }

    try {
      const response = await adminAPI.rejectCategory(String(category?.id || category?._id), reason)
      if (response?.data?.success) {
        toast.success("Category rejected successfully")
        fetchCategories()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to reject category")
    }
  }

  const handleMakeGlobal = async (category) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    if (!window.confirm(`Make "${category?.name}" global for every restaurant?`)) return

    try {
      const response = await adminAPI.makeCategoryGlobal(String(category?.id || category?._id))
      if (response?.data?.success) {
        toast.success("Category is now global")
        fetchCategories()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to make category global")
    }
  }

  const handleDelete = async (id) => {
    if (!canDelete) {
      toast.error("Permission denied")
      return
    }
    const categoryName = categories.find((category) => String(category?.id) === String(id))?.name || "this category"
    if (!window.confirm(`Delete "${categoryName}"? This action cannot be undone.`)) return

    try {
      const response = await adminAPI.deleteCategory(String(id))
      if (response?.data?.success) {
        toast.success("Category deleted successfully")
        fetchCategories()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete category")
    }
  }

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.setTextColor(30, 30, 30)
      doc.text("Category List", 14, 20)
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Generated on: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 14, 28)

      const tableData = filteredCategories.map((category, index) => [
        index + 1,
        category?.name || "N/A",
        category?.foodTypeScope || "Both",
        category?.isGlobal ? "Global" : "Private",
        zoneLabel(category?.zoneId),
        category?.approvalStatus || "pending",
      ])

      autoTable(doc, {
        startY: 35,
        head: [["SL", "Category", "Diet Scope", "Visibility", "Zone", "Approval"]],
        body: tableData,
        theme: "striped",
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 10,
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [30, 30, 30],
        },
      })

      doc.save(`Categories_${new Date().toISOString().split("T")[0]}.pdf`)
      toast.success("PDF exported successfully!")
    } catch {
      toast.error("Failed to export PDF")
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (editingCategory && !canEdit) {
      toast.error("Permission denied")
      return
    }
    if (!editingCategory && !canCreate) {
      toast.error("Permission denied")
      return
    }

    try {
      setUploadingImage(true)
      let imageUrl = String(formData.image || "").trim()

      if (selectedImageFile) {
        const uploadRes = await uploadAPI.uploadMedia(selectedImageFile, { folder: "appzeto/categories" })
        const payload = uploadRes?.data?.data || uploadRes?.data
        imageUrl = payload?.url || imageUrl
      }

      const payload = {
        name: String(formData.name || "").trim(),
        type: String(formData.type || "").trim(),
        status: Boolean(formData.status),
        image: imageUrl || undefined,
        zoneId: formData.zoneId || "global",
        foodTypeScope: formData.foodTypeScope,
      }

      if (editingCategory) {
        const response = await adminAPI.updateCategory(editingCategory.id, payload)
        if (response?.data?.success) toast.success("Category updated successfully")
      } else {
        const response = await adminAPI.createCategory(payload)
        if (response?.data?.success) toast.success("Category created successfully")
      }

      resetModal()
      fetchCategories()
    } catch (error) {
      if (error?.code === "ERR_NETWORK" || error?.message === "Network Error") {
        toast.error("Cannot connect to server. Please check if backend is running on " + API_BASE_URL.replace("/api", ""))
      } else {
        toast.error(error?.response?.data?.message || "Failed to save category")
      }
    } finally {
      setUploadingImage(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Restaurant-created categories now move through approval, rejection, and optional globalization before every
              restaurant can use them.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 p-1">
              <button
                type="button"
                onClick={() => setShowPendingOnly(false)}
                className={`rounded-full px-3 py-2 text-xs font-semibold ${!showPendingOnly ? "bg-slate-900 text-white" : "text-slate-600"}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setShowPendingOnly(true)}
                className={`rounded-full px-3 py-2 text-xs font-semibold ${showPendingOnly ? "bg-amber-600 text-white" : "text-slate-600"}`}
              >
                Pending
              </button>
            </div>

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

            <button
              onClick={handleExportPDF}
              disabled={filteredCategories.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>

            {canCreate && (
              <button
                onClick={handleAddNew}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white"
              >
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
                <th className="w-[25%] px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Category</th>
                <th className="w-[17%] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Owner</th>
                <th className="w-[15%] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Zone</th>
                <th className="w-[10%] px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">Diet</th>
                <th className="w-[10%] px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">Status</th>
                <th className="w-[13%] px-4 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">Approval</th>
                <th className="w-[20%] px-5 py-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-sm text-slate-500">Loading categories...</p>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
                    <p className="text-lg font-semibold text-slate-700">No categories found</p>
                    <p className="mt-1 text-sm text-slate-500">Try a different search or create a new category.</p>
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category) => {
                  const creatorName = category?.createdByRestaurant?.name || category?.restaurant?.name || "ECS"
                  const approvalStatus = category?.approvalStatus || "pending"
                  const isRestaurantCategory = Boolean(category?.createdByRestaurantId || category?.restaurantId)
                  const zoneText = zoneLabel(category?.zoneId)

                  return (
                    <tr key={category.id} className="align-top hover:bg-slate-50/80">
                      <td className="px-5 py-5">
                        <div className="flex items-start gap-3">
                          <div className="h-11 w-11 overflow-hidden rounded-2xl bg-slate-100">
                            {category?.image ? (
                              <img src={category.image} alt={category.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-500">
                                {String(category?.name || "C").slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-lg font-semibold leading-6 text-slate-900">{category?.name || "-"}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                              <span>{category?.type || "No type"}</span>
                              <span className="text-slate-300">•</span>
                              <span>Items linked: {category?.itemCount || 0}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5 text-sm text-slate-600">
                        <div className="space-y-1">
                          <p className="font-medium leading-6 text-slate-800">{creatorName}</p>
                          <p className="text-xs text-slate-400">
                            {category?.isGlobal ? "Global category" : "Private to creator"}
                          </p>
                          {category?.isGlobal && isRestaurantCategory && (
                            <span className="inline-flex items-center rounded-full border border-[#d8c4f1] bg-[#f7f3fc] px-2 py-1 text-[11px] font-semibold text-[#460d8b]">
                              <Globe className="mr-1 h-3.5 w-3.5" />
                              Shared
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <div className="max-w-[180px]">
                          <p className="truncate text-sm font-medium text-slate-700" title={zoneText}>
                            {zoneText}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${scopeBadgeClass(category?.foodTypeScope)}`}>
                          {category?.foodTypeScope || "Both"}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-center">
                        <button
                          onClick={() => handleToggleStatus(category.id)}
                          disabled={!canEdit}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full ${category?.status ? "bg-primary" : "bg-slate-300"} ${!canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                          title={category?.status ? "Deactivate" : "Activate"}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${category?.status ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </td>
                      <td className="px-4 py-5">
                        <div className="space-y-2">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${approvalBadgeClass(approvalStatus)}`}>
                            {approvalStatus === "approved" && <BadgeCheck className="mr-1 h-3.5 w-3.5" />}
                            {approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1)}
                          </span>
                          {category?.rejectionReason && (
                            <p className="max-w-[180px] text-xs leading-5 text-rose-600">{category.rejectionReason}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex flex-wrap justify-end gap-2">
                            {canEdit && approvalStatus !== "approved" && (
                              <button
                                onClick={() => handleApprove(category.id)}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                              >
                                Approve
                              </button>
                            )}
                            {canEdit && isRestaurantCategory && approvalStatus !== "rejected" && (
                              <button
                                onClick={() => handleReject(category)}
                                className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                              >
                                Reject
                              </button>
                            )}
                            {canEdit && isRestaurantCategory && !category?.isGlobal && approvalStatus === "approved" && (
                              <button
                                onClick={() => handleMakeGlobal(category)}
                                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                              >
                                Make Global
                              </button>
                            )}
                          </div>
                          <div className="flex items-center justify-end gap-1">
                            {canEdit && (
                              <button
                                onClick={() => handleEdit(category)}
                                className="rounded-lg p-2 text-primary hover:bg-[#f7f3fc]"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleDelete(category.id)}
                                className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
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
                    className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl max-h-[min(720px,calc(100vh-32px))]"
                  >
                    <div className="flex items-center justify-between border-b px-6 py-4">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">{editingCategory ? "Edit Category" : "Add Category"}</h2>
                        <p className="text-xs text-slate-500">
                          Admin categories are approved immediately. Restaurant-created categories can also be updated here.
                        </p>
                      </div>
                      <button onClick={resetModal} className="rounded-lg p-1 hover:bg-slate-100">
                        <X className="h-5 w-5 text-slate-500" />
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Zone</label>
                          <select
                            value={formData.zoneId}
                            onChange={(event) => setFormData((prev) => ({ ...prev, zoneId: event.target.value }))}
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900"
                          >
                            <option value="global">Global (all zones)</option>
                            {zonesLoading && <option value="" disabled>Loading zones...</option>}
                            {zones.map((zone) => {
                              const id = String(zone?._id || zone?.id || "")
                              const label = zone?.name || zone?.zoneName || zone?.serviceLocation || id
                              return (
                                <option key={id} value={id}>
                                  {label}
                                </option>
                              )
                            })}
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Diet Scope</label>
                          <select
                            value={formData.foodTypeScope}
                            onChange={(event) => setFormData((prev) => ({ ...prev, foodTypeScope: event.target.value }))}
                            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-slate-900"
                          >
                            <option value="Veg">Veg</option>
                            <option value="Non-Veg">Non-Veg</option>
                            <option value="Both">Both</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Category Type</label>
                          <input
                            type="text"
                            value={formData.type}
                            onChange={(event) => setFormData((prev) => ({ ...prev, type: event.target.value }))}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                            placeholder="Examples: Starters, Desserts, Drinks"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Category Name</label>
                          <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                            placeholder="Enter category name"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">Category Image</label>
                          <div className="space-y-3">
                            {(imagePreview || formData.image) && (
                              <div className="relative h-32 w-32 overflow-hidden rounded-2xl border border-slate-300">
                                <img
                                  src={imagePreview || formData.image}
                                  alt="Category preview"
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                onChange={handleImageSelect}
                                className="hidden"
                                id="category-image-upload"
                              />
                              <label
                                htmlFor="category-image-upload"
                                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700"
                              >
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
                            checked={formData.status}
                            onChange={(event) => setFormData((prev) => ({ ...prev, status: event.target.checked }))}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Active Status
                        </label>
                      </div>

                      <div className="flex items-center gap-3 border-t bg-white px-6 py-4">
                        <button
                          type="button"
                          onClick={resetModal}
                          className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex-1 rounded-xl bg-primary px-4 py-3 text-white"
                        >
                          {editingCategory ? "Update" : "Create"}
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
