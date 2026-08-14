import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { ArrowLeft, Loader2 } from "lucide-react"
import api, { API_ENDPOINTS } from "@food/api"
import useDeliveryBackNavigation from "../hooks/useDeliveryBackNavigation"

const FALLBACK_CONTENT = `
<div class="space-y-6">
  <div>
    <h3 class="text-xl font-bold mb-2">Welcome to ItzoFood Support</h3>
    <p>We're here to help! Whether you're a customer, restaurant partner, delivery executive, or an employee, our dedicated teams are available to assist you 24/7.</p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
    <div class="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-gray-100 dark:border-zinc-800">
      <h4 class="font-bold text-lg mb-2 flex items-center gap-2">👨‍💼 Customer Support</h4>
      <p class="text-sm mb-1"><strong>Email:</strong> support@itzofood.com</p>
      <p class="text-sm"><strong>Phone:</strong> +91 9586640145</p>
    </div>

    <div class="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-gray-100 dark:border-zinc-800">
      <h4 class="font-bold text-lg mb-2 flex items-center gap-2">🏪 Restaurant Partners</h4>
      <p class="text-sm mb-1"><strong>Email:</strong> partners@itzofood.com</p>
      <p class="text-sm"><strong>Phone:</strong> +91 9586640145</p>
    </div>

    <div class="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-gray-100 dark:border-zinc-800">
      <h4 class="font-bold text-lg mb-2 flex items-center gap-2">🛵 Delivery Executives</h4>
      <p class="text-sm mb-1"><strong>Email:</strong> delivery@itzofood.com</p>
      <p class="text-sm"><strong>Phone:</strong> +91 9586640145</p>
    </div>

    <div class="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-gray-100 dark:border-zinc-800">
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

  <div class="mt-8 pt-6 border-t border-gray-200 dark:border-zinc-800">
    <h4 class="font-bold mb-2">Corporate Office</h4>
    <p class="text-sm">ItzoFood Technologies Pvt. Ltd.<br/>Cyber City, Phase 2, Gurugram, Haryana - 122002, India</p>
  </div>
</div>
`;

export default function SupportPolicyV2() {
  const goBack = useDeliveryBackNavigation()
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState(FALLBACK_CONTENT)
  const [lastUpdated, setLastUpdated] = useState("")

  useEffect(() => {
    const fetchSupport = async () => {
      try {
        const response = await api.get(API_ENDPOINTS.ADMIN.SUPPORT_PUBLIC, {
          params: { role: 'delivery' }
        })
        const payload = response?.data?.data || response?.data || {}
        if (response?.data?.success) {
          setContent(payload?.content || FALLBACK_CONTENT)
          setLastUpdated(payload?.updatedAt || "")
        }
      } catch (error) {
        console.error("Error fetching support:", error)
        setContent(FALLBACK_CONTENT)
      } finally {
        setLoading(false)
      }
    }

    fetchSupport()
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
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-4 py-4 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
        <button
          onClick={goBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Support</h1>
      </div>

      <div className="w-full px-5 py-6">
        <div className="max-w-4xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#FE5502] animate-spin mb-4" />
              <p className="text-gray-500">Loading support...</p>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              {content ? (
                <div
                  className="prose prose-sm prose-orange dark:prose-invert max-w-none text-gray-700 dark:text-gray-300"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              ) : (
                <p className="text-gray-500">No support content available.</p>
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
