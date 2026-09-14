import { useState } from "react"
import { ChevronDown, Mail, Phone } from "lucide-react"

const emptySupportData = {
  title: "Support",
  content: "",
  contactNumber: "",
  email: "",
  faqs: [],
  updatedAt: "",
}

export function normalizeSupportPayload(payload = {}) {
  return {
    ...emptySupportData,
    ...payload,
    title: payload?.title || "Support",
    content: payload?.content || "",
    contactNumber: payload?.contactNumber || "",
    email: payload?.email || "",
    faqs: Array.isArray(payload?.faqs) ? payload.faqs : [],
    updatedAt: payload?.updatedAt || "",
  }
}

export default function SupportInfoView({
  data = emptySupportData,
  loading = false,
  className = "",
}) {
  const supportData = normalizeSupportPayload(data)
  const [openFaqIndex, setOpenFaqIndex] = useState(null)

  const formattedDate = (supportData.updatedAt ? new Date(supportData.updatedAt) : new Date()).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  )

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">{supportData.title || "Support"}</h2>
        <p className="text-sm text-gray-600">Last updated: {formattedDate}</p>
      </div>

      {(supportData.contactNumber || supportData.email) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {supportData.contactNumber && (
            <a
              href={`tel:${supportData.contactNumber}`}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:border-[#FF0000]/20 hover:bg-red-50/40 transition-colors"
            >
              <Phone className="w-4 h-4 text-[#FF0000]" />
              <span className="font-medium">{supportData.contactNumber}</span>
            </a>
          )}
          {supportData.email && (
            <a
              href={`mailto:${supportData.email}`}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:border-[#FF0000]/20 hover:bg-red-50/40 transition-colors"
            >
              <Mail className="w-4 h-4 text-[#FF0000]" />
              <span className="font-medium break-all">{supportData.email}</span>
            </a>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading support content...</p>
      ) : (
        <>
          {supportData.content ? (
            <div
              className="prose prose-sm max-w-none text-sm text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: supportData.content }}
            />
          ) : null}

          {supportData.faqs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-gray-900">Frequently Asked Questions</h3>
              <div className="space-y-2">
                {supportData.faqs.map((faq, index) => {
                  const isOpen = openFaqIndex === index
                  return (
                    <div key={`${faq.question}-${index}`} className="rounded-xl border border-gray-100 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left bg-white hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm font-semibold text-gray-900">{faq.question}</span>
                        <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && (
                        <div
                          className="px-4 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 bg-gray-50/60 prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: faq.answer || "" }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!supportData.content && supportData.faqs.length === 0 && !supportData.contactNumber && !supportData.email && (
            <p className="text-sm text-gray-500">No support content available.</p>
          )}
        </>
      )}
    </div>
  )
}
