import { useEffect, useMemo, useState } from "react"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, Clock3, Edit2, Loader2, Plus, Trash2, X } from "lucide-react"
import { restaurantAPI } from "@food/api"
import { toast } from "sonner"

const defaultFormData = {
  name: "",
  startTime: "",
  endTime: "",
}

const formatDisplayTime = (hhmm = "") => {
  const [hoursRaw, minutesRaw] = String(hhmm || "").split(":")
  const hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return hhmm
  const suffix = hours >= 12 ? "PM" : "AM"
  const hour12 = hours % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`
}

const formatDateTime = (value) => {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return "—"
  }
}

export default function ItemSlotTimingsPage() {
  const goBack = useRestaurantBackNavigation()
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSlot, setEditingSlot] = useState(null)
  const [formData, setFormData] = useState(defaultFormData)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const sortedSlots = useMemo(
    () => [...slots].sort((a, b) => String(a.startTime).localeCompare(String(b.startTime))),
    [slots],
  )

  const fetchSlots = async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getItemSlotTimings()
      const nextSlots = response?.data?.data?.slots || response?.data?.slots || []
      setSlots(Array.isArray(nextSlots) ? nextSlots : [])
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load item slot timings")
      setSlots([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSlots()
  }, [])

  const openCreateModal = () => {
    setEditingSlot(null)
    setFormData(defaultFormData)
    setShowModal(true)
  }

  const openEditModal = (slot) => {
    setEditingSlot(slot)
    setFormData({
      name: slot?.name || "",
      startTime: slot?.startTime || "",
      endTime: slot?.endTime || "",
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingSlot(null)
    setFormData(defaultFormData)
  }

  const handleSave = async () => {
    const name = String(formData.name || "").trim()
    if (!name) {
      toast.error("Slot name is required")
      return
    }
    if (!formData.startTime) {
      toast.error("Start time is required")
      return
    }
    if (!formData.endTime) {
      toast.error("End time is required")
      return
    }

    try {
      setSaving(true)
      const payload = {
        name,
        startTime: formData.startTime,
        endTime: formData.endTime,
      }

      if (editingSlot?.id) {
        await restaurantAPI.updateItemSlotTiming(editingSlot.id, payload)
        toast.success("Slot updated successfully")
      } else {
        await restaurantAPI.createItemSlotTiming(payload)
        toast.success("Slot created successfully")
      }

      closeModal()
      await fetchSlots()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save slot")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget?.id) return
    try {
      setDeleting(true)
      const response = await restaurantAPI.deleteItemSlotTiming(deleteTarget.id)
      const unlinked = response?.data?.data?.unlinkedItemCount ?? response?.data?.unlinkedItemCount ?? 0
      toast.success(
        unlinked > 0
          ? `Slot deleted. ${unlinked} linked item(s) are now always available.`
          : "Slot deleted successfully",
      )
      setDeleteTarget(null)
      await fetchSlots()
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete slot")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="rounded-full p-2 hover:bg-slate-100"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-slate-700" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Item slot timings</h1>
              <p className="text-sm text-slate-500">Create reusable slots like Breakfast, Lunch, and Dinner.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-[#FF0000] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#E64D02]"
          >
            <Plus className="h-4 w-4" />
            Add slot
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        ) : sortedSlots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <Clock3 className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">No slots created yet</h2>
            <p className="mt-2 text-sm text-slate-500">
              Add slots and assign them to menu items to control when customers can see them.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#FF0000] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#E64D02]"
            >
              <Plus className="h-4 w-4" />
              Create first slot
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Slot name</th>
                    <th className="px-4 py-3">Start time</th>
                    <th className="px-4 py-3">End time</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSlots.map((slot) => (
                    <tr key={slot.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-4 py-4 font-semibold text-slate-900">{slot.name}</td>
                      <td className="px-4 py-4 text-slate-700">{formatDisplayTime(slot.startTime)}</td>
                      <td className="px-4 py-4 text-slate-700">{formatDisplayTime(slot.endTime)}</td>
                      <td className="px-4 py-4 text-slate-500">{formatDateTime(slot.createdAt)}</td>
                      <td className="px-4 py-4 text-slate-500">{formatDateTime(slot.updatedAt)}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(slot)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(slot)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              className="fixed inset-0 z-40 bg-black/50"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="fixed inset-x-4 top-[10vh] z-50 mx-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-5 shadow-2xl md:inset-x-auto md:left-1/2 md:top-1/2 md:w-full md:-translate-x-1/2 md:-translate-y-1/2"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  {editingSlot ? "Edit slot" : "Create slot"}
                </h2>
                <button type="button" onClick={closeModal} className="rounded-full p-2 hover:bg-slate-100">
                  <X className="h-5 w-5 text-slate-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Slot name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Breakfast"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Start time</label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">End time</label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData((prev) => ({ ...prev, endTime: e.target.value }))}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-[#FF0000] px-4 py-3 text-sm font-semibold text-white hover:bg-[#E64D02] disabled:opacity-60"
                >
                  {saving ? "Saving..." : editingSlot ? "Update slot" : "Create slot"}
                </button>
              </div>
            </motion.div>
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
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setDeleteTarget(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="fixed inset-x-4 top-[20vh] z-50 mx-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-5 shadow-2xl md:inset-x-auto md:left-1/2 md:top-1/2 md:w-full md:-translate-x-1/2 md:-translate-y-1/2"
            >
              <h3 className="text-lg font-bold text-slate-900">Delete slot?</h3>
              <p className="mt-2 text-sm text-slate-600">
                Delete <span className="font-semibold">{deleteTarget.name}</span>? Items linked to this slot will become always available.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
