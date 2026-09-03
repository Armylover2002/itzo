import { useState, useEffect } from "react";
import { FileText, Search, Trash2, Eye, Filter, Calendar, Award, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import axiosInstance from "@food/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const STATUS_OPTIONS = ["Applied", "Shortlisted", "Interview Scheduled", "Rejected", "Hired"];

export default function JobApplicationsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [expFilter, setExpFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  
  const [applications, setApplications] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    pending: 0,
    shortlisted: 0,
    rejected: 0,
    hired: 0
  });

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await axiosInstance.get("/food/admin/careers/applications/stats");
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch stats", error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const params = {
        search: searchQuery || undefined,
        status: statusFilter || undefined,
        department: deptFilter || undefined,
        experience: expFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        page,
        limit
      };

      const res = await axiosInstance.get("/food/admin/careers/applications", { params });
      if (res.data.success) {
        setApplications(res.data.data.applications || []);
        setTotalPages(res.data.data.totalPages || 1);
        setTotalCount(res.data.data.total || 0);
      }
    } catch (error) {
      toast.error("Failed to fetch applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [searchQuery, statusFilter, deptFilter, expFilter, startDate, endDate, sortBy, page]);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this job application? This action cannot be undone.")) {
      try {
        const res = await axiosInstance.delete(`/food/admin/careers/applications/${id}`);
        if (res.data.success) {
          toast.success("Application deleted successfully");
          fetchApplications();
          fetchStats();
        }
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to delete application");
      }
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setDeptFilter("");
    setExpFilter("");
    setStartDate("");
    setEndDate("");
    setSortBy("newest");
    setPage(1);
    toast.success("Filters reset successfully");
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "Applied":
        return "bg-[#f7f3fc] text-primary border border-[#f0e7f9]";
      case "Shortlisted":
        return "bg-[#f7f3fc] text-primary border border-[#f0e7f9]";
      case "Interview Scheduled":
        return "bg-[#f7f3fc] text-primary border border-[#f0e7f9]";
      case "Rejected":
        return "bg-rose-50 text-rose-600 border border-rose-100";
      case "Hired":
        return "bg-emerald-50 text-emerald-600 border border-emerald-100";
      default:
        return "bg-slate-50 text-slate-600 border border-slate-100";
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6412c6] flex items-center justify-center shadow-lg shadow-[#6412c6]/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Job Applications</h1>
              <p className="text-xs text-slate-500 mt-0.5">Track and review applications submitted by job seekers.</p>
            </div>
          </div>
        </div>

        {/* Statistics Widgets */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Total Applications", value: stats.total, color: "text-slate-900", bg: "bg-white" },
            { label: "Today's Applications", value: stats.today, color: "text-primary", bg: "bg-[#f7f3fc]/50" },
            { label: "Pending Review", value: stats.pending, color: "text-amber-600", bg: "bg-amber-50/50" },
            { label: "Shortlisted", value: stats.shortlisted, color: "text-primary", bg: "bg-[#f7f3fc]/50" },
            { label: "Rejected", value: stats.rejected, color: "text-rose-600", bg: "bg-rose-50/50" },
            { label: "Hired", value: stats.hired, color: "text-emerald-600", bg: "bg-emerald-50/50" },
          ].map((card, idx) => (
            <div key={idx} className={`${card.bg} rounded-2xl p-4 border border-slate-200 flex flex-col justify-between shadow-sm`}>
              <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">{card.label}</span>
              {statsLoading ? (
                <div className="h-8 w-12 bg-slate-200 animate-pulse rounded-md mt-2" />
              ) : (
                <span className={`text-2xl font-black ${card.color} mt-2`}>{card.value}</span>
              )}
            </div>
          ))}
        </div>

        {/* Filter Controls Accordion */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4 text-slate-700 font-bold border-b border-slate-100 pb-3">
            <Filter className="w-4 h-4 text-[#6412c6]" />
            <span>Search & Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search query */}
            <div className="relative">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Search Keywords</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Name, email, phone, job..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  className="pl-9 pr-4 py-2 w-full text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#6412c6] focus:bg-white transition-colors"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 w-full text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#6412c6] focus:bg-white transition-colors"
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Department</label>
              <input
                type="text"
                placeholder="e.g. Engineering, Sales"
                value={deptFilter}
                onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 w-full text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#6412c6] focus:bg-white transition-colors"
              />
            </div>

            {/* Experience Filter */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Experience</label>
              <input
                type="text"
                placeholder="e.g. 2 years, Freshers"
                value={expFilter}
                onChange={(e) => { setExpFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 w-full text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#6412c6] focus:bg-white transition-colors"
              />
            </div>

            {/* Date range filter */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                  className="pl-9 pr-3 py-2 w-full text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#6412c6] focus:bg-white transition-colors"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">End Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                  className="pl-9 pr-3 py-2 w-full text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#6412c6] focus:bg-white transition-colors"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

            {/* Sorting */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 w-full text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#6412c6] focus:bg-white transition-colors"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
            </div>

            {/* Reset / Actions */}
            <div className="flex items-end gap-2">
              <button
                onClick={handleResetFilters}
                className="flex-grow py-2 text-xs font-bold text-[#550fa8] hover:text-white border border-[#d8c4f1] hover:bg-[#6412c6] rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Applications List Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <span className="font-bold text-slate-800">Applications Available ({totalCount})</span>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-[#6412c6]" />
                <span className="text-xs text-slate-500">Loading applications...</span>
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-20">
                <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="font-bold text-slate-800">No applications found</h3>
                <p className="text-xs text-slate-500 mt-1">Try resetting filters or adjusting search terms.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-6">Applicant Name</th>
                    <th className="py-3 px-6">Applied Job / Department</th>
                    <th className="py-3 px-6">Email / Phone</th>
                    <th className="py-3 px-6">Experience / Qualification</th>
                    <th className="py-3 px-6">Applied Date</th>
                    <th className="py-3 px-6 text-center">Status</th>
                    <th className="py-3 px-6 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {applications.map((app) => (
                    <tr key={app._id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name */}
                      <td className="py-4 px-6 font-bold text-slate-850">
                        {app.applicantName}
                      </td>

                      {/* Job Title / Department */}
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-700">{app.jobTitle}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{app.department}</div>
                      </td>

                      {/* Contact info */}
                      <td className="py-4 px-6">
                        <div className="text-slate-600">{app.email}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{app.mobile}</div>
                      </td>

                      {/* Experience / Qualification */}
                      <td className="py-4 px-6">
                        <div className="text-slate-600">{app.experience || "N/A"}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">{app.qualification}</div>
                      </td>

                      {/* Date */}
                      <td className="py-4 px-6 text-slate-500 font-medium">
                        {new Date(app.appliedAt).toLocaleDateString()}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusBadge(app.status)}`}>
                          {app.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex justify-center items-center gap-1.5">
                          <button
                            onClick={() => navigate(`/ecs/food/careers/applications/${app._id}`)}
                            className="p-2 hover:bg-slate-100 text-slate-600 hover:text-[#6412c6] rounded-lg transition-all"
                            title="View Application"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(app._id)}
                            className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Controls */}
          {!loading && applications.length > 0 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50/50">
              <span className="font-semibold text-slate-500">
                Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalCount)} of {totalCount} applications
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <span className="font-bold text-slate-700 px-2">Page {page} of {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-white"
                >
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Simple loader helper inline to prevent dependency warnings
function Loader2({ className }) {
  return (
    <div className={`animate-spin rounded-full border-4 border-slate-200 border-t-[#6412c6] ${className}`} />
  );
}
