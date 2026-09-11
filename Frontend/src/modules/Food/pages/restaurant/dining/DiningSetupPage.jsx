import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Clock, Loader2, Upload, UtensilsCrossed, X, XCircle } from "lucide-react"
import { restaurantAPI, uploadAPI, userAPI } from "@food/api"
import { toast } from "sonner"

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const defaultDaySlot = (day) => ({
  day,
  isOpen: false,
  openingTime: "18:00",
  closingTime: "22:00",
  slotDurationMinutes: 60,
  capacityPerSlot: 20,
})

const buildDefaultSlots = () => DAY_NAMES.map(defaultDaySlot)

const mergeSlots = (savedSlots) => {
  const byDay = new Map((savedSlots || []).map((s) => [s.day, s]))
  return DAY_NAMES.map((day) => ({ ...defaultDaySlot(day), ...(byDay.get(day) || {}) }))
}

export default function DiningSetupPage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [requesting, setRequesting] = useState(false)

  const [slots, setSlots] = useState(buildDefaultSlots())
  const [description, setDescription] = useState("")
  const [avgCostForTwo, setAvgCostForTwo] = useState("")
  const [categoryIds, setCategoryIds] = useState([])
  const [categories, setCategories] = useState([])
  const [saving, setSaving] = useState(false)
  const [togglingLive, setTogglingLive] = useState(false)
  const [ambienceImages, setAmbienceImages] = useState([])
  const [uploadingAmbience, setUploadingAmbience] = useState(false)
  const ambienceFileInputRef = useRef(null)

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getMyDiningProfile()
      const p = response?.data?.data?.profile
      setProfile(p || null)
      if (p) {
        setSlots(mergeSlots(p.slots))
        setDescription(p.description || "")
        setAvgCostForTwo(p.avgCostForTwo ?? "")
        setCategoryIds((p.categoryIds || []).map((c) => (typeof c === "string" ? c : c?._id)).filter(Boolean))
        setAmbienceImages(Array.isArray(p.ambienceImages) ? p.ambienceImages : [])
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load dining status")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProfile() }, [])

  useEffect(() => {
    userAPI.getDiningCategories()
      .then((response) => setCategories(response?.data?.data?.categories || []))
      .catch(() => setCategories([]))
  }, [])

  const handleRequest = async () => {
    try {
      setRequesting(true)
      const response = await restaurantAPI.requestDining()
      if (response?.data?.success) {
        toast.success("Dining request submitted — awaiting admin approval")
        fetchProfile()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to submit dining request")
    } finally {
      setRequesting(false)
    }
  }

  const updateSlot = (day, patch) => {
    setSlots((prev) => prev.map((s) => (s.day === day ? { ...s, ...patch } : s)))
  }

  const toggleCategory = (id) => {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  const handleAmbienceImageSelect = async (event) => {
    const files = Array.from(event.target.files || [])
    if (ambienceFileInputRef.current) ambienceFileInputRef.current.value = ""
    if (!files.length) return

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    const remainingSlots = Math.max(0, 10 - ambienceImages.length)
    const toUpload = files.slice(0, remainingSlots)
    if (files.length > remainingSlots) {
      toast.error("You can add up to 10 ambience images")
    }

    try {
      setUploadingAmbience(true)
      for (const file of toUpload) {
        if (!allowedTypes.includes(file.type)) {
          toast.error(`${file.name}: invalid file type. Please upload PNG, JPG, JPEG, or WEBP.`)
          continue
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name}: file size exceeds 5MB limit.`)
          continue
        }
        const uploadRes = await uploadAPI.uploadMedia(file, { folder: "appzeto/dining-ambience" })
        const url = uploadRes?.data?.data?.url || uploadRes?.data?.url
        if (url) setAmbienceImages((prev) => [...prev, url])
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to upload image")
    } finally {
      setUploadingAmbience(false)
    }
  }

  const removeAmbienceImage = (url) => {
    setAmbienceImages((prev) => prev.filter((img) => img !== url))
  }

  const handleSaveSetup = async () => {
    if (ambienceImages.length === 0) {
      toast.error("Add at least one ambience image before saving")
      return
    }

    for (const slot of slots) {
      if (!slot.isOpen) continue
      if (!slot.openingTime || !slot.closingTime) {
        toast.error(`${slot.day}: opening and closing time are required`)
        return
      }
      if (slot.closingTime <= slot.openingTime) {
        toast.error(`${slot.day}: closing time must be after opening time`)
        return
      }
      if (Number(slot.slotDurationMinutes) < 15) {
        toast.error(`${slot.day}: slot duration must be at least 15 minutes`)
        return
      }
      if (Number(slot.capacityPerSlot) < 1) {
        toast.error(`${slot.day}: capacity per slot must be at least 1 guest`)
        return
      }
    }

    try {
      setSaving(true)
      const response = await restaurantAPI.updateDiningSetup({
        slots,
        description,
        avgCostForTwo: avgCostForTwo === "" ? undefined : Number(avgCostForTwo),
        categoryIds,
        ambienceImages,
      })
      if (response?.data?.success) {
        toast.success("Dining setup saved")
        fetchProfile()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save dining setup")
    } finally {
      setSaving(false)
    }
  }

  const handleToggleLive = async (enabled) => {
    try {
      setTogglingLive(true)
      const response = await restaurantAPI.toggleDiningEnabled(enabled)
      if (response?.data?.success) {
        toast.success(enabled ? "Dining is now live for bookings" : "Dining turned off")
        fetchProfile()
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update dining status")
    } finally {
      setTogglingLive(false)
    }
  }

  const openDaysCount = useMemo(() => slots.filter((s) => s.isOpen).length, [slots])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const status = profile?.status || "not_requested"

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-6">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0f2d5a]">
            <UtensilsCrossed className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dining Setup</h1>
            <p className="text-sm text-slate-500">Let guests book a table and pay their dine-in bill through the app.</p>
          </div>
        </div>
      </div>

      {status === "not_requested" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <UtensilsCrossed className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">Enable Dining for your restaurant</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Submit a request to our team. Once approved, you can configure table capacity and time slots, and start accepting bookings.
          </p>
          <button
            onClick={handleRequest}
            disabled={requesting}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0f2d5a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {requesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UtensilsCrossed className="h-4 w-4" />}
            {requesting ? "Submitting..." : "Request to Enable Dining"}
          </button>
        </div>
      )}

      {status === "pending" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <Clock className="mx-auto h-10 w-10 text-amber-500" />
          <h2 className="mt-3 text-lg font-bold text-amber-900">Awaiting admin approval</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-amber-700">
            Your request to enable Dining is under review. You'll be notified once it's approved.
          </p>
        </div>
      )}

      {status === "rejected" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
          <XCircle className="mx-auto h-10 w-10 text-rose-500" />
          <h2 className="mt-3 text-lg font-bold text-rose-900">Dining request rejected</h2>
          {profile?.rejectionReason && <p className="mx-auto mt-2 max-w-md text-sm text-rose-700">{profile.rejectionReason}</p>}
          <button
            onClick={handleRequest}
            disabled={requesting}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0f2d5a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {requesting ? "Submitting..." : "Request Again"}
          </button>
        </div>
      )}

      {status === "approved" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <div>
                <p className="font-semibold text-slate-900">Dining approved</p>
                <p className="text-sm text-slate-500">{openDaysCount} day(s) configured with open slots</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-600">{profile?.isDiningEnabled ? "Live" : "Off"}</span>
              <button
                onClick={() => handleToggleLive(!profile?.isDiningEnabled)}
                disabled={togglingLive}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${profile?.isDiningEnabled ? "bg-emerald-600" : "bg-slate-300"} disabled:opacity-60`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${profile?.isDiningEnabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Table Capacity &amp; Slots</h2>
            <div className="space-y-3">
              {slots.map((slot) => (
                <div key={slot.day} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={slot.isOpen}
                        onChange={(event) => updateSlot(slot.day, { isOpen: event.target.checked })}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {slot.day}
                    </label>
                  </div>
                  {slot.isOpen && (
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Opens</label>
                        <input
                          type="time"
                          value={slot.openingTime}
                          onChange={(event) => updateSlot(slot.day, { openingTime: event.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Closes</label>
                        <input
                          type="time"
                          value={slot.closingTime}
                          onChange={(event) => updateSlot(slot.day, { closingTime: event.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Slot length (min)</label>
                        <input
                          type="number"
                          min="15"
                          step="15"
                          value={slot.slotDurationMinutes}
                          onChange={(event) => updateSlot(slot.day, { slotDurationMinutes: event.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-500">Guests / slot</label>
                        <input
                          type="number"
                          min="1"
                          value={slot.capacityPerSlot}
                          onChange={(event) => updateSlot(slot.day, { capacityPerSlot: event.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Dining Details</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Tell guests about the ambience, cuisine, and experience..."
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Ambience Photos *</label>
                <p className="mb-3 text-xs text-slate-400">At least one photo is required — guests see these before booking.</p>
                <div className="flex flex-wrap gap-3">
                  {ambienceImages.map((url) => (
                    <div key={url} className="relative h-24 w-24 overflow-hidden rounded-xl border border-slate-300">
                      <img src={url} alt="Ambience" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeAmbienceImage(url)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {ambienceImages.length < 10 && (
                    <label
                      htmlFor="dining-ambience-upload"
                      className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:border-[#0f2d5a] hover:text-[#0f2d5a]"
                    >
                      {uploadingAmbience ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                      <span className="text-[10px] font-medium">{uploadingAmbience ? "Uploading..." : "Add Photo"}</span>
                    </label>
                  )}
                  <input
                    ref={ambienceFileInputRef}
                    id="dining-ambience-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    multiple
                    onChange={handleAmbienceImageSelect}
                    className="hidden"
                    disabled={uploadingAmbience}
                  />
                </div>
              </div>
              <div className="max-w-xs">
                <label className="mb-2 block text-sm font-medium text-slate-700">Average cost for two (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={avgCostForTwo}
                  onChange={(event) => setAvgCostForTwo(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-slate-900"
                />
              </div>
              {categories.length > 0 && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => {
                      const id = cat._id || cat.id
                      const selected = categoryIds.includes(id)
                      return (
                        <button
                          type="button"
                          key={id}
                          onClick={() => toggleCategory(id)}
                          className={`flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition-colors ${selected ? "border-[#0f2d5a] bg-[#0f2d5a] text-white" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
                        >
                          <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-slate-100">
                            {cat.image ? (
                              <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-400">
                                {String(cat.name || "C").slice(0, 1).toUpperCase()}
                              </span>
                            )}
                          </span>
                          {cat.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleSaveSetup}
              disabled={saving || uploadingAmbience}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0f2d5a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Saving..." : "Save Dining Setup"}
            </button>
            {!profile?.isDiningEnabled && (
              <p className="mt-2 text-xs text-slate-400">Save your setup, then turn Dining "Live" above once you're ready to accept bookings.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
