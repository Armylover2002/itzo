import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import api, { API_ENDPOINTS } from "@food/api"
import AnimatedPage from "@food/components/user/AnimatedPage"
import SupportInfoView, { normalizeSupportPayload } from "@food/components/shared/SupportInfoView"

export default function SupportInfoPage() {
  const [loading, setLoading] = useState(true)
  const [supportData, setSupportData] = useState(normalizeSupportPayload())

  useEffect(() => {
    const fetchSupport = async () => {
      try {
        const response = await api.get(`${API_ENDPOINTS.ADMIN.SUPPORT_PUBLIC}?role=user`)
        if (response?.data?.success) {
          setSupportData(normalizeSupportPayload(response?.data?.data || {}))
        }
      } catch (_) {
      } finally {
        setLoading(false)
      }
    }

    fetchSupport()
  }, [])

  return (
    <AnimatedPage>
      <div className="min-h-screen bg-gray-50 pb-10">
        <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <Link to="/food/user/profile/support" className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Support</h1>
        </div>

        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <SupportInfoView data={supportData} loading={loading} />
          </div>
        </div>
      </div>
    </AnimatedPage>
  )
}
