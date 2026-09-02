import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@core/context/AuthContext";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { sellerApi } from "../services/sellerApi";
import { formatOpeningHoursAMPM } from "@shared/utils/timeFormat";
import { SELLER_LIVE_UPDATE_EVENT } from "../components/SellerLiveUpdates";

const asDate = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString("en-IN");
};

const hasValue = (value) => String(value ?? "").trim().length > 0;

/**
 * Read-only recap of what the seller submitted. While an application is under review the
 * details are locked, so this is a plain summary with no inputs — re-applying after a
 * rejection is the only way back into the editable form.
 */
const buildSubmittedSections = (profile) => {
  if (!profile) return [];

  const { shopInfo = {}, documents = {}, bankInfo = {}, location = {} } = profile;
  const address =
    profile.address ||
    location.formattedAddress ||
    location.address ||
    "";
  const lat = location.latitude ?? location.lat;
  const lng = location.longitude ?? location.lng;

  const sections = [
    {
      title: "Store details",
      rows: [
        ["Business type", shopInfo.businessType || "Quick Commerce"],
        ["Shop name", profile.shopName],
        ["Owner name", profile.name],
        ["Email", profile.email],
        ["Primary phone", profile.phone],
        ["Alternate phone", shopInfo.alternatePhone],
        ["Support email", shopInfo.supportEmail],
        ["Service zone", shopInfo.zoneName],
        ["Opening hours", shopInfo.openingHours ? formatOpeningHoursAMPM(shopInfo.openingHours) : ""],
        ["Store address", address],
        [
          "Map pin",
          Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
            ? `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
            : "",
        ],
      ],
    },
    {
      title: "Compliance",
      rows: [
        ["PAN number", documents.panNumber],
        ["GST registered", documents.gstRegistered ? "Yes" : "No"],
        ["GST number", documents.gstNumber],
        ["GST legal name", documents.gstLegalName],
        ["FSSAI number", documents.fssaiNumber],
        ["FSSAI expiry", asDate(documents.fssaiExpiry)],
        ["Shop license", documents.shopLicenseNumber],
        ["Shop license expiry", asDate(documents.shopLicenseExpiry)],
      ],
    },
    {
      title: "Bank & UPI",
      rows: [
        ["Bank name", bankInfo.bankName],
        ["Account holder", bankInfo.accountHolderName],
        ["Account number", bankInfo.accountNumber],
        ["IFSC code", bankInfo.ifscCode],
        ["Account type", bankInfo.accountType],
        ["UPI ID", bankInfo.upiId],
      ],
    },
  ];

  const documentImages = [
    ["Shop photo", shopInfo.shopImage],
    ["FSSAI image", documents.fssaiImage],
    ["Shop license image", documents.shopLicenseImage],
    ["UPI QR image", bankInfo.upiQrImage],
  ].filter((entry) => entry && hasValue(entry[1]));

  return [
    ...sections
      .map((section) => ({
        ...section,
        rows: section.rows.filter(([, value]) => hasValue(value)),
        images: [],
      }))
      .filter((section) => section.rows.length > 0),
    ...(documentImages.length
      ? [
          {
            title: "Uploaded documents",
            rows: [],
            images: documentImages,
          },
        ]
      : []),
  ];
};

export default function SellerPendingApproval() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState(user || null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // AuthContext already loads `/seller/profile` for the route guard — reuse it so this
  // page does not fire a second identical request on mount.
  useEffect(() => {
    if (user) setProfile(user);
  }, [user]);

  const loadProfile = useCallback(async ({ silent = false } = {}) => {
    const sellerToken = localStorage.getItem("auth_seller");
    if (!sellerToken) {
      navigate("/seller/auth", { replace: true });
      return;
    }

    if (!silent) setIsRefreshing(true);
    try {
      const response = await sellerApi.getProfile({ forceRefresh: true });
      const data = response?.data?.result || {};
      setProfile(data);

      const isApproved =
        data.approved !== false &&
        (!data.approvalStatus || data.approvalStatus === "approved");

      if (isApproved) {
        await refreshUser({ forceRefresh: true });
        toast.success("Your seller account has been approved!");
        navigate("/seller", { replace: true });
      }
    } catch (error) {
      if (!silent && error?.response?.status !== 401) {
        toast.error("Failed to load approval status");
      }
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [navigate, refreshUser]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadProfile({ silent: true });
    }, 12000);
    const onLive = () => {
      loadProfile({ silent: true });
    };
    window.addEventListener(SELLER_LIVE_UPDATE_EVENT, onLive);
    return () => {
      clearInterval(timer);
      window.removeEventListener(SELLER_LIVE_UPDATE_EVENT, onLive);
    };
  }, [loadProfile]);

  const isRejected = profile?.approvalStatus === "rejected";
  const submittedSections = useMemo(() => buildSubmittedSections(profile), [profile]);

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-700" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans seller-theme-scope">
      <div className="flex w-full flex-col px-4 py-8 lg:px-12 mx-auto justify-center">
        <div className="mx-auto w-full max-w-xl">
          
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900">
              {isRejected
                ? "Action Needed"
                : "Approval in Progress"}
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              {isRejected
                ? "Your seller request needs one more update."
                : "Your seller request is now waiting for admin approval."}
            </p>
          </div>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 sm:p-8 shadow-[0_2px_12px_rgba(15,23,42,0.03)] space-y-6">
            
            <p className="text-sm font-medium leading-relaxed text-slate-600 border-b border-slate-100 pb-6">
              {isRejected
                ? "Admin has not approved the current submission yet. Update the onboarding form and send a cleaner application."
                : "We saved your onboarding details and raised a joining request in quick-commerce admin. As soon as it gets approved, this seller account can enter the dashboard."}
            </p>

            <div className="flex flex-col gap-3">
              {[
                { label: "Shop Name", value: profile?.shopName || "Store" },
                { label: "Owner", value: profile?.name || "Seller" },
                { label: "Status", value: isRejected ? "Rejected" : "Pending review" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 h-11">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {item.label}
                  </p>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 shrink-0 ${isRejected ? "text-red-500" : "text-green-500"}`}>
                  {isRejected ? <ShieldAlert className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {isRejected ? "Admin note" : "What happens next"}
                  </p>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">
                    {profile?.approvalNotes ||
                      (isRejected
                        ? "Please revisit onboarding, correct the details, and submit again for review."
                        : "Admin can now review your identity, payment details, and shop compliance docs from the quick-commerce panel.")}
                  </p>
                </div>
              </div>
            </div>

            {submittedSections.length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-bold text-slate-900">Submitted application</p>
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-100">
                    Locked while under review
                  </span>
                </div>

                <div className="space-y-5">
                  {submittedSections.map((section) => (
                    <div key={section.title}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-red-600">
                        {section.title}
                      </p>
                      {section.rows.length > 0 && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {section.rows.map(([label, value]) => (
                            <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {label}
                              </p>
                              <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {section.images?.length > 0 && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {section.images.map(([label, url]) => (
                            <a
                              key={label}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-red-200"
                            >
                              <div className="aspect-[4/3] bg-slate-50">
                                <img
                                  src={url}
                                  alt={label}
                                  className="h-full w-full object-contain p-2"
                                />
                              </div>
                              <p className="border-t border-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 group-hover:text-red-600">
                                {label}
                              </p>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <p className="mb-3 text-xs font-medium text-slate-500">
                {isRejected
                  ? "Your saved application can be edited and submitted again for admin review."
                  : "Use refresh to check if approval has been granted."}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                {isRejected && (
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.setItem("sellerReonboard", "true");
                      navigate("/seller/onboarding");
                    }}
                    className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 sm:flex-none"
                  >
                    Edit & Re-apply
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => loadProfile()}
                  disabled={isRefreshing}
                  className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition disabled:opacity-70 sm:flex-none ${
                    isRejected
                      ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      : "bg-red-600 text-white hover:bg-red-700"
                  }`}
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  {isRefreshing ? "Checking..." : "Refresh status"}
                </button>
              </div>
            </div>

          </section>
        </div>
      </div>
    </div>
  );
}
