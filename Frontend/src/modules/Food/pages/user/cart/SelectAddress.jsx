import { useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, Check, ChevronDown, MapPin, Search } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import ScrollReveal from "@food/components/user/ScrollReveal"
import { Card, CardContent, CardHeader, CardTitle } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { Badge } from "@food/components/ui/badge"
import { useProfile } from "@food/context/ProfileContext"
import { toast } from "sonner"

const BRAND_RED = "#FF0000"

const getAddressId = (address) => address?.id || address?._id || ""

const formatAddressLine = (address) => {
  if (!address) return ""
  return [
    address.additionalDetails,
    address.street,
    address.city,
    address.state,
    address.zipCode,
  ]
    .filter(Boolean)
    .join(", ")
}

const toBackendLabel = (label) => {
  const v = String(label || "").toLowerCase()
  if (v === "work") return "Office"
  if (v === "home") return "Home"
  return "Other"
}

export default function SelectAddress() {
  const navigate = useNavigate()
  const location = useLocation()
  const { addresses = [], addAddress, setDefaultAddress, getDefaultAddress } = useProfile()

  const from = location?.state?.from || "/user/cart"
  const defaultAddress = getDefaultAddress?.() || null

  const [label, setLabel] = useState(() => {
    const current = defaultAddress?.label || "Home"
    return String(current).toLowerCase().includes("office") ? "Work" : current
  })
  const [query, setQuery] = useState("")
  const [selectedSuggestionId, setSelectedSuggestionId] = useState(() => getAddressId(defaultAddress))
  const [isSaving, setIsSaving] = useState(false)

  const [form, setForm] = useState(() => ({
    additionalDetails: defaultAddress?.additionalDetails || "",
    street: defaultAddress?.street || "",
    city: defaultAddress?.city || "",
    state: defaultAddress?.state || "",
    zipCode: defaultAddress?.zipCode || "",
    phone: defaultAddress?.phone || "",
  }))

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = Array.isArray(addresses) ? addresses.filter(a => a.type !== "current" && a.label !== "Current Location") : []
    if (!q) return list.slice(0, 6)
    return list
      .map((a) => ({ a, text: `${a.label || ""} ${formatAddressLine(a)}`.trim().toLowerCase() }))
      .filter((x) => x.text.includes(q))
      .slice(0, 8)
      .map((x) => x.a)
  }, [addresses, query])

  const showDropdown = (query.trim().length > 0 || suggestions.length > 0) && (addresses?.length || 0) > 0

  const onPickSuggestion = (addr) => {
    setSelectedSuggestionId(getAddressId(addr))
    setQuery(formatAddressLine(addr))
    setForm({
      additionalDetails: addr?.additionalDetails || "",
      street: addr?.street || "",
      city: addr?.city || "",
      state: addr?.state || "",
      zipCode: addr?.zipCode || "",
      phone: addr?.phone || "",
    })
    const normalizedLabel = String(addr?.label || "")
    if (normalizedLabel.toLowerCase() === "office") setLabel("Work")
    else if (normalizedLabel) setLabel(normalizedLabel)
  }

  const onChangeForm = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const onSave = async (e) => {
    e.preventDefault()
    const street = String(form.street || "").trim()
    const city = String(form.city || "").trim()
    const state = String(form.state || "").trim()
    if (!street || !city || !state) {
      toast.error("Please fill Street, City and State")
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        label: toBackendLabel(label),
        additionalDetails: String(form.additionalDetails || "").trim(),
        street,
        city,
        state,
        zipCode: String(form.zipCode || "").trim(),
        phone: String(form.phone || "").trim(),
      }
      const created = await addAddress(payload)
      const newId = getAddressId(created)
      if (newId) {
        await setDefaultAddress(newId)
      }
      toast.success("Address saved")
      navigate(from, { replace: true })
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Failed to save address")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AnimatedPage className="min-h-screen bg-linear-to-b from-red-50/30 via-white to-red-50/20 dark:from-[#0a0a0a] dark:via-[#1a1a1a] dark:to-[#0a0a0a] p-4 sm:p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6 md:space-y-8">
        <ScrollReveal>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9 md:h-10 md:w-10"
              onClick={() => navigate(from)}
            >
              <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold dark:text-white truncate">
                Select address
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Pick from saved addresses or add manually.
              </p>
            </div>
          </div>
        </ScrollReveal>

        <form onSubmit={onSave} className="space-y-6">
          <ScrollReveal delay={0.05}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" style={{ color: BRAND_RED }} />
                  Save as
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2">
                  {["Home", "Work", "Other"].map((x) => {
                    const active = label === x
                    return (
                      <Button
                        key={x}
                        type="button"
                        variant={active ? "default" : "outline"}
                        onClick={() => setLabel(x)}
                        className={active ? "text-white" : ""}
                        style={active ? { backgroundColor: BRAND_RED } : undefined}
                      >
                        {x}
                      </Button>
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Work is stored as Office in backend.
                </p>
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" style={{ color: BRAND_RED }} />
                  Autocomplete
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Input
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      setSelectedSuggestionId("")
                    }}
                    placeholder="Start typing to search saved addresses…"
                    className="pr-10"
                  />
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />

                  {showDropdown && (
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] shadow-xl overflow-hidden">
                      {suggestions.length === 0 ? (
                        <div className="p-4 text-sm text-gray-600 dark:text-gray-400">
                          No matches found.
                        </div>
                      ) : (
                        <div className="max-h-72 overflow-auto">
                          {suggestions.map((addr) => {
                            const id = getAddressId(addr)
                            const selected = id && selectedSuggestionId === id
                            return (
                              <button
                                key={id || formatAddressLine(addr)}
                                type="button"
                                onClick={() => onPickSuggestion(addr)}
                                className="w-full text-left px-4 py-3 hover:bg-red-50/60 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-semibold text-gray-900 dark:text-white">
                                        {String(addr?.label || "Saved").toLowerCase() === "office" ? "Work" : (addr?.label || "Saved")}
                                      </p>
                                      {addr?.isDefault && (
                                        <Badge className="bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-200">
                                          Default
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                                      {formatAddressLine(addr)}
                                    </p>
                                  </div>
                                  {selected && (
                                    <div className="pt-1">
                                      <Check className="h-5 w-5" style={{ color: BRAND_RED }} />
                                    </div>
                                  )}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Selecting a suggestion will prefill the manual fields (you can still edit).
                </p>
              </CardContent>
            </Card>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <Card>
              <CardHeader>
                <CardTitle>Manual address fields</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="additionalDetails">Address details*</Label>
                  <Input
                    id="additionalDetails"
                    name="additionalDetails"
                    placeholder="E.g. Floor, House no."
                    value={form.additionalDetails}
                    onChange={onChangeForm}
                  />
                </div>

                <div>
                  <Label htmlFor="street">Street / Area *</Label>
                  <Input
                    id="street"
                    name="street"
                    placeholder="Street / Area"
                    value={form.street}
                    onChange={onChangeForm}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      name="city"
                      placeholder="City"
                      value={form.city}
                      onChange={onChangeForm}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Input
                      id="state"
                      name="state"
                      placeholder="State"
                      value={form.state}
                      onChange={onChangeForm}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="zipCode">Pincode (optional)</Label>
                    <Input
                      id="zipCode"
                      name="zipCode"
                      placeholder="Pincode"
                      value={form.zipCode}
                      onChange={onChangeForm}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input
                      id="phone"
                      name="phone"
                      placeholder="Phone"
                      value={form.phone}
                      onChange={onChangeForm}
                      inputMode="tel"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold text-white"
              style={{ backgroundColor: BRAND_RED }}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save address"}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedPage>
  )
}

