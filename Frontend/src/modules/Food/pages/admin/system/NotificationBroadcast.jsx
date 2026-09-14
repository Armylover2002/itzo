import { useEffect, useMemo, useState } from "react";
import { BellRing, Loader2, Search, Send, Trash2 } from "lucide-react";
import { adminAPI } from "@food/api";

const TARGET_OPTIONS = [
  { value: "ALL", label: "All" },
  { value: "USER", label: "Users" },
  { value: "RESTAURANT", label: "Restaurants" },
  { value: "DELIVERY", label: "Delivery Partners" },
  { value: "CUSTOM", label: "Particular Persons" },
];

const getRows = (response) => {
  const payload = response?.data?.data;
  return (
    payload?.items ||
    payload?.restaurants ||
    payload?.partners ||
    payload?.customers ||
    payload?.users ||
    payload?.data ||
    payload?.rows ||
    response?.data?.items ||
    []
  );
};

const normalizeRecipients = (response, ownerType, mapper) =>
  getRows(response)
    .map((item) => mapper(item, ownerType))
    .filter((item) => item.ownerId);

const toDateLabel = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export default function NotificationBroadcast() {
  const [form, setForm] = useState({
    title: "",
    message: "",
    targetType: "ALL",
  });
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [allRecipients, setAllRecipients] = useState([]);
  const [selectedRecipients, setSelectedRecipients] = useState([]);

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await adminAPI.getBroadcastNotifications({ page: 1, limit: 50 });
      setHistory(response?.data?.data?.items || []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadRecipients = async () => {
    try {
      setRecipientLoading(true);
      const [customersRes, restaurantsRes, deliveryRes] = await Promise.all([
        adminAPI.getCustomers({ page: 1, limit: 500 }),
        adminAPI.getRestaurants({ page: 1, limit: 500 }),
        adminAPI.getDeliveryPartners({ page: 1, limit: 500 }),
      ]);

      const customers = normalizeRecipients(customersRes, "USER", (item, ownerType) => ({
        ownerType,
        ownerId: String(item?._id || item?.id || ""),
        label: String(item?.name || item?.phone || "User").trim(),
        subLabel: [item?.phone, item?.email].filter(Boolean).join(" • "),
      }));

      const restaurants = normalizeRecipients(restaurantsRes, "RESTAURANT", (item, ownerType) => ({
        ownerType,
        ownerId: String(item?._id || item?.id || ""),
        label: String(item?.restaurantName || item?.ownerName || "Restaurant").trim(),
        subLabel: [item?.ownerPhone, item?.ownerEmail].filter(Boolean).join(" • "),
      }));

      const deliveryPartners = normalizeRecipients(deliveryRes, "DELIVERY_PARTNER", (item, ownerType) => ({
        ownerType,
        ownerId: String(item?._id || item?.id || ""),
        label: String(item?.name || item?.phone || "Delivery Partner").trim(),
        subLabel: [item?.phone, item?.email].filter(Boolean).join(" • "),
      }));

      setAllRecipients([...customers, ...restaurants, ...deliveryPartners]);
    } catch {
      setAllRecipients([]);
    } finally {
      setRecipientLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (form.targetType !== "CUSTOM") return;
    if (allRecipients.length > 0) return;
    loadRecipients();
  }, [allRecipients.length, form.targetType]);

  useEffect(() => {
    if (form.targetType !== "CUSTOM") {
      setSelectedRecipients([]);
      setSearch("");
    }
  }, [form.targetType]);

  const filteredRecipients = useMemo(() => {
    const keyword = String(search || "").trim().toLowerCase();
    if (!keyword) return allRecipients;
    return allRecipients.filter((item) =>
      [item.label, item.subLabel, item.ownerType]
        .join(" ")
        .toLowerCase()
        .includes(keyword)
    );
  }, [allRecipients, search]);

  const selectedKeys = useMemo(
    () => new Set(selectedRecipients.map((item) => `${item.ownerType}:${item.ownerId}`)),
    [selectedRecipients]
  );

  const toggleRecipient = (recipient) => {
    const key = `${recipient.ownerType}:${recipient.ownerId}`;
    setSelectedRecipients((prev) =>
      prev.some((item) => `${item.ownerType}:${item.ownerId}` === key)
        ? prev.filter((item) => `${item.ownerType}:${item.ownerId}` !== key)
        : [...prev, recipient]
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    if (form.targetType === "CUSTOM" && selectedRecipients.length === 0) return;

    try {
      setSubmitting(true);
      await adminAPI.createBroadcastNotification({
        title: form.title.trim(),
        message: form.message.trim(),
        targetType: form.targetType,
        targetIds:
          form.targetType === "CUSTOM"
            ? selectedRecipients.map((item) => item.ownerId)
            : [],
        targets:
          form.targetType === "CUSTOM"
            ? selectedRecipients.map((item) => ({
                ownerType: item.ownerType,
                ownerId: item.ownerId,
              }))
            : [],
      });
      setForm({ title: "", message: "", targetType: "ALL" });
      setSelectedRecipients([]);
      setSearch("");
      window.dispatchEvent(new Event("adminBroadcastUpdated"));
      await loadHistory();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!id) return;
    try {
      await adminAPI.deleteBroadcastNotification(id);
      window.dispatchEvent(new Event("adminBroadcastUpdated"));
      await loadHistory();
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <BellRing className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Broadcast Notification</h1>
            <p className="text-sm text-slate-500 mt-1">
              Send one notification to all, role-based, or selected recipients without touching other admin flows.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Title</span>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Enter notification title"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Target Type</span>
              <select
                value={form.targetType}
                onChange={(event) => setForm((prev) => ({ ...prev, targetType: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {TARGET_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Message</span>
            <textarea
              value={form.message}
              onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              placeholder="Enter notification message"
              rows={5}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-y"
            />
          </label>

          {form.targetType === "CUSTOM" && (
            <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 space-y-4">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search users, restaurants, or delivery partners"
                  className="w-full text-sm bg-transparent outline-none"
                />
              </div>

              <div className="text-xs font-medium text-slate-500">
                Selected recipients: {selectedRecipients.length}
              </div>

              <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
                {recipientLoading ? (
                  <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading recipients...
                  </div>
                ) : filteredRecipients.length === 0 ? (
                  <div className="p-6 text-sm text-slate-500">No recipients found.</div>
                ) : (
                  filteredRecipients.map((recipient) => {
                    const key = `${recipient.ownerType}:${recipient.ownerId}`;
                    const checked = selectedKeys.has(key);
                    return (
                      <label
                        key={key}
                        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRecipient(recipient)}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">
                            {recipient.label}
                          </div>
                          <div className="text-xs text-slate-500">
                            {recipient.ownerType.replaceAll("_", " ")}
                            {recipient.subLabel ? ` • ${recipient.subLabel}` : ""}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Broadcast
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">History</h2>
            <p className="text-sm text-slate-500">Latest sent broadcasts and their targets.</p>
          </div>
        </div>

        {historyLoading ? (
          <div className="py-10 text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading history...
          </div>
        ) : history.length === 0 ? (
          <div className="py-10 text-sm text-slate-500">No broadcast notifications found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-3 pr-4 font-semibold">Title</th>
                  <th className="py-3 pr-4 font-semibold">Message</th>
                  <th className="py-3 pr-4 font-semibold">Target</th>
                  <th className="py-3 pr-4 font-semibold">Recipients</th>
                  <th className="py-3 pr-4 font-semibold">Date</th>
                  <th className="py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item?._id} className="border-b border-slate-100 align-top">
                    <td className="py-4 pr-4 font-semibold text-slate-900">{item?.title || "Notification"}</td>
                    <td className="py-4 pr-4 text-slate-600 max-w-sm">{item?.message || "-"}</td>
                    <td className="py-4 pr-4 text-slate-700">{item?.targetLabel || item?.targetType}</td>
                    <td className="py-4 pr-4 text-slate-700">{item?.targetCount || item?.targets?.length || 0}</td>
                    <td className="py-4 pr-4 text-slate-500 whitespace-nowrap">{toDateLabel(item?.createdAt)}</td>
                    <td className="py-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(item?._id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
