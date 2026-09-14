import { useEffect, useState } from "react";
import { Loader2, Check, X, Search, MapPin, Store } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";
import { useAdminPermissions } from "@food/hooks/admin/useAdminPermissions";

const PERMISSION_KEY = "food::dining_management::dining_requests";

const TABS = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function DiningRequests() {
  const { canEdit } = useAdminPermissions(PERMISSION_KEY);
  const [activeTab, setActiveTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getDiningRequests({ status: activeTab, search: search || undefined });
      setRequests(res?.data?.data?.requests || []);
      setTotal(res?.data?.data?.total ?? 0);
    } catch {
      toast.error("Failed to load dining requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchRequests, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, search]);

  const handleApprove = async (id) => {
    try {
      setBusyId(id);
      await adminAPI.reviewDiningRequest(id, { decision: "approved" });
      toast.success("Dining request approved");
      fetchRequests();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to approve request");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id) => {
    try {
      setBusyId(id);
      await adminAPI.reviewDiningRequest(id, { decision: "rejected", rejectionReason: rejectReason });
      toast.success("Dining request rejected");
      setRejectingId(null);
      setRejectReason("");
      fetchRequests();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to reject request");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-bold text-gray-900 sm:text-2xl">Dining Requests</h1>
      <p className="mb-5 text-sm text-gray-500">Restaurants requesting (or reviewed for) dine-in bookings</p>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search restaurant, owner, phone..."
            className="rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-500">No {activeTab} dining requests.</div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">{total} {activeTab} request{total === 1 ? "" : "s"}</p>
          {requests.map((req) => (
            <div key={req._id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                    {req.restaurant?.profileImage ? (
                      <img src={req.restaurant.profileImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{req.restaurant?.name || "Unknown restaurant"}</p>
                      {req.restaurant?.businessType === "Street Food Vendor" && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">Street Vendor</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[req.status] || "bg-gray-100 text-gray-500"}`}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{req.restaurant?.ownerName} · {req.restaurant?.ownerPhone}</p>
                    {(req.restaurant?.area || req.restaurant?.city) && (
                      <p className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin className="h-3 w-3" /> {[req.restaurant?.area, req.restaurant?.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      Requested: {req.requestedAt ? new Date(req.requestedAt).toLocaleString() : "—"}
                      {req.reviewedAt && ` · Reviewed: ${new Date(req.reviewedAt).toLocaleString()}`}
                    </p>
                    {req.status === "rejected" && req.rejectionReason && (
                      <p className="mt-1 text-xs italic text-red-500">Reason: {req.rejectionReason}</p>
                    )}
                  </div>
                </div>
                {canEdit && activeTab === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => handleApprove(req._id)}
                      disabled={busyId === req._id}
                      className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      <Check className="h-4 w-4" /> Approve
                    </button>
                    <button
                      onClick={() => setRejectingId(rejectingId === req._id ? null : req._id)}
                      className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </div>
                )}
              </div>
              {rejectingId === req._id && (
                <div className="flex gap-2">
                  <input
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Rejection reason (optional)"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => handleReject(req._id)}
                    disabled={busyId === req._id}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    Confirm
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
