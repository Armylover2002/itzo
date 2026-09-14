import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AlertTriangle, CalendarDays, FileEdit, PlusCircle } from "lucide-react";

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

const mapSnapshotVehicles = (vehicles = []) =>
  (Array.isArray(vehicles) ? vehicles : []).map((v, index) => {
    const id = String(v?.id || v?._id || `veh-${index + 1}`);
    return {
      id,
      vehicleId: String(v?.vehicleId || ""),
      name: String(v?.vehicleName || v?.name || "Vehicle"),
      category: String(v?.vehicleCode || v?.category || ""),
      iconUrl: "",
      registrationNumber: String(v?.vehicleNumber || v?.registrationNumber || "")
        .trim()
        .toUpperCase(),
      model: String(v?.model || ""),
      status: "Draft",
      existingDocs: {
        vehiclePhoto: v?.vehiclePhoto || "",
        rc: v?.rcPhoto || "",
        insurance: v?.insurancePhoto || "",
        fitness: v?.fitnessPhoto || "",
        pollution: v?.pollutionPhoto || "",
        permit: v?.permitPhoto || "",
      },
    };
  });

export default function RejectedOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();

  const rejection = useMemo(() => {
    const fromState = location.state?.rejection || null;
    if (fromState) return fromState;
    try {
      const raw = sessionStorage.getItem("deliveryRejectionContext");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [location.state]);

  const reason =
    rejection?.rejectionReason ||
    "Your application was rejected by admin. Please review and resubmit.";
  const rejectedAt = rejection?.rejectedAt || null;
  const phone = rejection?.phone || "";

  const startEditExisting = () => {
    const snap = rejection?.rejectedSubmission?.snapshot || {};
    const vehicles = mapSnapshotVehicles(snap.driverVehicles);

    const details = {
      name: snap.name || "",
      phone: String(phone || snap.phone || "").replace(/\D/g, "").slice(-10),
      countryCode: snap.countryCode || "+91",
      email: snap.email || "",
      address: snap.address || "",
      city: snap.city || "",
      state: snap.state || "",
      drivingLicenseNumber: snap.drivingLicenseNumber || "",
      panNumber: snap.panNumber || "",
      aadharNumber: snap.aadharNumber || "",
      vehicles,
      ref: "",
    };

    const docs = {
      profilePhoto: snap.profilePhoto || null,
      aadharPhoto: snap.aadharPhoto || null,
      panPhoto: snap.panPhoto || null,
      drivingLicensePhoto: snap.drivingLicensePhoto || null,
    };

    vehicles.forEach((v) => {
      const ed = v.existingDocs || {};
      if (ed.vehiclePhoto) docs[`vehiclePhoto_${v.id}`] = ed.vehiclePhoto;
      if (ed.rc) docs[`rc_${v.id}`] = ed.rc;
      if (ed.insurance) docs[`insurance_${v.id}`] = ed.insurance;
      if (ed.fitness) docs[`fitness_${v.id}`] = ed.fitness;
      if (ed.pollution) docs[`pollution_${v.id}`] = ed.pollution;
      if (ed.permit) docs[`permit_${v.id}`] = ed.permit;
    });

    try {
      indexedDB.deleteDatabase("DeliverySignupDB");
    } catch {
      /* ignore */
    }

    sessionStorage.setItem("deliverySignupDetails", JSON.stringify(details));
    sessionStorage.setItem("deliverySignupDocs", JSON.stringify(docs));
    sessionStorage.setItem("deliveryIsRejected", "true");
    sessionStorage.setItem("deliveryNeedsRegistration", "true");
    sessionStorage.setItem("deliverySubmissionType", "edit_existing");
    sessionStorage.setItem(
      "deliveryRejectionContext",
      JSON.stringify(rejection || {})
    );

    navigate("/food/delivery/signup/details", {
      // Push so browser Back returns to Rejected (do not replace Rejected out of history).
      replace: false,
      state: { backTo: "/food/delivery/onboarding/rejected" },
    });
  };

  const startNewOnboarding = () => {
    try {
      indexedDB.deleteDatabase("DeliverySignupDB");
    } catch {
      /* ignore */
    }

    const digits = String(phone || "").replace(/\D/g, "").slice(-10);
    sessionStorage.setItem(
      "deliverySignupDetails",
      JSON.stringify({
        name: "",
        phone: digits,
        countryCode: "+91",
        email: "",
        address: "",
        city: "",
        state: "",
        vehicles: [],
        drivingLicenseNumber: "",
        panNumber: "",
        aadharNumber: "",
        ref: "",
      })
    );
    sessionStorage.removeItem("deliverySignupDocs");
    sessionStorage.setItem("deliveryIsRejected", "true");
    sessionStorage.setItem("deliveryNeedsRegistration", "true");
    sessionStorage.setItem("deliverySubmissionType", "new_onboarding");
    sessionStorage.setItem(
      "deliveryRejectionContext",
      JSON.stringify(rejection || {})
    );

    navigate("/food/delivery/signup/details", {
      // Push so browser Back returns to Rejected (do not replace Rejected out of history).
      replace: false,
      state: { backTo: "/food/delivery/onboarding/rejected" },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-rose-600 px-6 py-8 text-white">
          <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-100">
            Status
          </p>
          <h1 className="text-2xl font-bold mt-1">Rejected</h1>
          <p className="text-sm text-rose-100 mt-2">
            Your delivery partner onboarding was rejected. You can edit the previous
            application or start a brand-new one.
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2">
              Rejection Reason
            </p>
            <p className="text-sm text-rose-900 whitespace-pre-wrap leading-relaxed">
              {reason}
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <span>Rejected Date: {toDateLabel(rejectedAt)}</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-800 mb-1">Instructions</p>
            <p>
              Choose <strong>Edit Existing</strong> to keep your previous details and fix
              only what is wrong. Choose <strong>Create New</strong> to start blank. Your
              previous rejection history is preserved for admin review.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={startEditExisting}
              className="w-full h-12 rounded-2xl bg-slate-900 text-white font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-slate-800"
            >
              <FileEdit className="w-4 h-4" />
              Edit Existing Onboarding
            </button>
            <button
              type="button"
              onClick={startNewOnboarding}
              className="w-full h-12 rounded-2xl border border-slate-300 bg-white text-slate-800 font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-slate-50"
            >
              <PlusCircle className="w-4 h-4" />
              Create New Onboarding
            </button>
            <button
              type="button"
              onClick={() => navigate("/food/delivery/login", { replace: true })}
              className="w-full h-11 rounded-2xl text-slate-500 text-sm font-medium hover:text-slate-700"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
