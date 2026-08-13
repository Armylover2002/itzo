import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import api, { API_ENDPOINTS } from "@food/api"

export default function SupportPolicyPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [loading, setLoading] = useState(true)
  const [supportData, setSupportData] = useState({ title: "Support", content: "", updatedAt: "" })

  useEffect(() => {
    const fetchSupport = async () => {
      try {
        const response = await api.get(`${API_ENDPOINTS.ADMIN.SUPPORT_PUBLIC}?role=restaurant`)
        if (response?.data?.success) {
          const payload = response?.data?.data || {}
          setSupportData({
            title: payload?.title || "Support",
            content: payload?.content || "",
            updatedAt: payload?.updatedAt || ""
          })
        }
      } catch (_) {
      } finally {
        setLoading(false)
      }
    }

    fetchSupport()
  }, [])

  return (
    <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-10">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-4 py-3 z-50 flex items-center gap-3">
        <button 
          onClick={goBack}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Support</h1>
      </div>

      {/* Content */}
      <div className="px-4 py-6 pt-[4.5rem]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6"
        >
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">{supportData.title || "Support"}</h2>
            <p className="text-sm text-gray-600">
              Last updated: {(supportData.updatedAt ? new Date(supportData.updatedAt) : new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading support content...</p>
          ) : supportData.content ? (
            <div
              className="prose prose-sm max-w-none text-sm text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: supportData.content }}
            />
          ) : (
            <p className="text-sm text-gray-500">No support content available.</p>
          )}
        </motion.div>
      </div>
    </div>
  )
}
