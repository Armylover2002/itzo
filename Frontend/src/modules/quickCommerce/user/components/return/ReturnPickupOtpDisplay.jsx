import React, { useEffect, useState, useRef, useCallback } from "react";
import { Clock, MapPin, Shield } from "lucide-react";
import { customerApi } from "../../services/customerApi";
import { RETURN_STATUS } from "@/shared/utils/returnStatus";

const ACTIVE_OTP_STATUSES = new Set([
  RETURN_STATUS.APPROVED,
  RETURN_STATUS.PICKUP_ASSIGNED,
  RETURN_STATUS.IN_TRANSIT,
]);

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const ReturnPickupOtpDisplay = ({ orderId, returnDoc, sellerId = "" }) => {
  const [otpData, setOtpData] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const pollRef = useRef(null);

  const returnStatus = String(returnDoc?.returnStatus || "");
  const shouldShow = ACTIVE_OTP_STATUSES.has(returnStatus);

  const calculateRemainingTime = useCallback((expiresAt) => {
    if (!expiresAt) return 600;
    const now = Date.now();
    const expiry = new Date(expiresAt).getTime();
    return Math.max(0, Math.floor((expiry - now) / 1000));
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const fetchOtp = useCallback(async () => {
    if (!orderId || !shouldShow) return;
    setLoading(true);
    try {
      const params = sellerId ? { sellerId } : {};
      const res = await customerApi.getReturnPickupOtp(orderId, params);
      const payload = res?.data?.result || res?.data?.data || res?.data;
      if (payload?.otp) {
        setOtpData(payload);
        setRemainingSeconds(calculateRemainingTime(payload.expiresAt));
      }
    } catch {
      setOtpData(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, sellerId, shouldShow, calculateRemainingTime]);

  useEffect(() => {
    if (!shouldShow) {
      setOtpData(null);
      return undefined;
    }
    void fetchOtp();
    pollRef.current = window.setInterval(() => {
      if (!document.hidden) void fetchOtp();
    }, 15000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [fetchOtp, shouldShow]);

  useEffect(() => {
    if (!otpData || remainingSeconds <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return undefined;
    }
    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [otpData, remainingSeconds]);

  if (!shouldShow) return null;
  if (!otpData && !loading) return null;
  if (!isVisible) return null;

  const isExpiringSoon = remainingSeconds > 0 && remainingSeconds <= 120;

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <MapPin className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">
            Return pickup rider
          </p>
          <p className="text-xs text-blue-700">Share this OTP when the rider arrives to collect items</p>
        </div>
      </div>

      <div
        className={`border rounded-2xl p-6 text-center ${
          isExpiringSoon
            ? "bg-amber-50 border-amber-300"
            : "bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200"
        }`}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className={`w-5 h-5 ${isExpiringSoon ? "text-amber-600" : "text-purple-600"}`} />
          <p className="text-xs font-bold uppercase tracking-wider text-purple-800">Pickup OTP</p>
        </div>
        {loading && !otpData ? (
          <p className="text-sm text-slate-500">Loading OTP...</p>
        ) : (
          <div
            className="text-5xl font-black font-mono tracking-[0.3em] mb-3 text-purple-950"
            style={{ fontSize: "48px" }}
          >
            {otpData?.otp || "----"}
          </div>
        )}
        <p className="text-xs text-purple-700">Give this code to the delivery partner at pickup</p>
      </div>

      {remainingSeconds > 0 && (
        <div
          className={`border rounded-xl p-4 flex items-center justify-between ${
            isExpiringSoon ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${isExpiringSoon ? "text-amber-600" : "text-gray-600"}`} />
            <span className="text-xs font-semibold text-gray-700">Valid for</span>
          </div>
          <span className="text-lg font-bold font-mono text-gray-900">
            {formatTime(remainingSeconds)}
          </span>
        </div>
      )}
    </div>
  );
};

export default ReturnPickupOtpDisplay;
