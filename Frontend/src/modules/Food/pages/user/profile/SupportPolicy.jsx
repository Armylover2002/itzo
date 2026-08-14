import { Link, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { ArrowLeft, Headphones, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import api from "@food/api"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import { API_ENDPOINTS } from "@food/api/config"

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

export default function SupportPolicy() {
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const [loading, setLoading] = useState(true)
  const [supportData, setSupportData] = useState({
    title: 'ItzoFood Support',
    content: FALLBACK_CONTENT
  })

  useEffect(() => {
    fetchSupportData()
  }, [])

  const fetchSupportData = async () => {
    try {
      setLoading(true)
      const response = await api.get(`${API_ENDPOINTS.ADMIN.SUPPORT_PUBLIC}?role=user`)
      if (response.data.success) {
        const payload = response.data.data || {};
        setSupportData({ 
          title: payload?.title || 'ItzoFood Support', 
          content: payload?.content || FALLBACK_CONTENT 
        })
      }
    } catch (error) {
      console.error('Error fetching support data:', error)
      setSupportData({
        title: 'ItzoFood Support',
        content: FALLBACK_CONTENT
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1)
    } else {
      navigate('/food/user')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#CB202D]" />
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-white dark:bg-[#0a0a0a] pb-10">
      {/* Premium Sticky Header */}
      <div className="sticky top-0 z-50 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-gray-100 dark:border-gray-900">
        <div className="max-w-4xl mx-auto px-4 h-16 md:h-20 flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleBack}
            className="h-10 w-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-all active:scale-95"
          >
            <ArrowLeft className="h-6 w-6 text-gray-900 dark:text-white" />
          </Button>
          <div className="flex-1">
             <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none">
               {supportData.title || "Support"}
             </h1>
             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">ItzoFood Policy</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#111] rounded-[2rem] p-6 md:p-10 shadow-sm border border-gray-50 dark:border-gray-900"
        >
          {supportData.content ? (
            <div
              className="prose prose-slate dark:prose-invert max-w-none
                prose-headings:font-black prose-headings:text-gray-900 dark:prose-headings:text-white
                prose-p:text-gray-600 dark:prose-p:text-gray-400 prose-p:leading-relaxed
                prose-strong:text-gray-900 dark:prose-strong:text-white
                prose-a:text-[#CB202D] dark:prose-a:text-[#FE5502]
                prose-li:text-gray-600 dark:prose-li:text-gray-400"
              dangerouslySetInnerHTML={{ __html: supportData.content }}
            />
          ) : (
            <div className="text-center py-20">
               <Headphones className="w-16 h-16 text-gray-100 dark:text-gray-800 mx-auto mb-4" />
               <p className="text-gray-400 font-medium">No content available at the moment.</p>
            </div>
          )}
        </motion.div>

        <p className="text-center mt-10 text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] leading-relaxed">
          Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} <br />
          © {new Date().getFullYear()} ItzoFood. All Rights Reserved.
        </p>
      </div>
    </AnimatedPage>
  )
}
