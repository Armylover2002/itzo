import { useState, useEffect } from "react";
import { FileText, Search, Trash2, Eye, Filter, Calendar, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, Clock, Info, AlertTriangle, AlertCircle, XCircle } from "lucide-react";
import axiosInstance from "@food/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const STATUS_OPTIONS = ["Pending", "Contacted", "In Progress", "Completed", "Rejected"];
const VENDOR_OPTIONS = ["ItzoFood Legal Partner", "Zolvit", "Plans4U", "AuditzPrime", "IndiaFilings"];
const LICENSE_OPTIONS = [
  "FSSAI License",
  "GST Registration",
  "Trademark Registration",
  "Trade License",
  "Shop & Establishment License",
  "Fire Safety NOC",
  "Pollution NOC",
  "Lease Agreement",
  "Vendor Agreement",
  "Franchise Agreement",
  "Other"
];

export default function LicensingRequestsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [licenseFilter, setLicenseFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    contacted: 0,
    inProgress: 0,
    completed: 0,
    rejected: 0
  });

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = {
        search: searchQuery || undefined,
        status: statusFilter || undefined,
        vendor: vendorFilter || undefined,
        licenseType: licenseFilter || undefined,
        city: cityFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        page,
        limit
      };

      const res = await axiosInstance.get("/licensing-request", { params });
      if (res.data.success) {
        setRequests(res.data.data.requests || []);
        setTotalPages(res.data.data.totalPages || 1);
        setTotalCount(res.data.data.total || 0);
        if (res.data.data.stats) {
          setStats(res.data.data.stats);
        }
      }
    } catch (error) {
      toast.error("Failed to fetch licensing requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [searchQuery, statusFilter, vendorFilter, licenseFilter, cityFilter, startDate, endDate, sortBy, page]);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this licensing request? This action is permanent.")) {
      try {
        const res = await axiosInstance.delete(`/licensing-request/${id}`);
        if (res.data.success) {
          toast.success("Request deleted successfully");
          fetchRequests();
        }
      } catch (error) {
        toast.error(error.response?.data?.message || "Failed to delete request");
      }
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setVendorFilter("");
    setLicenseFilter("");
    setCityFilter("");
    setStartDate("");
    setEndDate("");
    setSortBy("newest");
    setPage(1);
    toast.success("Filters reset successfully");
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "Pending":
        return "bg-amber-50 text-amber-700 border border-amber-200";
      case "Contacted":
        return "bg-[#f7f3fc] text-[#460d8b] border border-[#d8c4f1]";
      case "In Progress":
        return "bg-[#f7f3fc] text-[#460d8b] border border-[#d8c4f1]";
      case "Completed":
        return "bg-emerald-50 text-emerald-755 border border-emerald-250";
      case "Rejected":
        return "bg-rose-50 text-rose-700 border border-rose-200";
      default:
        return "bg-slate-50 text-slate-700 border border-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans antialiased text-slate-800">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-rose-500" />
            Licensing Requests
          </h1>
          <p className="text-xs text-slate-500 mt-1">Manage, verify, and route restaurant consulting and licensing applications.</p>
        </div>
        <button
          onClick={fetchRequests}
          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm text-xs font-bold"
          title="Refresh List"
        >
          <RefreshCw className="w-4 h-4 text-slate-550" />
          Refresh
        </button>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: "Total Requests", val: stats.total, color: "text-slate-900 bg-white border-slate-200", icon: Info },
          { label: "Pending", val: stats.pending, color: "text-amber-600 bg-amber-50/50 border-amber-100", icon: Clock },
          { label: "Contacted", val: stats.contacted, color: "text-primary bg-[#f7f3fc]/50 border-[#f0e7f9]", icon: Info },
          { label: "In Progress", val: stats.inProgress, color: "text-primary bg-[#f7f3fc]/50 border-[#f0e7f9]", icon: AlertTriangle },
          { label: "Completed", val: stats.completed, color: "text-green-600 bg-green-50/50 border-green-100", icon: CheckCircle },
          { label: "Rejected", val: stats.rejected, color: "text-rose-600 bg-rose-50/50 border-rose-100", icon: XCircle }
        ].map((item, idx) => {
          const IconComp = item.icon;
          return (
            <div key={idx} className={`bg-white rounded-2xl border p-5 shadow-sm ${item.color} flex items-center justify-between`}>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">{item.label}</span>
                <span className="text-2xl font-black block leading-none">{item.val}</span>
              </div>
              <IconComp className="w-5 h-5 opacity-60" />
            </div>
          );
        })}
      </div>

      {/* Filter panel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-6 space-y-4">
        
        {/* Row 1: Search & sorting */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-450">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search Restaurant Name, Owner Name, Email, Mobile..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-rose-500 focus:bg-white bg-slate-50/50 transition-all font-semibold"
            />
          </div>

          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2.5 w-full text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 bg-slate-50/50 transition-colors font-bold"
            >
              <option value="newest">Sort by: Newest</option>
              <option value="oldest">Sort by: Oldest</option>
              <option value="alphabetical">Sort by: Alphabetical</option>
            </select>
          </div>

          <div>
            <button
              onClick={handleResetFilters}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Row 2: Advanced filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
          
          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 w-full text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 bg-slate-50/50 transition-colors font-semibold"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Consultant</label>
            <select
              value={vendorFilter}
              onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 w-full text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 bg-slate-50/50 transition-colors font-semibold"
            >
              <option value="">All Consultants</option>
              {VENDOR_OPTIONS.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">License Required</label>
            <select
              value={licenseFilter}
              onChange={(e) => { setLicenseFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 w-full text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 bg-slate-50/50 transition-colors font-semibold"
            >
              <option value="">All Licenses</option>
              {LICENSE_OPTIONS.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">City</label>
            <input
              type="text"
              value={cityFilter}
              onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
              placeholder="e.g. Pune"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500 bg-slate-50/50 transition-colors font-semibold"
            />
          </div>

          <div className="col-span-2 md:col-span-1">
            <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Applied Date</label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="w-full p-1.5 text-[10px] rounded-lg border border-slate-200 focus:outline-none bg-slate-50/50 font-semibold"
              />
              <span className="text-[10px] text-slate-400">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-full p-1.5 text-[10px] rounded-lg border border-slate-200 focus:outline-none bg-slate-50/50 font-semibold"
              />
            </div>
          </div>

        </div>
      </div>

      {/* Listing Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-450 border-b border-slate-200">
                <th className="py-4 px-5">Restaurant Name</th>
                <th className="py-4 px-5">Owner Details</th>
                <th className="py-4 px-5">Consultant</th>
                <th className="py-4 px-5">City</th>
                <th className="py-4 px-5">Required Licenses</th>
                <th className="py-4 px-5 text-center">Status</th>
                <th className="py-4 px-5 text-right">Applied Date</th>
                <th className="py-4 px-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-20 text-center text-slate-400 font-medium">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500 mx-auto mb-4"></div>
                    Loading licensing requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-20 text-center text-slate-400 font-medium">
                    No licensing requests found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                requests.map(req => (
                  <tr key={req._id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="py-4 px-5 font-black text-slate-900 max-w-[200px] truncate">
                      {req.restaurantName}
                      {req.restaurantId && (
                        <span className="block text-[9px] text-slate-400 font-mono tracking-tighter mt-0.5">ID: {req.restaurantId}</span>
                      )}
                    </td>
                    <td className="py-4 px-5 font-semibold space-y-0.5">
                      <div className="text-slate-800">{req.ownerName}</div>
                      <div className="text-[10px] text-slate-450 font-medium">{req.email}</div>
                      <div className="text-[10px] text-slate-450 font-mono font-medium">{req.mobile}</div>
                    </td>
                    <td className="py-4 px-5 font-extrabold text-slate-700">{req.vendor}</td>
                    <td className="py-4 px-5 font-semibold text-slate-600">{req.city}</td>
                    <td className="py-4 px-5 max-w-[220px]">
                      <div className="flex flex-wrap gap-1">
                        {req.selectedLicenses.slice(0, 3).map((lic, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-bold">
                            {lic === 'Other' && req.otherLicenseText ? req.otherLicenseText : lic}
                          </span>
                        ))}
                        {req.selectedLicenses.length > 3 && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-450 text-[9px] font-bold">
                            +{req.selectedLicenses.length - 3} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-block ${getStatusBadge(req.status)}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right font-mono font-semibold text-slate-500">
                      {new Date(req.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      })}
                    </td>
                    <td className="py-4 px-5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => navigate(`/ecs/food/consulting/licensing-requests/${req._id}`)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                          title="View Request Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(req._id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-50 transition-colors"
                          title="Delete Request"
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

        {/* Table Footer / Pagination */}
        {!loading && requests.length > 0 && (
          <div className="bg-slate-50 px-5 py-3 border-t border-slate-150 flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Showing {requests.length} of {totalCount} requests</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-150 transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-150 transition-colors disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
