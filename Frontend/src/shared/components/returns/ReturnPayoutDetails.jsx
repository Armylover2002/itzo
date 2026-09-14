import React from "react";

const ReturnPayoutDetails = ({ payoutDetails, refundMethod }) => {
  const method = String(refundMethod || payoutDetails?.method || "").toLowerCase();
  if (method === "wallet" || !payoutDetails) return null;

  if (method === "upi") {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-1 text-xs text-slate-700">
        <p className="font-bold text-slate-800">UPI Details</p>
        <p>
          UPI ID:{" "}
          <span className="font-mono font-bold text-slate-900">
            {payoutDetails.upiId || "—"}
          </span>
        </p>
      </div>
    );
  }

  if (method === "bank") {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 space-y-1 text-xs text-slate-700">
        <p className="font-bold text-slate-800">Bank Details</p>
        <p>
          Account holder:{" "}
          <span className="font-bold text-slate-900">
            {payoutDetails.accountHolderName || "—"}
          </span>
        </p>
        <p>
          Account number:{" "}
          <span className="font-mono font-bold text-slate-900">
            {payoutDetails.accountNumber || "—"}
          </span>
        </p>
        <p>
          IFSC:{" "}
          <span className="font-mono font-bold text-slate-900">
            {payoutDetails.ifsc || "—"}
          </span>
        </p>
        {payoutDetails.bankName ? (
          <p>
            Bank: <span className="font-bold text-slate-900">{payoutDetails.bankName}</span>
          </p>
        ) : null}
      </div>
    );
  }

  return null;
};

export default ReturnPayoutDetails;
