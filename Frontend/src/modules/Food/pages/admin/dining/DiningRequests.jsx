import { useEffect, useState } from "react";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@food/api";
import { useAdminPermissions } from "@food/hooks/admin/useAdminPermissions";

const PERMISSION_KEY = "food::dining_management::dining_requests";

export default function DiningRequests() {
  const { canEdit } = useAdminPermissions(PERMISSION_KEY);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getDiningRequests({ status: "pending" });
      setRequests(res?.data?.data?.requests || []);
    } catch {
      toast.error("Failed to load dining requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

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
      <p className="mb-6 text-sm text-gray-500">Restaurants awaiting review to enable dine-in bookings</p>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-16 text-center text-gray-500">No pending dining requests.</div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req._id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{req.restaurant?.name || "Unknown restaurant"}</p>
                  <p className="text-xs text-gray-500">{req.restaurant?.phone || req.restaurant?.email}</p>
                  <p className="text-xs text-gray-400">Requested: {new Date(req.requestedAt).toLocaleString()}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-2">
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
