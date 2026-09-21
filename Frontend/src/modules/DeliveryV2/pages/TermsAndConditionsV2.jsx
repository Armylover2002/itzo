import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { ArrowLeft, Loader2 } from "lucide-react"
import api, { API_ENDPOINTS } from "@food/api"
import useDeliveryBackNavigation from "../hooks/useDeliveryBackNavigation"

export default function TermsAndConditionsV2() {
  const goBack = useDeliveryBackNavigation()
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState("")
  const [lastUpdated, setLastUpdated] = useState("")

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const response = await api.get(API_ENDPOINTS.ADMIN.TERMS_PUBLIC, {
          params: { role: 'delivery' }
        })
        const payload = response?.data?.data || response?.data || {}
        if (response?.data?.success) {
          setContent(payload?.content || "")
          setLastUpdated(payload?.updatedAt || "")
        }
      } catch (error) {
        console.error("Error fetching terms:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchTerms()
  }, [])

  const formatDate = (dateString) => {
    if (!dateString) return "January 1, 2024"
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] overflow-x-hidden">
      <div className="fixed top-0 left-0 right-0 z-20 bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-4 shadow-sm">
        <button
          onClick={goBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Terms and Conditions</h1>
      </div>

      <div className="w-full px-5 pt-24 pb-6">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#FE5502] animate-spin mb-4" />
              <p className="text-gray-500">Loading terms...</p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              {content ? (
                <div
                  className="prose prose-sm prose-orange dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <p className="text-gray-500">No terms content available.</p>
              )}
              {lastUpdated && (
                <div className="mt-12 pt-6 border-t border-gray-100">
                  <p className="text-gray-400 text-xs italic">Last updated: {formatDate(lastUpdated)}</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
