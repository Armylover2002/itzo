import { useEffect, useState } from "react"
import { ArrowLeft } from "lucide-react"
import api, { API_ENDPOINTS } from "@food/api"
import useDeliveryBackNavigation from "../hooks/useDeliveryBackNavigation"
import SupportInfoView, { normalizeSupportPayload } from "@food/components/shared/SupportInfoView"

export default function SupportInfoV2() {
  const goBack = useDeliveryBackNavigation()
  const [loading, setLoading] = useState(true)
  const [supportData, setSupportData] = useState(normalizeSupportPayload())

  useEffect(() => {
    const fetchSupport = async () => {
      try {
        const response = await api.get(`${API_ENDPOINTS.ADMIN.SUPPORT_PUBLIC}?role=delivery`)
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
    <div className="app-shell-page min-h-screen bg-white dark:bg-[#0a0a0a] overflow-x-hidden">
      <div className="app-shell-page__header safe-top bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-4 py-4 flex items-center gap-4 shadow-sm">
        <button
          onClick={goBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Support</h1>
      </div>

      <div className="app-shell-page__body pb-10">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6">
          <SupportInfoView data={supportData} loading={loading} />
        </div>
      </div>
      </div>
    </div>
  )
}
