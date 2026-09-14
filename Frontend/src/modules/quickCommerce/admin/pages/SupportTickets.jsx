import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../services/adminApi";
import { useToast } from "@shared/components/ui/Toast";
import { useAuth } from "@core/context/AuthContext";
import { getCurrentUser } from "@food/utils/auth";
import { canPerformAdminPermissionAction, extractAdminPermissions, extractAdminRoleId, fetchAdminRolePermissions } from "@food/utils/adminPermissions";
import { PAGINATION_CONFIG } from "@/shared/constants/pagination";

export default function SupportTickets() {
  const { showToast } = useToast();
  const { user: authUser } = useAuth();
  const currentUser = useMemo(() => authUser || getCurrentUser("admin"), [authUser]);
  const [resolvedPermissions, setResolvedPermissions] = useState({});

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

  const permissionKey = "quick::core_management::customer_support::tickets";
  const canEdit = canPerformAdminPermissionAction(currentUser, resolvedPermissions, permissionKey, "edit");
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGINATION_CONFIG.defaultPageSize);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ status: "", type: "", search: "" });
  const [drafts, setDrafts] = useState({});

  const stats = useMemo(() => {
    const totalTickets = tickets.length;
    const open = tickets.filter((ticket) => ticket.status === "open").length;
    const inProgress = tickets.filter((ticket) => ticket.status === "in-progress").length;
    const resolved = tickets.filter((ticket) => ticket.status === "resolved").length;
    return { totalTickets, open, inProgress, resolved };
  }, [tickets]);

  const loadTickets = async (nextPage = page, nextLimit = limit) => {
    setLoading(true);
    try {
      const res = await adminApi.getTickets({ ...filters, page: nextPage, limit: nextLimit });
      const data = res?.data?.data || {};
      setTickets(Array.isArray(data.tickets) ? data.tickets : []);
      setTotal(Number(data.total || 0));
      setPage(Number(data.page || nextPage));
    } catch {
      showToast("Failed to load quick support tickets", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTickets(1, limit);
    }, 250);
    return () => clearTimeout(timer);
  }, [filters.status, filters.type, filters.search, limit]);

  const updateTicket = async (id, patch) => {
    try {
      if (Object.prototype.hasOwnProperty.call(patch, "adminResponse")) {
        await adminApi.replyTicket(id, patch.adminResponse);
      }
      if (patch.status) {
        await adminApi.updateTicketStatus(id, patch.status);
      }
      setTickets((prev) =>
        prev.map((ticket) =>
          String(ticket._id) === String(id)
            ? { ...ticket, ...patch }
            : ticket,
        ),
      );
      showToast("Quick support ticket updated", "success");
    } catch {
      showToast("Failed to update quick support ticket", "error");
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Quick Support Desk</h1>
              <p className="text-sm text-slate-500 mt-1">Review and resolve tickets raised from quick-commerce profile support.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                placeholder="Search by issue, store, user or order"
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              />
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">All Status</option>
                <option value="open">Open</option>
                <option value="in-progress">In Progress</option>
                <option value="resolved">Resolved</option>
              </select>
              <select
                value={filters.type}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">All Types</option>
                <option value="order">Order</option>
                <option value="seller">Store</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Total {stats.totalTickets}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              Open {stats.open}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              In Progress {stats.inProgress}
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
              Resolved {stats.resolved}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-4 py-3">Ticket</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Store</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Issue</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Response</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">Loading quick support tickets...</td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">No quick support tickets found.</td>
                  </tr>
                ) : (
                  tickets.map((ticket) => (
                    <tr key={ticket._id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">#{String(ticket._id).slice(-6)}</div>
                        {ticket.sessionId ? <div className="text-xs text-slate-500 mt-1">Session: {ticket.sessionId}</div> : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                          {ticket.type === "seller" ? "store" : ticket.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {ticket.user?.name || ticket.user?.phone || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {ticket.storeName || ticket.seller?.shopName || ticket.seller?.name || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {ticket.orderNumber || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-slate-900">{ticket.issueType}</div>
                        {ticket.description ? (
                          <div className="text-xs text-slate-500 mt-1 max-w-xs whitespace-pre-wrap">{ticket.description}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={ticket.status}
                          disabled={!canEdit}
                          onChange={(e) => updateTicket(ticket._id, { status: e.target.value })}
                          className="border border-slate-200 rounded px-2 py-1 text-xs bg-white disabled:bg-slate-50 disabled:text-slate-500"
                        >
                          <option value="open">Open</option>
                          <option value="in-progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={drafts[ticket._id] ?? ticket.adminResponse ?? ""}
                          disabled={!canEdit}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [ticket._id]: e.target.value }))}
                          placeholder={canEdit ? "Write response" : "No permission to reply"}
                          className="border border-slate-200 rounded px-2 py-1 text-sm w-64 bg-white disabled:bg-slate-50 disabled:placeholder-slate-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {canEdit && (
                          <button
                            onClick={() => updateTicket(ticket._id, { adminResponse: drafts[ticket._id] ?? ticket.adminResponse ?? "" })}
                            className="px-3 py-1 rounded bg-primary text-white text-sm hover:bg-primary/90 transition-colors"
                          >
                            Save
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-4 border-t border-slate-100">
            <div className="text-sm text-slate-500">
              Showing {tickets.length === 0 ? 0 : (page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={(e) => {
                  const nextLimit = Number(e.target.value);
                  setLimit(nextLimit);
                  setPage(1);
                }}
                className="border border-slate-200 rounded px-2 py-1 text-sm bg-white"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <button
                onClick={() => loadTickets(Math.max(1, page - 1), limit)}
                disabled={page <= 1 || loading}
                className="px-3 py-1 rounded border border-slate-200 text-sm disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => loadTickets(page + 1, limit)}
                disabled={loading || page * limit >= total}
                className="px-3 py-1 rounded border border-slate-200 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
