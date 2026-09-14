import React, { useState } from "react";
import { Download, ExternalLink, X, ZoomIn } from "lucide-react";

const formatUploadedAt = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const formatUploader = (entry = {}) => {
  const role = String(entry.uploadedByRole || "DELIVERY_PARTNER").replace(/_/g, " ");
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
};

const ReturnPickupImageGallery = ({ entries = [], title = "Pickup Images" }) => {
  const [previewUrl, setPreviewUrl] = useState("");

  const images = (Array.isArray(entries) ? entries : []).filter((row) => row?.url);

  if (!images.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        No pickup images uploaded yet.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">{title}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((entry, idx) => (
            <div
              key={`${entry.url}-${idx}`}
              className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm"
            >
              <button
                type="button"
                onClick={() => setPreviewUrl(entry.url)}
                className="relative block w-full aspect-square group"
              >
                <img
                  src={entry.url}
                  alt={`Pickup ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              </button>
              <div className="p-2 space-y-1">
                <p className="text-[10px] text-slate-500">{formatUploadedAt(entry.uploadedAt)}</p>
                <p className="text-[10px] font-semibold text-slate-700">{formatUploader(entry)}</p>
                <div className="flex gap-2 pt-1">
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open
                  </a>
                  <a
                    href={entry.url}
                    download
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 hover:underline"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setPreviewUrl("")}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={previewUrl}
            alt="Pickup preview"
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain"
          />
        </div>
      )}
    </>
  );
};

export default ReturnPickupImageGallery;
