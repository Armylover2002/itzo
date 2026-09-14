import { useState, useMemo, useEffect } from "react"
import { Search, Download, ChevronDown, Filter, Star, RefreshCw, Calendar, Trash2, Eye, User, Mail, Phone, MessageSquare } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@food/components/ui/dialog"
import { adminAPI } from "@food/api"
import { toast } from "sonner"
import { exportReportsToCSV, exportReportsToExcel, exportReportsToPDF, exportReportsToJSON } from "@food/components/admin/reports/reportsExportUtils"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function FeedbackExperienceReport() {
  const [searchQuery, setSearchQuery] = useState("")
  const [feedbackExperiences, setFeedbackExperiences] = useState([])
  const [loading, setLoading] = useState(true)
  const [statistics, setStatistics] = useState(null)
  const [selectedFeedback, setSelectedFeedback] = useState(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    rating: "",
    experience: "",
    module: "",
  })
  const [isFilterOpen, setIsFilterOpen] = useState(true)

  // Fetch feedback experiences
  useEffect(() => {
    fetchFeedbackExperiences()
  }, [filters])

  const fetchFeedbackExperiences = async () => {
    try {
      setLoading(true)
      const params = {
        page: 1,
        limit: 1000,
        ...(filters.fromDate && { startDate: filters.fromDate }),
        ...(filters.toDate && { endDate: filters.toDate }),
        ...(filters.rating && { rating: filters.rating }),
        ...(filters.experience && { experience: filters.experience }),
        ...(filters.module && { module: filters.module }),
      }
      const response = await adminAPI.getFeedbackExperiences(params)
      if (response.data && response.data.data) {
        const rawData = response.data.data.feedbacks || []
        const formattedData = rawData.map(fb => ({
          _id: fb._id,
          userName: fb.userName || 'N/A',
          userEmail: fb.userEmail || 'N/A',
          userPhone: fb.userPhone || 'N/A',
          restaurantName: fb.restaurantId?.restaurantName || 'N/A',
          rating: fb.rating * 2, // Convert 1-5 back to 1-10 for UI
          experience: fb.comment || 'N/A',
          module: fb.module,
          createdAt: fb.createdAt
        }))
        setFeedbackExperiences(formattedData)
        setStatistics(response.data.data.statistics || null)
      }
    } catch (error) {
      debugError('Error fetching feedback experiences:', error)
      if (error.response?.status !== 401) {
        toast.error('Failed to fetch feedback experiences')
      }
    } finally {
      setLoading(false)
    }
  }

  const filteredFeedback = useMemo(() => {
    let result = [...feedbackExperiences]
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(feedback =>
        feedback.userName?.toLowerCase().includes(query) ||
        feedback.userEmail?.toLowerCase().includes(query) ||
        feedback.userPhone?.includes(query) ||
        feedback._id?.toString().includes(query)
      )
    }

    return result
  }, [feedbackExperiences, searchQuery])

  const handleReset = () => {
    setFilters({
      fromDate: "",
      toDate: "",
      rating: "",
      experience: "",
      module: "",
    })
    setSearchQuery("")
  }

  const handleExport = async (format) => {
    if (filteredFeedback.length === 0) {
      toast.error("No data to export")
      return
    }
    const headers = [
      { key: "sl", label: "SI" },
      { key: "userName", label: "User Name" },
      { key: "userEmail", label: "Email" },
      { key: "userPhone", label: "Phone" },
      { key: "rating", label: "Rating" },
      { key: "experience", label: "Experience" },
      { key: "module", label: "Module" },
      { key: "createdAt", label: "Date" },
    ]
    const exportData = filteredFeedback.map((fb, idx) => ({
      sl: idx + 1,
      userName: fb.userName || 'N/A',
      userEmail: fb.userEmail || 'N/A',
      userPhone: fb.userPhone || 'N/A',
      rating: fb.rating ?? 'N/A',
      experience: fb.experience || 'N/A',
      module: fb.module || 'N/A',
      createdAt: fb.createdAt
        ? new Date(fb.createdAt).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
        : 'N/A',
    }))
    switch (format) {
      case "csv": exportReportsToCSV(exportData, headers, "feedback_experience_report"); break;
      case "excel": exportReportsToExcel(exportData, headers, "feedback_experience_report"); break;
      case "pdf": await exportReportsToPDF(exportData, headers, "feedback_experience_report", "Feedback Experience Report"); break;
      case "json": exportReportsToJSON(exportData, "feedback_experience_report"); break;
    }
  }

  const handleDelete = async (id) => {
    try {
      await adminAPI.deleteFeedbackExperience(id)
      toast.success('Feedback deleted successfully')
      fetchFeedbackExperiences()
    } catch (error) {
      debugError('Error deleting feedback:', error)
      if (error.response?.status !== 401) {
        toast.error('Failed to delete feedback')
      }
    }
  }

  const handleViewDetails = (feedback) => {
    setSelectedFeedback(feedback)
    setShowDetailsDialog(true)
  }

  const getRatingColor = (rating) => {
    if (rating <= 2) return 'bg-red-100 text-red-700'
    if (rating <= 4) return 'bg-red-100 text-red-700'
    if (rating <= 6) return 'bg-yellow-100 text-yellow-700'
    if (rating <= 8) return 'bg-blue-100 text-blue-700'
    return 'bg-green-100 text-green-700'
  }

  const getExperienceLabel = (experience) => {
    const labels = {
      very_bad: 'Very Bad',
      bad: 'Bad',
      below_average: 'Below Average',
      average: 'Average',
      above_average: 'Above Average',
      good: 'Good',
      very_good: 'Very Good'
    }
    return labels[experience] || experience
  }

  const activeFiltersCount = (filters.fromDate ? 1 : 0) + (filters.toDate ? 1 : 0) + 
    (filters.rating ? 1 : 0) + (filters.experience ? 1 : 0) + (filters.module ? 1 : 0)

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen overflow-x-hidden">
      <div className="w-full max-w-full">
        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Feedback Experience Report</h1>
          </div>
        </div>

        {/* Filter Options Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center justify-between w-full mb-4"
          >
            <h3 className="text-sm font-semibold text-slate-700">Filter Options</h3>
            <ChevronDown
              className={`w-5 h-5 text-slate-600 transition-transform ${isFilterOpen ? "rotate-180" : ""}`}
            />
          </button>
          
          {isFilterOpen && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    From Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="date"
                      value={filters.fromDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    To Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="date"
                      value={filters.toDate}
                      onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))}
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Rating
                  </label>
                  <select
                    value={filters.rating}
                    onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value }))}
                    className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Ratings</option>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(r => (
                      <option key={r} value={r}>{r}/10</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>

                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Experience
                  </label>
                  <select
                    value={filters.experience}
                    onChange={(e) => setFilters(prev => ({ ...prev, experience: e.target.value }))}
                    className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Experiences</option>
                    <option value="very_bad">Very Bad</option>
                    <option value="bad">Bad</option>
                    <option value="below_average">Below Average</option>
                    <option value="average">Average</option>
                    <option value="above_average">Above Average</option>
                    <option value="good">Good</option>
                    <option value="very_good">Very Good</option>
                  </select>
                  <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>

                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Module
                  </label>
                  <select
                    value={filters.module}
                    onChange={(e) => setFilters(prev => ({ ...prev, module: e.target.value }))}
                    className="w-full px-4 py-2.5 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Modules</option>
                    <option value="user">User</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="delivery">Delivery</option>
                  </select>
                  <ChevronDown className="absolute right-2 bottom-2.5 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleReset}
                  className="px-6 py-2.5 text-sm font-medium rounded-lg border border-blue-500 text-blue-600 bg-white hover:bg-blue-50 transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset
                </button>
                <button 
                  onClick={fetchFeedbackExperiences}
                  className={`px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all flex items-center gap-2 relative ${
                    activeFiltersCount > 0 ? "ring-2 ring-blue-300" : ""
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filter
                  {activeFiltersCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Total Feedback</p>
                  <p className="text-2xl font-bold text-slate-900">{statistics.totalFeedback || 0}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Average Rating</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {statistics.averageRating ? statistics.averageRating.toFixed(1) : '0.0'}/10
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <Star className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Min Rating</p>
                  <p className="text-2xl font-bold text-slate-900">{statistics.minRating || 0}/10</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center">
                  <Star className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">Max Rating</p>
                  <p className="text-2xl font-bold text-slate-900">{statistics.maxRating || 0}/10</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <Star className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search and Export Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by user name, email, phone..."
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all">
                <Download className="w-4 h-4" />
                <span>Export</span>
                <ChevronDown className="w-3 h-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport('csv')}>CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')}>Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json')}>JSON</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Feedback Table Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold text-slate-900">Feedback Experiences</h2>
            <p className="text-sm text-slate-600">Total: {filteredFeedback.length}</p>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <p className="text-slate-600">Loading...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">SI</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Rating</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Experience</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Module</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredFeedback.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                          <p className="text-sm text-slate-500">No feedback experiences match your search</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredFeedback.map((feedback, idx) => (
                      <tr key={feedback._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">{idx + 1}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900">{feedback.userName || 'N/A'}</span>
                            {feedback.userEmail && (
                              <span className="text-xs text-slate-500">{feedback.userEmail}</span>
                            )}
                            {feedback.userPhone && (
                              <span className="text-xs text-slate-500">{feedback.userPhone}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRatingColor(feedback.rating)}`}>
                            {feedback.rating}/10
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm text-slate-700">{getExperienceLabel(feedback.experience)}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                            {feedback.module || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-xs text-slate-700">
                            {new Date(feedback.createdAt).toLocaleDateString()} {new Date(feedback.createdAt).toLocaleTimeString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewDetails(feedback)}
                              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(feedback._id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <DialogTitle className="text-xl font-bold text-slate-900">Feedback Details</DialogTitle>
          </DialogHeader>
          {selectedFeedback && (
            <div className="px-6 py-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">User Name</label>
                    <p className="text-sm text-slate-900 mt-1">{selectedFeedback.userName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">Email</label>
                    <p className="text-sm text-slate-900 mt-1 break-words">{selectedFeedback.userEmail || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">Experience</label>
                    <p className="text-sm text-slate-900 mt-1">{getExperienceLabel(selectedFeedback.experience)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">Date</label>
                    <p className="text-sm text-slate-900 mt-1">
                      {new Date(selectedFeedback.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-5">
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">Rating</label>
                    <p className="text-sm text-slate-900 mt-1">
                      <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-medium ${getRatingColor(selectedFeedback.rating)}`}>
                        {selectedFeedback.rating}/10
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">Phone</label>
                    <p className="text-sm text-slate-900 mt-1">{selectedFeedback.userPhone || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1 block">Module</label>
                    <p className="text-sm text-slate-900 mt-1">
                      <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                        {selectedFeedback.module || 'N/A'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="px-6 pb-6 pt-4 border-t border-slate-200">
            <button
              onClick={() => setShowDetailsDialog(false)}
              className="px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


