import { useState, useMemo, useEffect } from "react"
import { Search, Download, ChevronDown, Star, ArrowUpDown, Settings, FileText, FileSpreadsheet, Code, Check, Columns, Loader2, Eye } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { exportReviewsToCSV, exportReviewsToExcel, exportReviewsToPDF, exportReviewsToJSON } from "@food/components/admin/deliveryman/deliverymanExportUtils"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function DeliverymanReviews() {
  const [searchQuery, setSearchQuery] = useState("")
  const [reviews, setReviews] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [selectedReview, setSelectedReview] = useState(null)
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    orderId: true,
    deliveryman: true,
    deliverymanId: true,
    customer: true,
    review: true,
    rating: true,
    date: true,
  })

  const filteredReviews = useMemo(() => {
    if (!searchQuery.trim()) {
      return reviews
    }
    
    const query = searchQuery.toLowerCase().trim()
    return reviews.filter(review =>
      review.deliveryman.toLowerCase().includes(query) ||
      review.customer.toLowerCase().includes(query) ||
      review.review.toLowerCase().includes(query) ||
      (review.orderId && review.orderId.toLowerCase().includes(query)) ||
      (review.deliverymanId && review.deliverymanId.toString().toLowerCase().includes(query))
    )
  }, [reviews, searchQuery])

  const handleExport = (format) => {
    if (filteredReviews.length === 0) {
      alert("No data to export")
      return
    }
    switch (format) {
      case "csv": exportReviewsToCSV(filteredReviews); break
      case "excel": exportReviewsToExcel(filteredReviews); break
      case "pdf": exportReviewsToPDF(filteredReviews); break
      case "json": exportReviewsToJSON(filteredReviews); break
    }
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      orderId: true,
      deliveryman: true,
      deliverymanId: true,
      customer: true,
      review: true,
      rating: true,
      date: true,
    })
  }

  const columnsConfig = {
    si: "Serial Number",
    orderId: "Order ID",
    deliveryman: "Deliveryman",
    deliverymanId: "Delivery Boy ID",
    customer: "Customer",
    review: "Review",
    rating: "Rating",
    date: "Date & Time",
  }

  const getRatingBadge = (rating) => {
    const stars = []
    const count = Math.floor(rating || 0)
    for (let i = 0; i < count; i++) {
      stars.push(<Star key={i} className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />)
    }
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg w-fit">
        <div className="flex items-center gap-0.5">
          {stars}
        </div>
        <span className="text-xs font-bold text-amber-700 leading-none">{rating}</span>
      </div>
    )
  }

  const renderStars = (rating) => {
    const stars = []
    const count = Math.floor(rating || 0)
    for (let i = 0; i < count; i++) {
      stars.push(<Star key={i} className="w-5 h-5 fill-amber-500 text-amber-500" />)
    }
    return stars
  }

  // Format date and time
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      const day = date.getDate().toString().padStart(2, '0')
      const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
      const year = date.getFullYear()
      const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      return `${day} ${month} ${year}, ${time}`
    } catch (e) {
      return 'Invalid Date'
    }
  }

  // Fetch deliveryman reviews from API
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setIsLoading(true)
        debugLog('?? Fetching deliveryman reviews...')
        const response = await adminAPI.getDeliverymanReviews({ limit: 1000 })
        
        debugLog('? Deliveryman reviews response:', response?.data)
        
        if (response?.data?.success && response?.data?.data?.reviews) {
          setReviews(response.data.data.reviews)
          debugLog(`? Loaded ${response.data.data.reviews.length} reviews`)
        } else {
          debugError('? Unexpected response structure:', response?.data)
          setReviews([])
          toast.error('Failed to load reviews: Unexpected response format')
        }
      } catch (error) {
        debugError('? Error fetching deliveryman reviews:', {
          message: error?.message,
          response: error?.response?.data,
          status: error?.response?.status,
          url: error?.config?.url,
          method: error?.config?.method
        })
        debugError('? Full error response data:', JSON.stringify(error?.response?.data, null, 2))
        debugError('? Error stack:', error?.stack)
        setReviews([])
        const errorMessage = error?.response?.data?.message || 
                           error?.response?.data?.error ||
                           error?.message || 
                           'Failed to load deliveryman reviews'
        toast.error(`Error: ${errorMessage}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchReviews()
  }, [])

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Star className="w-5 h-5 text-[#6412c6]" />
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Deliveryman Reviews</h1>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                  {filteredReviews.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[250px]">
                <input
                  type="text"
                  placeholder="Ex : search delivery man"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all">
                    <Download className="w-4 h-4" />
                    <span className="text-black font-bold">Export</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
                  <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export as Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer">
                    <FileText className="w-4 h-4 mr-2" />
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("json")} className="cursor-pointer">
                    <Code className="w-4 h-4 mr-2" />
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                <span className="ml-2 text-sm text-slate-600">Loading reviews...</span>
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500">No reviews found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {visibleColumns.si && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>SI</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.orderId && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Order ID</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.deliveryman && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Deliveryman</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.deliverymanId && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Delivery Boy ID</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.customer && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Customer</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.review && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Review</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.rating && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Rating</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.date && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Date & Time</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredReviews.map((review) => (
                    <tr key={review.sl || review.orderId} className="hover:bg-slate-50 transition-colors">
                      {visibleColumns.si && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">{review.sl}</span>
                        </td>
                      )}
                      {visibleColumns.orderId && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-mono text-slate-700">{review.orderId || 'N/A'}</span>
                        </td>
                      )}
                      {visibleColumns.deliveryman && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <a href={`/ecs/delivery-partners/${review.deliverymanId}`} className="text-sm font-medium text-primary hover:text-primary-hover">
                            {review.deliveryman}
                          </a>
                        </td>
                      )}
                      {visibleColumns.deliverymanId && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-mono text-slate-600">
                            {review.deliverymanId ? (typeof review.deliverymanId === 'object' ? review.deliverymanId.toString() : review.deliverymanId.toString()) : 'N/A'}
                          </span>
                        </td>
                      )}
                      {visibleColumns.customer && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <a href={`/ecs/users/${review.customerId}`} className="text-sm font-medium text-primary hover:text-primary-hover">
                            {review.customer}
                          </a>
                        </td>
                      )}
                      {visibleColumns.review && (
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-700 flex-1 truncate max-w-xs">
                              {review.review || 'No review text'}
                            </span>
                            {review.review && review.review.trim() && (
                              <button
                                onClick={() => {
                                  setSelectedReview(review)
                                  setIsReviewModalOpen(true)
                                }}
                                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-900 flex-shrink-0"
                                title="View full review"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                      {visibleColumns.rating && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getRatingBadge(review.rating)}
                        </td>
                      )}
                      {visibleColumns.date && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm text-slate-700">{formatDateTime(review.submittedAt || review.deliveredAt)}</span>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Table Settings
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Columns className="w-4 h-4" />
                Visible Columns
              </h3>
              <div className="space-y-2">
                {Object.entries(columnsConfig).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[key]}
                      onChange={() => toggleColumn(key)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700">{label}</span>
                    {visibleColumns[key] && (
                      <Check className="w-4 h-4 text-emerald-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={resetColumns}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#6412c6] text-white hover:bg-[#550fa8] transition-all shadow-md"
              >
                Apply
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Review Detail Modal */}
      <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
        <DialogContent className="max-w-2xl bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Eye className="w-5 h-5 text-slate-600" />
              Review Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedReview && (
            <div className="px-6 py-6 space-y-6">
              {/* Order & Delivery Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-1">Order ID</p>
                  <p className="text-sm font-semibold text-slate-900 font-mono">{selectedReview.orderId || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-1">Delivery Boy ID</p>
                  <p className="text-sm font-semibold text-slate-900 font-mono">
                    {selectedReview.deliverymanId ? (typeof selectedReview.deliverymanId === 'object' ? selectedReview.deliverymanId.toString() : selectedReview.deliverymanId.toString()) : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Deliveryman & Customer */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#f7f3fc] rounded-lg p-4">
                  <p className="text-xs text-primary mb-1">Deliveryman</p>
                  <a 
                    href={`/ecs/delivery-partners/${selectedReview.deliverymanId}`}
                    className="text-sm font-semibold text-[#460d8b] hover:text-[#370a6d]"
                  >
                    {selectedReview.deliveryman}
                  </a>
                  {selectedReview.deliverymanPhone && (
                    <p className="text-xs text-primary mt-1">{selectedReview.deliverymanPhone}</p>
                  )}
                </div>
                <div className="bg-[#f7f3fc] rounded-lg p-4">
                  <p className="text-xs text-primary mb-1">Customer</p>
                  <a 
                    href={`/ecs/users/${selectedReview.customerId}`}
                    className="text-sm font-semibold text-[#460d8b] hover:text-[#370a6d]"
                  >
                    {selectedReview.customer}
                  </a>
                  {selectedReview.customerPhone && (
                    <p className="text-xs text-primary mt-1">{selectedReview.customerPhone}</p>
                  )}
                </div>
              </div>

              <div className="bg-[#f7f3fc] rounded-lg p-4">
                <p className="text-xs text-[#550fa8] mb-2 font-semibold">Rating</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {renderStars(selectedReview.rating)}
                  </div>
                  <span className="text-lg font-bold text-[#460d8b]">
                    {selectedReview.rating} / 5
                  </span>
                </div>
              </div>

              {/* Review Text */}
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-600 mb-2 font-semibold">Review Feedback</p>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {selectedReview.review || 'No review text provided'}
                </p>
              </div>

              {/* Date & Time */}
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-xs text-slate-600 mb-1">Submitted At</p>
                <p className="text-sm font-medium text-slate-900">
                  {formatDateTime(selectedReview.submittedAt || selectedReview.deliveredAt)}
                </p>
                {selectedReview.deliveredAt && (
                  <>
                    <p className="text-xs text-slate-600 mb-1 mt-3">Delivered At</p>
                    <p className="text-sm font-medium text-slate-900">
                      {formatDateTime(selectedReview.deliveredAt)}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="px-6 pb-6 pt-4 border-t border-slate-200">
            <button
              onClick={() => setIsReviewModalOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

