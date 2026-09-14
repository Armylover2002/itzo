import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import api from "@food/api"
import { API_ENDPOINTS } from "@food/api/config"
import { Textarea } from "@food/components/ui/textarea"
import { Input } from "@food/components/ui/input"
import { legalHtmlToPlainText, plainTextToLegalHtml } from "@food/utils/legalContentFormat"
import SupportInfoView, { normalizeSupportPayload } from "@food/components/shared/SupportInfoView"

const emptyFaq = () => ({ question: "", answer: "" })

const normalizeContactNumber = (value) =>
  String(value || "").replace(/\D/g, "").slice(0, 10)

const emptySupportData = () => ({
  title: "Support",
  content: "",
  contactNumber: "",
  email: "",
  faqs: [],
})

export default function SupportPolicy() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState("edit")
  const [role, setRole] = useState("user")
  const [supportData, setSupportData] = useState(emptySupportData())

  useEffect(() => {
    fetchSupportData()
  }, [role])

  const fetchSupportData = async () => {
    try {
      setLoading(true)
      const response = await api.get(`${API_ENDPOINTS.ADMIN.SUPPORT}?role=${role}`, { contextModule: "admin" })
      if (response.data.success) {
        const payload = response.data.data || {}
        setSupportData({
          title: payload?.title || "Support",
          content: legalHtmlToPlainText(payload?.content || ""),
          contactNumber: normalizeContactNumber(payload?.contactNumber),
          email: payload?.email || "",
          faqs: Array.isArray(payload?.faqs)
            ? payload.faqs.map((faq) => ({
                question: faq?.question || "",
                answer: legalHtmlToPlainText(faq?.answer || ""),
              }))
            : [],
        })
      } else {
        setSupportData(emptySupportData())
      }
    } catch (_) {
      setSupportData(emptySupportData())
    } finally {
      setLoading(false)
    }
  }

  const updateFaq = (index, field, value) => {
    setSupportData((prev) => ({
      ...prev,
      faqs: prev.faqs.map((faq, idx) => (idx === index ? { ...faq, [field]: value } : faq)),
    }))
  }

  const addFaq = () => {
    setSupportData((prev) => ({
      ...prev,
      faqs: [...prev.faqs, emptyFaq()],
    }))
  }

  const removeFaq = (index) => {
    setSupportData((prev) => ({
      ...prev,
      faqs: prev.faqs.filter((_, idx) => idx !== index),
    }))
  }

  const handleSubmit = async () => {
    try {
      const contactNumber = normalizeContactNumber(supportData.contactNumber)
      if (contactNumber && !/^\d{10}$/.test(contactNumber)) {
        toast.error("Contact number must be exactly 10 digits")
        return
      }

      setSaving(true)
      const htmlContent = plainTextToLegalHtml(supportData.content)
      const faqs = supportData.faqs
        .filter((faq) => faq.question.trim() || faq.answer.trim())
        .map((faq, index) => ({
          question: faq.question.trim(),
          answer: plainTextToLegalHtml(faq.answer),
          order: index,
        }))

      const response = await api.put(
        API_ENDPOINTS.ADMIN.SUPPORT,
        {
          title: supportData.title,
          content: htmlContent,
          contactNumber,
          email: supportData.email.trim(),
          faqs,
          role,
        },
        { contextModule: "admin" }
      )

      if (response.data.success) {
        toast.success(`Support content for ${role} updated successfully`)
        const payload = response.data.data || {}
        setSupportData({
          title: payload?.title || "Support",
          content: legalHtmlToPlainText(payload?.content || ""),
          contactNumber: normalizeContactNumber(payload?.contactNumber),
          email: payload?.email || "",
          faqs: Array.isArray(payload?.faqs)
            ? payload.faqs.map((faq) => ({
                question: faq?.question || "",
                answer: legalHtmlToPlainText(faq?.answer || ""),
              }))
            : [],
        })
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save support content")
    } finally {
      setSaving(false)
    }
  }

  const previewData = normalizeSupportPayload({
    ...supportData,
    content: plainTextToLegalHtml(supportData.content || ""),
    faqs: supportData.faqs.map((faq) => ({
      question: faq.question,
      answer: plainTextToLegalHtml(faq.answer || ""),
    })),
  })

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Support</h1>
            <p className="text-sm text-slate-600 mt-1">Manage support contact, content, and FAQs for each role</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="flex p-1 bg-slate-200 rounded-xl">
              {[
                { id: "user", label: "Customer" },
                { id: "restaurant", label: "Restaurant" },
                { id: "delivery", label: "Delivery Boy" },
                { id: "seller", label: "Seller" },
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
                ) : (
                  "Save Changes"
                )}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-20 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            <p className="mt-4 text-slate-600 font-medium">Loading {role} support content...</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Contact Details</h2>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Number</label>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    value={supportData.contactNumber}
                    onChange={(e) =>
                      setSupportData((prev) => ({
                        ...prev,
                        contactNumber: normalizeContactNumber(e.target.value),
                      }))
                    }
                    placeholder="Enter 10-digit contact number"
                  />
                  {supportData.contactNumber && supportData.contactNumber.length !== 10 && (
                    <p className="mt-1 text-xs text-red-500">Contact number must be exactly 10 digits</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Support Email</label>
                  <Input
                    type="email"
                    value={supportData.email}
                    onChange={(e) => setSupportData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="support@example.com"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="text-sm text-slate-500 italic">
                  Support description for <span className="font-bold text-blue-600 capitalize">{role}</span>
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
                    value={supportData.content}
                    onChange={(e) => setSupportData((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder={`Enter support content for ${role}...`}
                    className="min-h-[220px] w-full text-sm text-slate-700 leading-relaxed resize-none border border-slate-200 rounded-xl p-4"
                    dir="ltr"
                  />
                ) : (
                  <div className="min-h-[220px] w-full bg-slate-50/30 rounded-xl p-6">
                    <div
                      className="prose prose-slate max-w-none leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: plainTextToLegalHtml(supportData.content || "*No content provided*") }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">FAQs</h2>
                <button
                  type="button"
                  onClick={addFaq}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-black transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add FAQ
                </button>
              </div>

              <div className="p-6 space-y-4">
                {supportData.faqs.length === 0 ? (
                  <p className="text-sm text-slate-500">No FAQs added yet.</p>
                ) : (
                  supportData.faqs.map((faq, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">FAQ {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeFaq(index)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </div>
                      <Input
                        value={faq.question}
                        onChange={(e) => updateFaq(index, "question", e.target.value)}
                        placeholder="Question"
                      />
                      <Textarea
                        value={faq.answer}
                        onChange={(e) => updateFaq(index, "answer", e.target.value)}
                        placeholder="Answer"
                        className="min-h-[100px] resize-none"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Live Preview</h2>
              </div>
              <div className="p-6">
                <SupportInfoView data={previewData} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
