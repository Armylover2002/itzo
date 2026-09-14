import { useEffect, useState } from "react"
import { toast } from "sonner"
import { adminAPI } from "@/services/api"
import { setCachedSettings } from "@common/utils/businessSettings"

const SOCIAL_FIELDS = [
  { key: "facebook", label: "Facebook URL", placeholder: "https://facebook.com/your-page" },
  { key: "instagram", label: "Instagram URL", placeholder: "https://instagram.com/your-page" },
  { key: "twitter", label: "Twitter / X URL", placeholder: "https://x.com/your-page" },
  { key: "linkedin", label: "LinkedIn URL", placeholder: "https://linkedin.com/company/your-page" },
  { key: "youtube", label: "YouTube URL", placeholder: "https://youtube.com/@your-channel" },
]

const emptySocialLinks = () => ({
  facebook: "",
  instagram: "",
  twitter: "",
  linkedin: "",
  youtube: "",
})

export default function SocialMedia() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [socialLinks, setSocialLinks] = useState(emptySocialLinks)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true)
        const response = await adminAPI.getBusinessSettings()
        const settings = response?.data?.data || response?.data || {}
        setSocialLinks({
          ...emptySocialLinks(),
          ...(settings.socialLinks || {}),
        })
      } catch (_) {
        toast.error("Failed to load social media links")
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleChange = (key, value) => {
    setSocialLinks((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await adminAPI.updateBusinessSettings({ socialLinks })
      const updatedSettings = response?.data?.data || response?.data
      if (updatedSettings) {
        setCachedSettings(updatedSettings)
        setSocialLinks({
          ...emptySocialLinks(),
          ...(updatedSettings.socialLinks || {}),
        })
      }
      toast.success("Social media links updated successfully")
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save social media links")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 lg:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Social Media</h1>
            <p className="text-sm text-slate-600 mt-1">
              Manage social links shown on restaurant login and other public surfaces.
            </p>
          </div>
          {!loading && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 bg-slate-900 text-white rounded-xl hover:bg-black transition-all font-bold disabled:opacity-50 shrink-0"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
            {SOCIAL_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">{field.label}</label>
                <input
                  type="url"
                  value={socialLinks[field.key] || ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}

          </div>
        )}
      </div>
    </div>
  )
}
