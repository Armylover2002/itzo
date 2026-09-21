import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeft, AlertCircle, FileText } from "lucide-react"
import { orderAPI } from "@food/api"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import { toast } from "sonner"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const COMPLAINT_TYPES = [
  { value: 'food_quality', label: 'Food Quality Issue' },
  { value: 'wrong_item', label: 'Wrong Item Received' },
  { value: 'missing_item', label: 'Missing Item' },
  { value: 'delivery_issue', label: 'Delivery Issue' },
  { value: 'packaging', label: 'Packaging Problem' },
  { value: 'pricing', label: 'Pricing Issue' },
  { value: 'service', label: 'Service Issue' },
  { value: 'other', label: 'Other' },
]

export default function SubmitComplaint() {
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const { orderId } = useParams()

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    complaintType: '',
    subject: '',
    description: '',
  })

  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!orderId) {
      debugError("Order ID missing from URL params")
      toast.error("Order ID is required")
      setTimeout(() => {
        navigate("/user/orders")
      }, 2000)
      return
    }

    const fetchOrder = async () => {
      try {
        setLoading(true)
        debugLog("Fetching order details for orderId:", orderId)
        const response = await orderAPI.getOrderDetails(orderId)

        let orderData = null
        if (response?.data?.success && response.data.data?.order) {
          orderData = response.data.data.order
        } else if (response?.data?.order) {
          orderData = response.data.order
        } else {
          debugError("Order not found in response:", response?.data)
          toast.error("Order not found")
          setTimeout(() => {
            navigate("/user/orders")
          }, 2000)
          return
        }

        debugLog("Order fetched successfully:", {
          _id: orderData._id,
          orderId: orderData.orderId,
          restaurantName: orderData.restaurantName
        })
        setOrder(orderData)
      } catch (error) {
        debugError("Error fetching order:", error)
        toast.error(error?.response?.data?.message || "Failed to load order details")
        setTimeout(() => {
          navigate("/user/orders")
        }, 2000)
      } finally {
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderId, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!navigator.onLine) {
      toast.error("No internet connection. Please check your network.")
      return
    }

    if (!formData.complaintType) {
      toast.error("Please select a complaint type")
      return
    }
    if (!formData.subject.trim()) {
      toast.error("Please enter a subject")
      return
    }
    if (!formData.description.trim()) {
      toast.error("Please enter a description")
      return
    }

    try {
      setSubmitting(true)
      // Use order._id (MongoDB ObjectId) for the complaint submission
      const orderMongoId = order?._id || orderId
      if (!orderMongoId) {
        toast.error("Order ID not available")
        setSubmitting(false)
        return
      }

      const orderIdString = typeof orderMongoId === 'object' && orderMongoId.toString
        ? orderMongoId.toString()
        : String(orderMongoId)

      debugLog("Submitting complaint for orderId:", orderIdString)
      const response = await orderAPI.submitComplaint({
        orderId: orderIdString,
        complaintType: formData.complaintType,
        subject: formData.subject,
        description: formData.description,
      })

      if (response?.data?.success) {
        toast.success("Complaint submitted successfully")
        // Navigate back to order details using the orderId from URL or order._id
        const orderIdForNav = order?._id || orderId
        navigate(`/user/orders/${orderIdForNav}/details`)
      } else {
        toast.error(response?.data?.message || "Failed to submit complaint")
      }
    } catch (error) {
      debugError("Error submitting complaint:", error)
      toast.error(error?.response?.data?.message || "Failed to submit complaint")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600 text-sm">Loading...</p>
      </div>
    )
  }

  if (!order) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-[#1c1c1e] p-4 flex items-center sticky top-0 z-20 shadow-sm border-b dark:border-gray-800">
        <button
          type="button"
          onClick={goBack}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-lg font-semibold text-gray-800 dark:text-white ml-3">Submit Complaint</h1>
      </div>

      {/* Network Status Banner */}
      {!isOnline && (
        <div className="bg-red-50 dark:bg-red-900/20 p-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="font-medium">No internet connection. Please check your network.</p>
        </div>
      )}

      {/* Order Info */}
      <div className="bg-white dark:bg-[#1c1c1e] mx-4 mt-4 p-4 rounded-xl shadow-sm border dark:border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-800 dark:text-white">
              Order #{order.orderId || order._id}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {order.restaurantName || 'Restaurant'}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {new Date(order.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mx-4 mt-4 space-y-4">
        {/* Complaint Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Complaint Type <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.complaintType}
            onChange={(e) => setFormData({ ...formData, complaintType: e.target.value })}
            className="w-full px-4 py-3 bg-white dark:bg-[#1c1c1e] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#FE5502] focus:border-transparent"
            required
          >
            <option value="" className="text-gray-900 dark:text-white bg-white dark:bg-[#1c1c1e]">Select complaint type</option>
            {COMPLAINT_TYPES.map((type) => (
              <option key={type.value} value={type.value} className="text-gray-900 dark:text-white bg-white dark:bg-[#1c1c1e]">
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            placeholder="Brief description of your complaint"
            className="w-full px-4 py-3 bg-white dark:bg-[#1c1c1e] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#FE5502] focus:border-transparent"
            required
            maxLength={200}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Please provide detailed information about your complaint..."
            rows={6}
            className="w-full px-4 py-3 bg-white dark:bg-[#1c1c1e] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-[#FE5502] focus:border-transparent resize-none"
            required
            maxLength={1000}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formData.description.length}/1000 characters
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-semibold mb-1">What happens next?</p>
            <p className="text-blue-700 dark:text-blue-400/80">
              Your complaint will be sent to the restaurant. They will review and respond to your complaint. You can track the status in your complaints section.
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#1c1c1e] border-t border-gray-200 dark:border-gray-800 p-4 z-20">
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#FE5502] text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-[#C83C00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Complaint"
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

