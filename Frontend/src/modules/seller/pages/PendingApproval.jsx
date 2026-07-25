import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@core/context/AuthContext";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { sellerApi } from "../services/sellerApi";

export default function SellerPendingApproval() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadProfile = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setIsRefreshing(true);
    const sellerToken = localStorage.getItem("auth_seller");
    if (!sellerToken) {
      setIsLoading(false);
      setIsRefreshing(false);
      navigate("/seller/auth", { replace: true });
      return;
    }

    try {
      const response = await sellerApi.getProfile();
      const data = response?.data?.result || {};
      setProfile(data);

      const isApproved =
        data.approved !== false &&
        (!data.approvalStatus || data.approvalStatus === "approved");

      if (isApproved) {
        // Sync auth context so route guard also sees the updated user
        await refreshUser();
        toast.success("Your seller account has been approved!");
        navigate("/seller", { replace: true });
      }
    } catch (error) {
      if (error?.response?.status !== 401) {
        toast.error("Failed to load approval status");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
      </div>
    );
  }

  const isRejected = profile?.approvalStatus === "rejected";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#0f172a_0%,#111827_30%,#f8fafc_30%,#f8fafc_100%)] px-4 py-10 font-['Outfit'] md:px-8">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[36px] border border-white/10 bg-white shadow-[0_35px_100px_rgba(15,23,42,0.14)]"
        >
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.35),_transparent_28%),linear-gradient(135deg,#0f172a_0%,#14532d_100%)] px-8 py-10 text-white">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.3em]">
              {isRejected ? <ShieldAlert className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              {isRejected ? "Action needed" : "Approval in progress"}
            </div>
            <h1 className="mt-6 text-4xl font-black leading-tight">
              {isRejected
                ? "Your seller request needs one more update."
                : "Your seller request is now waiting for admin approval."}
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-white/78">
              {isRejected
                ? "Admin has not approved the current submission yet. Update the onboarding form and send a cleaner application."
                : "We saved your onboarding details and raised a joining request in quick-commerce admin. As soon as it gets approved, this seller account can enter the dashboard."}
            </p>
          </div>

          <div className="grid gap-6 p-8 md:grid-cols-3">
            {[
              {
                label: "Shop",
                value: profile?.shopName || "Store",
                tone: "bg-amber-50 text-amber-700",
              },
              {
                label: "Owner",
                value: profile?.name || "Seller",
                tone: "bg-emerald-50 text-emerald-700",
              },
              {
                label: "Status",
                value: isRejected ? "Rejected" : "Pending review",
                tone: isRejected ? "bg-rose-50 text-rose-700" : "bg-orange-50 text-orange-700",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
                  {item.label}
                </p>
                <p className={`mt-3 inline-flex rounded-full px-4 py-2 text-sm font-black ${item.tone}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mx-8 mb-8 rounded-[28px] border border-slate-100 bg-slate-50 p-6">
            <div className="flex items-start gap-4">
              <div className={`rounded-2xl p-3 ${isRejected ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"}`}>
                {isRejected ? <ShieldAlert className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-lg font-black text-slate-900">
                  {isRejected ? "ECS note" : "What happens next"}
                </p>
                <p className="mt-2 text-sm font-medium leading-7 text-slate-600">
                  {profile?.approvalNotes ||
                    (isRejected
                      ? "Please revisit onboarding, correct the details, and submit again for review."
                      : "Admin can now review your identity, payment details, and shop compliance docs from the quick-commerce panel.")}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-8 py-6 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-medium text-slate-500">
              Use refresh to check if approval has been granted.
            </p>
            <div className="flex flex-col gap-3 md:flex-row">
              {isRejected && (
                <button
                  type="button"
                  onClick={() => navigate("/seller/onboarding")}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
                >
                  Edit application
                </button>
              )}
              <button
                type="button"
                onClick={() => loadProfile(true)}
                disabled={isRefreshing}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-orange hover:bg-primary-hover active:bg-primary-dark px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition-colors disabled:opacity-70"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "Checking..." : "Refresh status"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}


