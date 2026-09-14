import { useState, useMemo, useEffect } from "react";
import { 
  Search, Eye, Check, X, ArrowUpDown, Loader2, 
  Clock, Store, ShieldAlert, BadgeCheck, FileText, CheckCircle2, XCircle, RefreshCw, Tag, AlertTriangle
} from "lucide-react";
import { adminApi } from "../services/adminApi";
import { useToast } from "@shared/components/ui/Toast";
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog";

const statusBadgeClass = (status) => {
  const value = String(status || "Pending").toLowerCase()
  if (value === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200"
  if (value === "rejected") return "bg-rose-50 text-rose-700 border-rose-200"
  return "bg-amber-50 text-amber-700 border-amber-200"
}

export default function SellerCouponRequest() {
  const { showToast } = useToast();
  const { user: authUser } = useAuth();
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser]);
  
  const [resolvedPermissions, setResolvedPermissions] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });

  useEffect(() => {
    let isMounted = true;
    const resolvePermissions = async () => {
      if (!currentUser || currentUser.role === "ADMIN") {
        if (isMounted) setResolvedPermissions({});
        return;
      }
      const existingPermissions = extractAdminPermissions(currentUser);
      if (Object.keys(existingPermissions).length > 0) {
        if (isMounted) setResolvedPermissions(existingPermissions);
        return;
      }
      const roleId = extractAdminRoleId(currentUser);
      if (!roleId) {
        if (isMounted) setResolvedPermissions({});
        return;
      }
      try {
        const rolePermissions = await fetchAdminRolePermissions(roleId);
        if (isMounted) setResolvedPermissions(rolePermissions);
      } catch {
        if (isMounted) setResolvedPermissions({});
      }
    };
    resolvePermissions();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const permissionKey = "quick::core_management::marketing_tools::seller_coupon_request";
  const canEdit = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "edit");

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getSellerCouponRequests();
      const list = response?.data?.data || response?.data?.results || response?.data || [];
      const sellerOnly = (Array.isArray(list) ? list : []).filter((r) => !r.type || r.type === "seller");
      setRequests(sellerOnly);
    } catch (error) {
      console.error("Error loading seller coupon requests:", error);
      showToast("Failed to load seller coupon requests.", "error");
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
        const sellerName = r.sellerName?.toLowerCase() || "";
        const code = r.code?.toLowerCase() || "";
        const desc = r.description?.toLowerCase() || "";
        return sellerName.includes(query) || code.includes(query) || desc.includes(query);
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
    if (!canEdit) {
      showToast("You do not have permission to modify coupon status.", "error");
      return;
    }
    try {
      setProcessingId(requestId);
      const response = await adminApi.updateSellerCouponRequestStatus(requestId, newStatus);
      
      if (response?.data?.success || response?.success) {
        showToast(`Coupon request successfully ${newStatus === "Approved" ? "approved & activated" : "rejected / deactivated"}!`, "success");
        
        setRequests(prev => prev.map(r => 
          (r._id === requestId || r.id === requestId) ? { ...r, status: newStatus } : r
        ));
        
        if (selectedRequest && (selectedRequest._id === requestId || selectedRequest.id === requestId)) {
          setSelectedRequest(prev => ({ ...prev, status: newStatus }));
          setShowDetailsModal(false);
        }
      } else {
        showToast(response?.data?.message || `Failed to update request status.`, "error");
      }
    } catch (error) {
      console.error("Error updating coupon status:", error);
      showToast(error?.response?.data?.message || "Failed to update coupon status.", "error");
    } finally {
      setProcessingId(null);
    }
  };

  const renderDetailsModalContent = () => {
    if (!selectedRequest) return null;

    return (
      <div className="space-y-6 font-sans">
        <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
            Seller Information
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 text-green-700 flex items-center justify-center font-bold text-base border border-green-200">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">
                {selectedRequest.sellerName || "Unknown Seller"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                ID: {selectedRequest.sellerId || "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <FileText className="w-5 h-5 text-green-600" />
            <h4 className="text-base font-bold text-slate-800">Coupon Parameters</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Coupon Code</p>
              <p className="text-sm font-extrabold text-slate-950 tracking-wider bg-slate-100 px-2.5 py-1 rounded border border-slate-300 inline-block mt-1">
                {selectedRequest.code}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Discount Value</p>
              <p className="text-sm font-bold text-slate-900 mt-1.5">
                {selectedRequest.discountType === "percentage" ? `${selectedRequest.discountValue}% OFF` : selectedRequest.discountType === 'free_delivery' ? 'Free Delivery' : `₹${selectedRequest.discountValue} FLAT OFF`}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">First Order Only</p>
              <p className="text-sm font-bold text-slate-900 mt-1.5">
                {selectedRequest.firstOrderOnly ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Minimum Order Value</p>
              <p className="text-sm font-bold text-slate-900 mt-1">₹{selectedRequest.minOrderValue || 0}</p>
            </div>
            {selectedRequest.maxDiscount && (
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Max Discount</p>
                <p className="text-sm font-bold text-slate-900 mt-1">₹{selectedRequest.maxDiscount}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Validity Period</p>
              <p className="text-sm font-bold text-slate-900 mt-1">
                {formatDate(selectedRequest.validFrom)} - {formatDate(selectedRequest.validTill)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Usage Limit</p>
              <p className="text-sm font-bold text-slate-900 mt-1">
                {selectedRequest.usageLimit ? `${selectedRequest.usageLimit} total uses (Max ${selectedRequest.perUserLimit || 1} per user)` : `Unlimited (Max ${selectedRequest.perUserLimit || 1} per user)`}
              </p>
            </div>
            {selectedRequest.description && (
              <div className="md:col-span-2">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Description</p>
                <p className="text-sm text-slate-700 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic">
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
                    <CheckCircle2 className="w-4 h-4" /> This coupon request has been APPROVED & ACTIVATED
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-rose-600">
                    <XCircle className="w-4 h-4" /> This coupon request has been REJECTED / DEACTIVATED
                  </span>
                )}
              </div>
              {canEdit && selectedRequest.status === "Approved" && (
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
              {canEdit && selectedRequest.status === "Rejected" && (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedRequest._id || selectedRequest.id, "Approved")}
                  disabled={processingId !== null}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                  {processingId === selectedRequest._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Activate
                </button>
              )}
            </>
          ) : (
            <>
              {canEdit && (
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
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 min-h-screen bg-slate-50 transition-colors duration-200 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-600 text-white flex items-center justify-center shadow-lg shadow-green-500/25 border border-green-500">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Seller Coupon Requests</h1>
              <p className="text-sm text-slate-500 font-medium">Verify, approve, reject or toggle seller requested coupon campaigns</p>
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
            { label: "Total Requests", count: requests.length, color: "text-slate-900 bg-white border-slate-200" },
            { label: "Pending Verification", count: requests.filter(r => (r.status || "Pending") === "Pending").length, color: "text-amber-600 bg-amber-50 border-amber-200/50" },
            { label: "Approved Coupons", count: requests.filter(r => r.status === "Approved").length, color: "text-emerald-600 bg-emerald-50 border-emerald-200/50" },
            { label: "Rejected / Deactivated", count: requests.filter(r => r.status === "Rejected").length, color: "text-rose-600 bg-rose-50 border-rose-200/50" },
          ].map((card, idx) => (
            <div key={idx} className={`p-4 rounded-xl border ${card.color} shadow-sm transition-all hover:scale-[1.01]`}>
              <p className="text-xs font-bold uppercase tracking-wider opacity-75">{card.label}</p>
              <p className="text-2xl font-black mt-1">{card.count}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Search inputs */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search by seller name, coupon code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            {/* Filter tags / Selectors */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                {["ALL", "PENDING", "APPROVED", "REJECTED"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      statusFilter === status
                        ? "bg-slate-850 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-800"
                    }`}
                    style={{
                      backgroundColor: statusFilter === status ? "#1e293b" : undefined
                    }}
                  >
                    {status === "ALL" ? "All Status" : status}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Requests Table Block */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16">Sl</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Seller Details</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Coupon Code</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Discount</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th 
                    className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort("createdAt")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Created Date</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === "createdAt" ? "text-green-600" : "text-slate-400"}`} />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider w-36">Actions</th>
                </tr>
              </thead>
              
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-3" />
                        <p className="text-sm font-semibold text-slate-700">Loading requests...</p>
                      </div>
                    </td>
                  </tr>
                ) : processedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                          <FileText className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-bold text-slate-800 mb-1">No requests found</p>
                        <p className="text-xs text-slate-500">There are no seller coupon requests matching your search or filters at the moment.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  processedRequests.map((request, index) => {
                    const reqId = request._id || request.id;
                    const status = request.status || "Pending";

                    return (
                      <tr key={reqId} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-slate-500">{index + 1}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-900">
                            {request.sellerName || "Unknown Seller"}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            ID: {request.sellerId || "—"}
                          </p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-extrabold text-slate-900 tracking-wider bg-slate-100 px-2.5 py-0.5 rounded border border-slate-300">
                            {request.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">
                          {request.discountType === "percentage" ? `${request.discountValue}% OFF` : request.discountType === 'free_delivery' ? 'Free Delivery' : `₹${request.discountValue} FLAT OFF`}
                          {request.firstOrderOnly && (
                            <p className="text-[10px] font-medium text-indigo-600 mt-0.5">First order only</p>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full border ${statusBadgeClass(status)}`}>
                            {status === "Approved" ? <BadgeCheck className="w-3.5 h-3.5" /> : status === "Rejected" ? <XCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                          {formatDate(request.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedRequest(request);
                                setShowDetailsModal(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
                              title="View Request"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            
                            {canEdit && (
                              <>
                                {status === "Pending" && (
                                  <>
                                    <button
                                      onClick={() => handleUpdateStatus(reqId, "Approved")}
                                      disabled={processingId !== null}
                                      className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 transition-colors disabled:opacity-50"
                                      title="Approve"
                                    >
                                      {processingId === reqId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    </button>
                                    <button
                                      onClick={() => handleUpdateStatus(reqId, "Rejected")}
                                      disabled={processingId !== null}
                                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors disabled:opacity-50"
                                      title="Reject"
                                    >
                                      {processingId === reqId ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                                    </button>
                                  </>
                                )}

                                {status === "Approved" && (
                                  <button
                                    onClick={() => handleUpdateStatus(reqId, "Rejected")}
                                    disabled={processingId !== null}
                                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors disabled:opacity-50"
                                    title="Deactivate Coupon"
                                  >
                                    {processingId === reqId ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <XCircle className="w-4 h-4" />
                                    )}
                                  </button>
                                )}

                                {status === "Rejected" && (
                                  <button
                                    onClick={() => handleUpdateStatus(reqId, "Approved")}
                                    disabled={processingId !== null}
                                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 transition-colors disabled:opacity-50"
                                    title="Activate Coupon"
                                  >
                                    {processingId === reqId ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Check className="w-4 h-4" />
                                    )}
                                  </button>
                                )}
                              </>
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
                <DialogTitle className="text-lg font-black text-slate-800">Seller Coupon Request Details</DialogTitle>
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
