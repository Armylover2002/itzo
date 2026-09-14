import { useState, useMemo, useEffect } from "react";
import { 
  Search, Filter, Eye, Check, X, ArrowUpDown, Loader2, 
  User, Phone, Mail, MapPin, Clock, Building2, Store, Truck, 
  ShieldAlert, BadgeCheck, FileText, CheckCircle2, XCircle, RefreshCw
} from "lucide-react";
import { adminAPI } from "@food/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog";

export default function CustomerRoleRequests() {
  const [searchQuery, setSearchQuery] = useState("");
  const [requests, setRequests] = useState([]);
  const [allZones, setAllZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });

  // Fetch role requests and zones
  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqsResponse, zonesResponse] = await Promise.all([
        adminAPI.getCustomerRoleRequests(),
        adminAPI.getZones({ view: "summary" })
      ]);

      const requestsList = reqsResponse?.data?.data || reqsResponse?.data || [];
      const zonesList = zonesResponse?.data?.data?.zones || zonesResponse?.data?.zones || zonesResponse?.data || [];

      setRequests(Array.isArray(requestsList) ? requestsList : []);
      setAllZones(Array.isArray(zonesList) ? zonesList : []);
    } catch (error) {
      console.error("Error loading role requests:", error);
      toast.error("Failed to load customer role requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Helper to resolve zone name from ID
  const getZoneName = (zoneId) => {
    if (!zoneId) return "—";
    const zone = allZones.find(z => (z._id || z.id) === zoneId);
    return zone ? (zone.name || zone.zoneName || zone.serviceLocation) : "Unknown Zone";
  };

  // Format date helper
  const formatDateTime = (value) => {
    if (!value) return "—";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      const day = String(d.getDate()).padStart(2, "0");
      const month = d.toLocaleString("en-GB", { month: "short" });
      const year = d.getFullYear();
      const time = d.toLocaleString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return `${day} ${month} ${year}, ${time}`;
    } catch {
      return String(value);
    }
  };

  // Handle Sort
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // Filter and Sort requests
  const processedRequests = useMemo(() => {
    let result = [...requests];

    // Filter by role
    if (roleFilter !== "ALL") {
      result = result.filter(r => r.role === roleFilter);
    }

    // Filter by status
    if (statusFilter !== "ALL") {
      result = result.filter(r => r.status === statusFilter);
    }

    // Filter by search query (user name, email, phone, details shopName/restaurantName)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(r => {
        const userName = r.userId?.name?.toLowerCase() || "";
        const userEmail = r.userId?.email?.toLowerCase() || "";
        const userPhone = r.userId?.phone || "";
        
        const detailsShopName = r.details?.shopName?.toLowerCase() || "";
        const detailsRestName = r.details?.restaurantName?.toLowerCase() || "";
        const detailsName = r.details?.name?.toLowerCase() || "";

        return userName.includes(query) || 
               userEmail.includes(query) || 
               userPhone.includes(query) ||
               detailsShopName.includes(query) ||
               detailsRestName.includes(query) ||
               detailsName.includes(query);
      });
    }

    // Sort
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (sortConfig.key === "userName") {
          aVal = a.userId?.name || "";
          bVal = b.userId?.name || "";
        } else if (sortConfig.key === "createdAt") {
          aVal = new Date(a.createdAt || 0).getTime();
          bVal = new Date(b.createdAt || 0).getTime();
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [requests, roleFilter, statusFilter, searchQuery, sortConfig]);

  // Handle status update (Approve/Reject)
  const handleUpdateStatus = async (requestId, newStatus) => {
    try {
      setProcessingId(requestId);
      const response = await adminAPI.updateCustomerRoleRequestStatus(requestId, newStatus);
      
      if (response?.data?.success || response?.success) {
        toast.success(`Role request successfully ${newStatus.toLowerCase()}!`);
        
        // Optimistic local state update
        setRequests(prev => prev.map(r => 
          (r._id === requestId || r.id === requestId) ? { ...r, status: newStatus } : r
        ));
        
        // Close modal if open
        if (selectedRequest && (selectedRequest._id === requestId || selectedRequest.id === requestId)) {
          setSelectedRequest(prev => ({ ...prev, status: newStatus }));
          setShowDetailsModal(false);
        }
      } else {
        toast.error(response?.data?.message || `Failed to update request status.`);
      }
    } catch (error) {
      console.error("Error updating role request status:", error);
      toast.error(error?.response?.data?.message || "Failed to update role request status.");
    } finally {
      setProcessingId(null);
    }
  };

  // Get initials for Avatar
  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join("");
  };

  // Details Modal Renderer
  const renderDetailsModalContent = () => {
    if (!selectedRequest) return null;
    const { role, details, userId } = selectedRequest;

    return (
      <div className="space-y-6">
        {/* User Card */}
        <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Customer Information</h3>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-lg border border-red-200 dark:border-red-900/50">
              {getInitials(userId?.name)}
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-200">{userId?.name || "N/A"}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {userId?.email || "N/A"}</span>
                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {userId?.phone || "N/A"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Role Specific Details */}
        {role === "RESTAURANT" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Building2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">Restaurant Details</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Restaurant Name</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{details?.restaurantName || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Vegetarian Type</p>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1.5 ${
                  details?.pureVegRestaurant 
                    ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50" 
                    : "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50"
                }`}>
                  {details?.pureVegRestaurant ? "Pure Veg" : "Mixed"}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Owner Name</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{details?.ownerName || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Owner Contact Email</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5">{details?.ownerEmail || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Owner Phone</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{details?.ownerPhone || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Primary Contact Number</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{details?.primaryContactNumber || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Selected Zone</p>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400 mt-0.5">{getZoneName(details?.zoneId)}</p>
              </div>
            </div>

            {/* Address Sub-section */}
            <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 space-y-3">
              <h5 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" /> Location Details
              </h5>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="md:col-span-2">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Formatted Full Address</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 font-medium">{details?.location?.formattedAddress || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Address Line 1</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{details?.location?.addressLine1 || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Address Line 2</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{details?.location?.addressLine2 || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Area / Locality</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{details?.location?.area || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">City</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{details?.location?.city || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">State</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{details?.location?.state || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Pincode</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 font-semibold">{details?.location?.pincode || "N/A"}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Landmark</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{details?.location?.landmark || "—"}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {role === "SELLER" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Store className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">Seller Details</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Shop Name</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{details?.shopName || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Business Type</p>
                <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 mt-1.5">
                  {details?.businessType || "Grocery"}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Contact Person</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{details?.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Shop Email</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{details?.email || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Primary Phone</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{details?.phone || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Alternate Phone</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{details?.alternatePhone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Support Email</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{details?.supportEmail || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Selected Zone</p>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400 mt-0.5">{getZoneName(details?.zoneId)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Operating Hours</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" /> {details?.openingHours || "N/A"}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Shop Address</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{details?.address || "N/A"}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {role === "DELIVERY_BOY" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <Truck className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">Delivery Partner Details</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Full Name</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{details?.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Email Address</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{details?.email || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Vehicle Type</p>
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50 mt-1.5 uppercase">
                  {details?.vehicleType || "bike"}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Vehicle Model/Name</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{details?.vehicleName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Vehicle Plate Number</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 uppercase">{details?.vehicleNumber || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Driving License Number</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 uppercase tracking-wide">{details?.drivingLicenseNumber || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">PAN Card Number</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 uppercase tracking-wide">{details?.panNumber || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Aadhaar Card Number</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 tracking-wider">{details?.aadharNumber || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">City</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{details?.city || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">State</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">{details?.state || "N/A"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Residential Address</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <span>{details?.address || "N/A"}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Status Notice or Action Buttons */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-5 mt-6 flex items-center justify-end gap-3">
          {selectedRequest.status !== "PENDING" ? (
            <div className="w-full flex items-center justify-center p-3 rounded-lg border text-sm font-semibold bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              {selectedRequest.status === "APPROVED" ? (
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> This request has been APPROVED
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                  <XCircle className="w-4 h-4" /> This request has been REJECTED
                </span>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleUpdateStatus(selectedRequest._id || selectedRequest.id, "REJECTED")}
                disabled={processingId !== null}
                className="px-5 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingId === selectedRequest._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                Reject Request
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(selectedRequest._id || selectedRequest.id, "APPROVED")}
                disabled={processingId !== null}
                className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingId === selectedRequest._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Approve Request
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 min-h-screen bg-[#ffffffcc] dark:bg-[#0f0f0f88] transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/25 border border-red-500">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Customer Role Requests</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Verify and approve seller, restaurant, and delivery partner requests</p>
            </div>
          </div>
          <button 
            onClick={fetchData}
            disabled={loading}
            className="self-start md:self-auto p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a1a1a] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1.5 text-sm font-semibold transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Summary Metric Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Requests", count: requests.length, color: "text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800" },
            { label: "Pending Verification", count: requests.filter(r => r.status === "PENDING").length, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/30" },
            { label: "Approved Roles", count: requests.filter(r => r.status === "APPROVED").length, color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30" },
            { label: "Rejected Requests", count: requests.filter(r => r.status === "REJECTED").length, color: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border-rose-200/50 dark:border-rose-900/30" },
          ].map((card, idx) => (
            <div key={idx} className={`p-4 rounded-xl border ${card.color} shadow-sm transition-all hover:scale-[1.01]`}>
              <p className="text-xs font-bold uppercase tracking-wider opacity-75">{card.label}</p>
              <p className="text-2xl font-black mt-1">{card.count}</p>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="bg-white dark:bg-[#151515] rounded-xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Search inputs */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search by customer name, shop/restaurant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:focus:ring-red-500/50 dark:focus:border-red-500 transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            {/* Filter tags / Selectors */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Role filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-lg">
                {["ALL", "RESTAURANT", "SELLER", "DELIVERY_BOY"].map((role) => (
                  <button
                    key={role}
                    onClick={() => setRoleFilter(role)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      roleFilter === role
                        ? "bg-red-600 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    {role === "ALL" ? "All Roles" : role.replace("_", " ")}
                  </button>
                ))}
              </div>

              {/* Status filter */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-lg">
                {["ALL", "PENDING", "APPROVED", "REJECTED"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                      statusFilter === status
                        ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
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
        <div className="bg-white dark:bg-[#151515] rounded-xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-16">Sl</th>
                  <th 
                    className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => handleSort("userName")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Customer Details</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === "userName" ? "text-red-600" : "text-slate-400"}`} />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => handleSort("role")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Requested Role</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === "role" ? "text-red-600" : "text-slate-400"}`} />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Business Entity / Info</th>
                  <th 
                    className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => handleSort("createdAt")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Submission Date</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === "createdAt" ? "text-red-600" : "text-slate-400"}`} />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-left text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      <ArrowUpDown className={`w-3 h-3 ${sortConfig.key === "status" ? "text-red-600" : "text-slate-400"}`} />
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-28">Actions</th>
                </tr>
              </thead>
              
              <tbody className="bg-white dark:bg-[#151515] divide-y divide-slate-100 dark:divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-red-600 mb-3" />
                        <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Loading requests...</p>
                      </div>
                    </td>
                  </tr>
                ) : processedRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
                          <FileText className="w-6 h-6" />
                        </div>
                        <p className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">No requests found</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">There are no customer role requests matching your search or filters at the moment.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  processedRequests.map((request, index) => {
                    const reqId = request._id || request.id;
                    const details = request.details || {};
                    const role = request.role;

                    // Compute display details
                    let businessName = "N/A";
                    let secondaryInfo = "";

                    if (role === "RESTAURANT") {
                      businessName = details.restaurantName || "Restaurant Setup";
                      secondaryInfo = details.pureVegRestaurant ? "Pure Veg" : "Mixed";
                    } else if (role === "SELLER") {
                      businessName = details.shopName || "Seller Shop";
                      secondaryInfo = details.businessType || "Grocery";
                    } else if (role === "DELIVERY_BOY") {
                      businessName = details.name || "Delivery Partner";
                      secondaryInfo = `${details.vehicleType || "bike"} (${details.vehicleNumber || "No plate"})`;
                    }

                    return (
                      <tr key={reqId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{index + 1}</span>
                        </td>
                        
                        {/* Customer Column */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-sm shrink-0 border border-red-200/50 dark:border-red-900/30">
                              {getInitials(request.userId?.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{request.userId?.name || "N/A"}</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{request.userId?.email || "No email"}</p>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {role === "RESTAURANT" && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50">
                              <Building2 className="w-3.5 h-3.5" /> Restaurant
                            </span>
                          )}
                          {role === "SELLER" && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                              <Store className="w-3.5 h-3.5" /> Seller
                            </span>
                          )}
                          {role === "DELIVERY_BOY" && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
                              <Truck className="w-3.5 h-3.5" /> Delivery Boy
                            </span>
                          )}
                        </td>

                        {/* Business details */}
                        <td className="px-6 py-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{businessName}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{secondaryInfo}</p>
                          </div>
                        </td>

                        {/* Submitted Date */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{formatDateTime(request.createdAt)}</span>
                        </td>

                        {/* Status Badge */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {request.status === "PENDING" && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30">
                              Pending
                            </span>
                          )}
                          {request.status === "APPROVED" && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30">
                              <BadgeCheck className="w-3.5 h-3.5" /> Approved
                            </span>
                          )}
                          {request.status === "REJECTED" && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/30">
                              Rejected
                            </span>
                          )}
                        </td>

                        {/* Action Eye */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowDetailsModal(true);
                            }}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors border border-red-100 dark:border-red-900/30"
                            title="View request details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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

      {/* Complete Request Details Dialog */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col bg-white dark:bg-[#151515] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-0 overflow-hidden gap-0">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-black text-slate-800 dark:text-slate-200">Role Onboarding Details</DialogTitle>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">Submitted for {selectedRequest?.role.replace("_", " ")} role</p>
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
