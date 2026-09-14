import { useEffect, useMemo, useState } from "react"
import { Eye, Loader2, Search, Trash2, Pencil } from "lucide-react"
import { Switch } from "@food/components/ui/switch"
import { adminAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
import { useAuth } from "@core/context/AuthContext"
import { getCurrentUser } from "@food/utils/auth"
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"

const debugError = (...args) => {}

const getItemCreatedMs = (item = {}) => {
  const direct = [item.requestedAt, item.createdAt, item.updatedAt]
    .map((v) => new Date(v).getTime())
    .find((ms) => Number.isFinite(ms) && ms > 0)
  return direct || 0
}

const formatAddonId = (id) => {
  if (!id) return "ADDON000000"
  const idString = String(id)
  const digits = idString.match(/\d+/g)
  const combined = digits ? digits.join("") : ""
  const lastDigits = combined ? combined.slice(-6).padStart(6, "0") : "000000"
  return `ADDON${lastDigits}`
}

const getAddonTitle = (addon) => addon?.draft?.name || addon?.name || "Unnamed Add-on"
const getAddonImage = (addon) =>
  addon?.draft?.image ||
  addon?.draft?.images?.[0] ||
  addon?.published?.image ||
  addon?.published?.images?.[0] ||
  "https://via.placeholder.com/40"

export default function AddonsList() {
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

  const canEdit = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::food_management::foods::addons", "edit")
  }, [currentUser, resolvedPermissions])

  const canDelete = useMemo(() => {
    return canPerformAdminPermissionAction(currentUser, resolvedPermissions, "food::food_management::foods::addons", "delete")
  }, [currentUser, resolvedPermissions])

  const [searchQuery, setSearchQuery] = useState("")
  const [addons, setAddons] = useState([])
  const [loading, setLoading] = useState(true)
  const [submittingAction, setSubmittingAction] = useState(false)

  const [selectedAddon, setSelectedAddon] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingAddon, setEditingAddon] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: "", price: "", description: "", isAvailable: true })
  const [editImagePreview, setEditImagePreview] = useState("")
  const [editImageFile, setEditImageFile] = useState(null)

  useEffect(() => {
    const fetchAddons = async () => {
      try {
        setLoading(true)
        const response = await adminAPI.getRestaurantAddons({
          // only approved items should be visible in this list
          approvalStatus: "approved",
          search: searchQuery?.trim() ? searchQuery.trim() : undefined,
          limit: 200,
          page: 1,
        })
        const data = response?.data?.data?.addons || response?.data?.addons || []
        const approvedOnly = Array.isArray(data)
          ? data.filter((addon) => String(addon.approvalStatus || "").toLowerCase() === "approved")
          : []
        setAddons(approvedOnly)
      } catch (error) {
        debugError("Error fetching addons:", error)
        toast.error("Failed to load restaurant add-ons")
        setAddons([])
      } finally {
        setLoading(false)
      }
    }

    const t = setTimeout(fetchAddons, 250)
    return () => clearTimeout(t)
  }, [searchQuery])

  const filteredAddons = useMemo(() => {
    const result = Array.isArray(addons) ? [...addons] : []
    result.sort((a, b) => getItemCreatedMs(b) - getItemCreatedMs(a))
    return result
  }, [addons])

  const countLabel = filteredAddons.length

  const handleViewDetails = (addon) => {
    setSelectedAddon(addon)
    setShowDetailModal(true)
  }

  const handleEdit = (addon) => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    setEditingAddon(addon)
    setEditForm({
      name: addon?.draft?.name || addon?.name || "",
      price: addon?.draft?.price ?? addon?.price ?? "",
      description: addon?.draft?.description || addon?.description || "",
      isAvailable: addon?.isAvailable !== false,
    })
    const img =
      addon?.draft?.image ||
      (Array.isArray(addon?.draft?.images) && addon.draft.images[0]) ||
      addon?.image ||
      (Array.isArray(addon?.images) && addon.images[0]) ||
      ""
    setEditImagePreview(img || "")
    setEditImageFile(null)
    setShowEditModal(true)
  }

  const handleSaveEdit = async () => {
    if (!canEdit) {
      toast.error("Permission denied")
      return
    }
    const id = editingAddon?.id || editingAddon?._id
    if (!id) return
    if (!editForm.name.trim()) {
      toast.error("Name is required")
      return
    }
    const priceNum = Number(editForm.price)
    if (Number.isNaN(priceNum) || priceNum < 0) {
      toast.error("Enter a valid price")
      return
    }
    try {
      setSubmittingAction(true)
      let imageUrl = editImagePreview || ""
      // If a new file selected, upload it
      if (editImageFile) {
        const uploadRes = await uploadAPI.uploadMedia(editImageFile, { folder: "appzeto/admin/addons" })
        imageUrl = uploadRes?.data?.data?.url || uploadRes?.data?.url || imageUrl
      }

      await adminAPI.updateRestaurantAddon(String(id), {
        name: editForm.name.trim(),
        price: priceNum,
        description: editForm.description.trim(),
        isAvailable: editForm.isAvailable,
        image: imageUrl,
        images: imageUrl ? [imageUrl] : [],
      })
      setAddons((prev) =>
        (prev || []).map((a) =>
          String(a.id || a._id) === String(id)
            ? {
                ...a,
                ...editForm,
                price: priceNum,
                name: editForm.name.trim(),
                description: editForm.description.trim(),
                image: imageUrl || a.image,
                images: imageUrl ? [imageUrl] : a.images,
              }
            : a,
        ),
      )
      toast.success("Add-on updated")
      setShowEditModal(false)
      setEditingAddon(null)
      setEditImageFile(null)
    } catch (error) {
      debugError("Update add-on failed:", error)
      toast.error(error?.response?.data?.message || "Failed to update add-on")
    } finally {
      setSubmittingAction(false)
    }
  }

  const [pendingDelete, setPendingDelete] = useState(null)

  const confirmDelete = async () => {
    if (!canDelete) {
      toast.error("Permission denied")
      return
    }
    if (!pendingDelete) return
    const id = pendingDelete?.id || pendingDelete?._id
    try {
      setSubmittingAction(true)
      await adminAPI.rejectRestaurantAddon(String(id), "Deleted by admin")
      setAddons((prev) => (prev || []).filter((a) => String(a.id || a._id) !== String(id)))
      toast.success("Add-on deleted")
    } catch (error) {
      debugError("Delete add-on failed:", error)
      toast.error(error?.response?.data?.message || "Failed to delete add-on")
    } finally {
      setSubmittingAction(false)
      setPendingDelete(null)
    }
  }

  const handleDelete = (addon) => {
    if (!canDelete) {
      toast.error("Permission denied")
      return
    }
    setPendingDelete(addon)
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Restaurant add-ons</h1>
            <div className="text-sm text-slate-500 mt-1">Manage add-ons submitted by restaurants.</div>
          </div>

          <div className="flex items-center gap-2" />
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search add-ons or restaurant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
            />
          </div>
          <div className="text-sm text-slate-600">
            Showing <span className="font-semibold">{countLabel}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  SL
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Image
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Restaurant
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                      <p className="text-sm text-slate-500">Loading add-ons...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredAddons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                      <p className="text-sm text-slate-500">No add-ons match your search</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAddons.map((addon, index) => (
                  <tr key={String(addon.id || addon._id)} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-700">{index + 1}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                        <img
                          src={getAddonImage(addon)}
                          alt={getAddonTitle(addon)}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.src = "https://via.placeholder.com/40"
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">{getAddonTitle(addon)}</span>
                        <span className="text-xs text-slate-500">ID #{formatAddonId(addon.id || addon._id)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-slate-900">{addon?.restaurant?.name || "-"}</span>
                        {addon?.restaurant?.ownerPhone ? (
                          <span className="text-xs text-slate-500">{addon.restaurant.ownerPhone}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-900">
                        ₹{Number(addon?.draft?.price ?? addon?.price ?? 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleViewDetails(addon)}
                          className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleEdit(addon)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(addon)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <DialogTitle className="text-lg font-semibold text-slate-900">Add-on Details</DialogTitle>
          </DialogHeader>
          {selectedAddon && (
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-4">
                <img
                  src={getAddonImage(selectedAddon)}
                  alt={getAddonTitle(selectedAddon)}
                  className="w-20 h-20 rounded-xl object-cover border border-slate-200"
                  onError={(e) => {
                    e.target.src = "https://via.placeholder.com/64"
                  }}
                />
                <div>
                  <p className="text-lg font-semibold text-slate-900">{getAddonTitle(selectedAddon)}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    ID #{formatAddonId(selectedAddon.id || selectedAddon._id)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p>
                  <span className="font-semibold text-slate-700">Restaurant:</span>{" "}
                  <span className="text-slate-900">{selectedAddon?.restaurant?.name || "-"}</span>
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Price:</span>{" "}
                  <span className="text-slate-900">₹{Number(selectedAddon?.draft?.price ?? 0).toFixed(2)}</span>
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Available:</span>{" "}
                  <span className="text-slate-900">{selectedAddon?.isAvailable ? "Yes" : "No"}</span>
                </p>
              </div>

              {selectedAddon?.draft?.description ? (
                <p className="text-sm text-slate-700 leading-relaxed">
                  <span className="font-semibold text-slate-800">Description:</span> {selectedAddon.draft.description}
                </p>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <DialogTitle className="text-lg font-semibold text-slate-900">Edit Add-on</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              {editImagePreview ? (
                <img
                  src={editImagePreview}
                  alt="Preview"
                  className="w-16 h-16 rounded-md object-cover border"
                  onError={(e) => (e.target.style.display = "none")}
                />
              ) : (
                <div className="w-16 h-16 rounded-md border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-500">
                  No image
                </div>
              )}
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Change Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const preview = URL.createObjectURL(file)
                    setEditImageFile(file)
                    setEditImagePreview(preview)
                  }}
                  className="text-sm"
                  disabled={!canEdit || submittingAction}
                />
                <p className="text-xs text-slate-500">PNG, JPG, WEBP up to 5MB</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editForm.price}
                onChange={(e) => setEditForm((prev) => ({ ...prev, price: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                disabled={!canEdit}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editForm.isAvailable}
                onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, isAvailable: checked }))}
                disabled={!canEdit}
              />
              <span className="text-sm text-slate-700">Available</span>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={submittingAction || !canEdit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingAction ? "Saving..." : "Save"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="max-w-md w-full rounded-xl p-0 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <DialogTitle className="text-lg font-semibold text-slate-900">Delete add-on?</DialogTitle>
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="px-5 pt-4 pb-2">
            <p className="text-sm text-slate-700">This action cannot be undone.</p>
          </div>
          <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors"
            >
              No
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={submittingAction || !canDelete}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingAction ? "Deleting..." : "Yes, delete"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

