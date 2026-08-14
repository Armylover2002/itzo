import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import api, { API_ENDPOINTS } from "@food/api"

const FALLBACK_CONTENT = `
<div class="space-y-6">
  <div>
    <h3 class="text-xl font-bold mb-2">Welcome to ItzoFood Support</h3>
    <p>We're here to help! Whether you're a customer, restaurant partner, delivery executive, or an employee, our dedicated teams are available to assist you 24/7.</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
    <div class="bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-lg border border-gray-100 dark:border-gray-800">
      <h4 class="font-bold text-lg mb-2 flex items-center gap-2">👨‍💼 Customer Support</h4>
      <p class="text-sm mb-1"><strong>Email:</strong> support@itzofood.com</p>
      <p class="text-sm"><strong>Phone:</strong> +91 9586640145</p>
    </div>

    <div class="bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-lg border border-gray-100 dark:border-gray-800">
      <h4 class="font-bold text-lg mb-2 flex items-center gap-2">🏪 Restaurant Partners</h4>
      <p class="text-sm mb-1"><strong>Email:</strong> partners@itzofood.com</p>
      <p class="text-sm"><strong>Phone:</strong> +91 9586640145</p>
    </div>

    <div class="bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-lg border border-gray-100 dark:border-gray-800">
      <h4 class="font-bold text-lg mb-2 flex items-center gap-2">🛵 Delivery Executives</h4>
      <p class="text-sm mb-1"><strong>Email:</strong> delivery@itzofood.com</p>
      <p class="text-sm"><strong>Phone:</strong> +91 9586640145</p>
    </div>

    <div class="bg-gray-50 dark:bg-[#1a1a1a] p-4 rounded-lg border border-gray-100 dark:border-gray-800">
      <h4 class="font-bold text-lg mb-2 flex items-center gap-2">🏢 Corporate & HR</h4>
      <p class="text-sm mb-1"><strong>Email:</strong> hr@itzofood.com</p>
      <p class="text-sm"><strong>Phone:</strong> +91 9586640145</p>
    </div>
  </div>

  <div class="mt-8">
    <h3 class="text-xl font-bold mb-4">Frequently Asked Questions</h3>
    <ul class="space-y-4">
      <li>
        <strong>Q: How do I track my food order?</strong><br/>
        A: You can track your order in real-time by going to the 'My Orders' section in your ItzoFood app.
      </li>
      <li>
        <strong>Q: How can I register my restaurant on ItzoFood?</strong><br/>
        A: Download the Itzo Partner app, click on 'Register', and submit your details along with your FSSAI license. Our team will verify and onboard you within 24-48 hours.
      </li>
      <li>
        <strong>Q: What should I do if my payout is delayed?</strong><br/>
        A: Payouts are processed weekly. If there is a delay, please contact our partner support team with your registered phone number and bank details.
      </li>
    </ul>
  </div>
</div>
`;

export default function SupportPolicyPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [loading, setLoading] = useState(true)
  const [supportData, setSupportData] = useState({ title: "ItzoFood Support", content: FALLBACK_CONTENT, updatedAt: "" })

  useEffect(() => {
    const fetchSupport = async () => {
      try {
        const response = await api.get(`${API_ENDPOINTS.ADMIN.SUPPORT_PUBLIC}?role=restaurant`)
        if (response?.data?.success) {
          const payload = response?.data?.data || {}
          setSupportData({
            title: payload?.title || "ItzoFood Support",
            content: payload?.content || FALLBACK_CONTENT,
            updatedAt: payload?.updatedAt || ""
          })
        }
      } catch (_) {
        setSupportData({ title: "ItzoFood Support", content: FALLBACK_CONTENT, updatedAt: "" })
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
