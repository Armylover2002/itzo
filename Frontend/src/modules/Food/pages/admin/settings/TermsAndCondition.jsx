import { useState, useEffect } from "react"
import { toast } from "sonner"
import api from "@food/api"
import { API_ENDPOINTS } from "@food/api/config"
import { Textarea } from "@food/components/ui/textarea"
import { legalHtmlToPlainText, plainTextToLegalHtml } from "@food/utils/legalContentFormat"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function TermsAndCondition() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState("edit") // "edit" | "preview"
  const [role, setRole] = useState("user") // "user" | "restaurant" | "delivery"
  const [termsData, setTermsData] = useState({
    title: 'Terms and Conditions',
    content: ''
  })

  useEffect(() => {
    fetchTermsData()
  }, [role])

  const fetchTermsData = async () => {
    try {
      setLoading(true)
      const response = await api.get(`${API_ENDPOINTS.ADMIN.TERMS}?role=${role}`, { contextModule: "admin" })
      if (response.data.success) {
        // Convert HTML to plain text for textarea
        const content = response.data.data?.content || ''
        const textContent = legalHtmlToPlainText(content)
        setTermsData({
          title: response.data.data?.title || 'Terms and Conditions',
          content: textContent
        })
      } else {
        setTermsData({
          title: 'Terms and Conditions',
          content: ''
        })
      }
    } catch (error) {
      debugError('Error fetching terms data:', error)
      setTermsData({
        title: 'Terms and Conditions',
        content: ''
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      // Convert plain text/markdown to HTML for storage + user rendering
      const htmlContent = plainTextToLegalHtml(termsData.content)
      
      const response = await api.put(
        API_ENDPOINTS.ADMIN.TERMS,
        { title: termsData.title, content: htmlContent, role: role },
        { contextModule: "admin" }
      )
      if (response.data.success) {
        toast.success(`Terms and conditions for ${role} updated successfully`)
        const content = response.data.data?.content || ''
        const textContent = legalHtmlToPlainText(content)
        setTermsData({
          title: response.data.data?.title || 'Terms and Conditions',
          content: textContent
        })
      }
    } catch (error) {
      debugError('Error saving terms:', error)
      toast.error(error.response?.data?.message || 'Failed to save terms and conditions')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Terms And Condition</h1>
            <p className="text-sm text-slate-600 mt-1">Manage Terms and Conditions for different user roles</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Role Selector */}
            <div className="flex p-1 bg-slate-200 rounded-xl">
              {[
                { id: "user", label: "Customer" },
                { id: "restaurant", label: "Restaurant" },
                { id: "delivery", label: "Delivery Boy" },
                { id: "seller", label: "Seller" }
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRole(r.id)}
                  className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                    role === r.id 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {!loading && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="px-8 py-3 bg-slate-900 text-white rounded-xl hover:bg-black transition-all font-bold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-20 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-slate-600 font-medium">Loading {role} terms...</p>
          </div>
        ) : (
          <>
            {/* Text Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="text-sm text-slate-500 italic">
                  Editing terms for <span className="font-bold text-blue-600 capitalize">{role}</span>
                </div>
                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("edit")}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === "edit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("preview")}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === "preview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  >
                    Preview
                  </button>
                </div>
              </div>

              <div className="p-6">
                {viewMode === "edit" ? (
                  <Textarea
                    value={termsData.content}
                    onChange={(e) => setTermsData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder={`Enter terms and conditions content for ${role}...`}
                    className="min-h-[500px] w-full text-sm text-slate-700 leading-relaxed resize-none border-none focus-visible:ring-0 p-0"
                    dir="ltr"
                  />
                ) : (
                  <div className="min-h-[500px] w-full bg-slate-50/30 rounded-xl p-6">
                    <div
                      className="prose prose-slate max-w-none
                        prose-headings:text-slate-900 prose-headings:font-bold
                        prose-p:text-slate-700
                        prose-strong:text-slate-900
                        prose-ul:text-slate-700
                        prose-li:my-1
                        leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: plainTextToLegalHtml(termsData.content || '*No content provided*') }}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

