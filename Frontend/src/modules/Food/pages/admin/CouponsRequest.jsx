import { useState, useMemo, useEffect } from "react";
import { 
  Search, Eye, Check, X, ArrowUpDown, Loader2, 
  Clock, Store, ShieldAlert, BadgeCheck, FileText, CheckCircle2, XCircle, RefreshCw
} from "lucide-react";
import { adminAPI } from "@food/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog";

const statusBadgeClass = (status) => {
  const value = String(status || "Pending").toLowerCase()
  if (value === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (value === "rejected") return "bg-rose-50 text-rose-700 border-rose-200"
  return "bg-amber-50 text-amber-700 border-amber-200"
}

const formatLimit = (value) => {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? String(num) : "∞"
}

const formatUsage = (used, limit) => `${Number(used || 0)} / ${formatLimit(limit)}`

const formatCurrency = (value) => {
  const num = Number(value)
  return Number.isFinite(num) && num > 0 ? `₹${num}` : "—"
}

const formatDiscountLabel = (request) => {
  if (request.discountType === "flat-price" || request.discountType === "fixed") {
    return `₹${Number(request.discountValue || 0)} FLAT OFF`
  }
  const maxCap = Number(request.maxDiscount)
  return `${Number(request.discountValue || 0)}% OFF${Number.isFinite(maxCap) && maxCap > 0 ? ` (max ₹${maxCap})` : ""}`
}

export default function CouponsRequest() {
  const [searchQuery, setSearchQuery] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getRestaurantCoupons();
      const list = response?.data?.data || response?.data || [];
      const restaurantOnly = (Array.isArray(list) ? list : []).filter(r => r.type !== 'seller');
      setRequests(restaurantOnly);
    } catch (error) {
      console.error("Error loading coupon requests:", error);
      toast.error("Failed to load restaurant coupon requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (value) => {
    if (!value) return "—";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return String(value);
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const processedRequests = useMemo(() => {
    let result = [...requests];

    if (statusFilter !== "ALL") {
      result = result.filter(r => String(r.status || "Pending").toUpperCase() === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(r => {
        const restName = r.restaurantName?.toLowerCase() || r.sellerName?.toLowerCase() || "";
        const code = r.couponCode?.toLowerCase() || "";
        const desc = r.description?.toLowerCase() || "";
        return restName.includes(query) || code.includes(query) || desc.includes(query);
      });
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === "createdAt") {
          aVal = new Date(a.createdAt || 0).getTime();
          bVal = new Date(b.createdAt || 0).getTime();
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [requests, statusFilter, searchQuery, sortConfig]);

  const handleUpdateStatus = async (requestId, newStatus) => {
    try {
      setProcessingId(requestId);
      const response = await adminAPI.updateRestaurantCouponStatus(requestId, newStatus);
      
      if (response?.data?.success || response?.success) {
        toast.success(`Coupon request successfully ${newStatus.toLowerCase()}!`);
        
        setRequests(prev => prev.map(r => 
          (r._id === requestId || r.id === requestId) ? { ...r, status: newStatus } : r
        ));
        
        if (selectedRequest && (selectedRequest._id === requestId || selectedRequest.id === requestId)) {
          setSelectedRequest(prev => ({ ...prev, status: newStatus }));
          setShowDetailsModal(false);
        }
      } else {
        toast.error(response?.data?.message || `Failed to update request status.`);
      }
    } catch (error) {
      console.error("Error updating coupon request status:", error);
      toast.error(error?.response?.data?.message || "Failed to update coupon request status.");
    } finally {
      setProcessingId(null);
    }
  };

  const renderDetailsModalContent = () => {
    if (!selectedRequest) return null;

    return (
      <div className="space-y-6 font-sans">
        <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            {selectedRequest.type === 'seller' ? 'Seller Information' : 'Restaurant Information'}
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold text-base border border-red-200">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">
                {selectedRequest.type === 'seller' ? selectedRequest.sellerName : selectedRequest.restaurantName}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                ID: {selectedRequest.type === 'seller' ? selectedRequest.sellerId : selectedRequest.restaurantId}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <FileText className="w-5 h-5 text-red-600" />
            <h4 className="text-base font-bold text-slate-800">Coupon Details</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400 font-medium">Coupon Code</p>
              <p className="text-sm font-extrabold text-slate-900 tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-300 inline-block mt-1">
                {selectedRequest.couponCode}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Discount</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">{formatDiscountLabel(selectedRequest)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Customer Eligibility</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {selectedRequest.customerScope === "first-time" ? "First-time users only" : "All users"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Min Order Value</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {formatCurrency(selectedRequest.minOrderValue ?? selectedRequest.minOrderAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Max Discount</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {selectedRequest.discountType === "percentage"
                  ? formatCurrency(selectedRequest.maxDiscount)
                  : "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Per User Limit</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">{formatLimit(selectedRequest.perUserLimit)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Global Usage</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {formatUsage(selectedRequest.usedCount, selectedRequest.usageLimit)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Start Date</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">{formatDate(selectedRequest.startDate)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">End Date</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">
                {formatDate(selectedRequest.endDate || selectedRequest.expiryDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Submission Date</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">{formatDate(selectedRequest.createdAt)}</p>
            </div>
            {selectedRequest.description && (
              <div className="md:col-span-2">
                <p className="text-xs text-slate-400 font-medium">Description</p>
                <p className="text-sm text-slate-700 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100 italic">
                  "{selectedRequest.description}"
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Status Notice or Action Buttons */}
        <div className="border-t border-slate-100 pt-5 mt-6 flex flex-col sm:flex-row items-center justify-end gap-3 w-full">
          {selectedRequest.status !== "Pending" ? (
            <>
              <div className="flex-1 flex items-center justify-center p-3 rounded-lg border text-sm font-semibold bg-slate-50 border-slate-100 text-slate-600 w-full">
                {selectedRequest.status === "Approved" ? (
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" /> This coupon request has been APPROVED
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-rose-600">
                    <XCircle className="w-4 h-4" /> This coupon request has been REJECTED
                  </span>
                )}
              </div>
              {selectedRequest.status === "Approved" && (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedRequest._id || selectedRequest.id, "Rejected")}
                  disabled={processingId !== null}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  {processingId === selectedRequest._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  Deactivate
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleUpdateStatus(selectedRequest._id || selectedRequest.id, "Rejected")}
                disabled={processingId !== null}
                className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingId === selectedRequest._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                Reject
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(selectedRequest._id || selectedRequest.id, "Approved")}
                disabled={processingId !== null}
                className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingId === selectedRequest._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Approve
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 min-h-screen bg-[#ffffffcc] transition-colors duration-200 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/25 border border-red-500">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Coupons Request</h1>
              <p className="text-sm text-slate-500 font-medium">Verify and approve restaurant requested coupons & promo codes</p>
            </div>
          </div>
          <button 
            onClick={fetchData}
            disabled={loading}
            className="self-start md:self-auto p-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 flex items-center gap-1.5 text-sm font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Summary Metric Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Requests", count: requests.length, color: "text-slate-900 bg-slate-50 border-slate-200" },
            { label: "Pending Verification", count: requests.filter(r => (r.status || "Pending") === "Pending").length, color: "text-amber-600 bg-amber-50 border-amber-200/50" },
            { label: "Approved Coupons", count: requests.filter(r => r.status === "Approved").length, color: "text-emerald-600 bg-emerald-50 border-emerald-200/50" },
            { label: "Rejected Requests", count: requests.filter(r => r.status === "Rejected").length, color: "text-rose-600 bg-rose-50 border-rose-200/50" },
          ].map((card, idx) => (
            <div key={idx} className={`p-4 rounded-xl border ${card.color} shadow-sm transition-all hover:scale-[1.01]`}>
              <p className="text-xs font-bold uppercase tracking-wider opacity-75">{card.label}</p>
              <p className="text-2xl font-black mt-1">{card.count}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Search inputs */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search by restaurant name, coupon code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            {/* Filter tags / Selectors */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Status filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                {["ALL", "PENDING", "APPROVED", "REJECTED"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      statusFilter === status
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                  >
                    {status === "ALL" ? "All Status" : status}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Requests Table Block */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px]">
              <thead className="bg-slate-50 border-b border-slate-200/80">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider w-12">Sl</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Restaurant</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Coupon Code</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Discount</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Min Order</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Max Discount</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Per User</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Global Usage</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Start</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">End</th>
                  <th 
                    className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("createdAt")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Submitted</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === "createdAt" ? "text-red-600" : "text-slate-400"}`} />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-24">Actions</th>
                </tr>
              </thead>
              
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={14} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-3" />
                        <p className="text-base font-semibold text-slate-700">Loading requests...</p>
                      </div>
                    </td>
                  </tr>
                ) : processedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                          <FileText className="w-6 h-6" />
                        </div>
                        <p className="text-base font-bold text-slate-800 mb-1">No requests found</p>
                        <p className="text-xs text-slate-500">There are no coupon requests matching your search or filters at the moment.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  processedRequests.map((request, index) => {
                    const reqId = request._id || request.id;
                    const status = request.status || "Pending";

                    return (
                      <tr key={reqId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-semibold text-slate-500">{index + 1}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-slate-900">{request.restaurantName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">ID: {request.restaurantId}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-sm font-extrabold text-slate-900 tracking-wider bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300">
                            {request.couponCode}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold text-slate-700">
                          {request.customerScope === "first-time" ? "First-time" : "All users"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-slate-800">
                          {formatDiscountLabel(request)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-700">
                          {formatCurrency(request.minOrderValue ?? request.minOrderAmount)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-700">
                          {request.discountType === "percentage" ? formatCurrency(request.maxDiscount) : "N/A"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-700">
                          {formatLimit(request.perUserLimit)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-slate-800">
                          {formatUsage(request.usedCount, request.usageLimit)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-medium">
                          {formatDate(request.startDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-medium">
                          {formatDate(request.endDate || request.expiryDate)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 font-medium">
                          {formatDate(request.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${statusBadgeClass(status)}`}>
                            {status === "Approved" ? <BadgeCheck className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowDetailsModal(true);
                              }}
                              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors border border-red-100"
                              title="View Coupon Request"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {status === "Approved" && (
                              <button
                                onClick={() => handleUpdateStatus(reqId, "Rejected")}
                                disabled={processingId !== null}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 transition-colors disabled:opacity-50"
                                title="Deactivate Coupon"
                              >
                                {processingId === reqId ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <XCircle className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col bg-white border border-slate-200 rounded-xl shadow-2xl p-0 overflow-hidden gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-black text-slate-800">Coupon Request Details</DialogTitle>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Campaign approval review queue</p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 overflow-y-auto flex-1 scrollbar-thin">
            {renderDetailsModalContent()}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
