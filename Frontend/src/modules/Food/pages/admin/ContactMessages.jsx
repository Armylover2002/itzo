import { useState, useEffect, useMemo } from "react"
import { Search, ArrowUpDown, Settings, Folder, ChevronDown, Eye, Loader2, Star } from "lucide-react"
import { toast } from "sonner"
import { adminAPI } from "@food/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@food/components/ui/dropdown-menu"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

export default function ContactMessages() {
  const [searchQuery, setSearchQuery] = useState("")
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedFeedback, setSelectedFeedback] = useState(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [ratingFilter, setRatingFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchFeedbacks()
  }, [ratingFilter, currentPage, searchQuery])

  const fetchFeedbacks = async () => {
    try {
      setLoading(true)
      const params = {
        page: currentPage,
        limit: 10,
        rating: ratingFilter !== 'all' ? ratingFilter : undefined,
        search: searchQuery.trim() || undefined
      }
      
      const response = await adminAPI.getContactMessages(params)
      
      if (response.data && response.data.success) {
        setFeedbacks(response.data.data?.reviews || [])
        setTotalPages(response.data.data?.pagination?.totalPages || 1)
      } else {
        setFeedbacks([])
        setTotalPages(1)
      }
    } catch (error) {
      debugError('Error fetching reviews:', error)
      setFeedbacks([])
      setTotalPages(1)
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Failed to load reviews.'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleViewFeedback = (feedback) => {
    setSelectedFeedback(feedback)
    setIsViewDialogOpen(true)
  }

  const renderStars = (rating) => {
    const stars = []
    const count = Math.floor(rating || 0)
    
    for (let i = 0; i < count; i++) {
      stars.push(<Star key={i} className="w-5 h-5 fill-amber-500 text-amber-500" />)
    }
    return stars
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
        <span className="text-xs font-bold text-amber-700 leading-none">
          {rating}
        </span>
      </div>
    )
  }

  if (loading && feedbacks.length === 0) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading feedbacks...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">User Feedback</h1>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
              {feedbacks.length}
            </span>
          </div>

          <div className="flex gap-3">
            {/* Rating Filter */}
            <select
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="px-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
            >
              <option value="all">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>

            {/* Search */}
            <div className="relative flex-1 sm:flex-initial min-w-[250px]">
              <input
                type="text"
                placeholder="Ex: Search by name, email, order ID, restaurant, food items"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>SI</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Email</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Feedback</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Rating</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-2">
                    <span>Action</span>
                    <Settings className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {feedbacks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-20">
                    <div className="flex flex-col items-center justify-center">
                      <div className="relative mb-6">
                        <div className="w-32 h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center shadow-inner">
                          <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center shadow-md relative overflow-visible">
                            <Folder className="w-12 h-12 text-slate-400" />
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-3 bg-red-500 rounded-t-md z-10"></div>
                            <div className="absolute top-3 right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center z-10">
                              <span className="text-white text-xs font-bold">!</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <p className="text-lg font-semibold text-slate-700">No Feedback Found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                feedbacks.map((feedback, index) => (
                  <tr
                    key={feedback._id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-700">
                        {(currentPage - 1) * 10 + index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-900">{feedback.customer?.name || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700">{feedback.customer?.email || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <span className="text-sm text-slate-700 line-clamp-2">
                        {feedback.comment || 'No comment provided'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRatingBadge(feedback.rating)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors">
                            <Settings className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewFeedback(feedback)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* View Feedback Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700">
            <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white">Feedback Details</DialogTitle>
            <DialogDescription className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Complete information about the user and their feedback
            </DialogDescription>
          </DialogHeader>
          {selectedFeedback && (
            <div className="px-6 py-6 space-y-6">
              {/* User Information Section */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-3">
                  <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                  Customer Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer Name</label>
                    <p className="text-base font-semibold text-slate-900 dark:text-white">{selectedFeedback.customer?.name || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Address</label>
                    <p className="text-base font-semibold text-slate-900 dark:text-white break-all">{selectedFeedback.customer?.email || 'N/A'}</p>
                  </div>
                  {selectedFeedback.customer?.phone && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phone Number</label>
                      <p className="text-base font-semibold text-slate-900 dark:text-white">{selectedFeedback.customer.phone}</p>
                    </div>
                  )}
                </div>
              </div>

               {/* Rating Section */}
               <div className="bg-gradient-to-br from-yellow-50 to-red-50 dark:from-yellow-900/20 dark:to-red-900/20 rounded-xl p-5 border border-yellow-200 dark:border-yellow-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-3">
                  <div className="w-1 h-6 bg-gradient-to-b from-yellow-500 to-red-600 rounded-full"></div>
                  Rating
                </h3>
                <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      {renderStars(selectedFeedback.rating)}
                    </div>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {selectedFeedback.rating} / 5
                    </span>
                  </div>
                </div>
              </div>

              {/* Feedback Message Section */}
              {selectedFeedback.comment && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-3">
                    <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                    Feedback Comment
                  </h3>
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {selectedFeedback.comment}
                    </p>
                  </div>
                </div>
              )}

              {/* Order Details Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">Submitted At</label>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {selectedFeedback.submittedAt ? new Date(selectedFeedback.submittedAt).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button
                  variant="outline"
                  onClick={() => setIsViewDialogOpen(false)}
                  className="min-w-[100px]"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}

