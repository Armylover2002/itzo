import { Bell, Clock, Loader2, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useAdminNotifications from "@food/hooks/useAdminNotifications";

export default function AdminNotifications() {
  const navigate = useNavigate();
  const { items, loading, clearAll, dismissOne } = useAdminNotifications();

  return (
    <div className="p-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
              <p className="text-sm text-slate-500">
                Approval and support alerts that need admin attention.
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              Clear all
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading notifications...
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-sm text-slate-500">No notifications found.</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item?.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => item?.path && navigate(item.path)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-base font-semibold text-slate-900">
                      {item?.title || "Notification"}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {item?.message || "-"}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{item?.timeLabel || "N/A"}</span>
                      {item?.metaLabel ? (
                        <>
                          <span>•</span>
                          <span>{item.metaLabel}</span>
                        </>
                      ) : null}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => dismissOne(item?.id)}
                    className="shrink-0 rounded-full p-2 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    aria-label="Delete notification"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
