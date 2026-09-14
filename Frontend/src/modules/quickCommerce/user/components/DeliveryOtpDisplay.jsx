import React, { useEffect, useState, useRef } from "react";
import { CheckCircle, Clock, MapPin, Shield } from "lucide-react";
import {
  getOrderSocket,
  onDeliveryOtpGenerated,
  onDeliveryOtpValidated,
} from "@/core/services/orderSocket";

/**
 * DeliveryOtpDisplay Component
 * 
 * Displays the proximity-based delivery OTP to the customer when the delivery person
 * arrives within 0-120m of the delivery location.
 * 
 * Features:
 * - Real-time OTP display via Socket.IO
 * - 10-minute countdown timer
 * - Visual indicator that delivery person is nearby
 * - Security: Hides OTP when app is backgrounded
 * - Shows delivery confirmation when OTP is validated
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.5, 9.4
 */
const DeliveryOtpDisplay = ({ orderId }) => {
  const [otpData, setOtpData] = useState(null);
  const [isDelivered, setIsDelivered] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef(null);

  // Calculate remaining time from expiration timestamp
  const calculateRemainingTime = (expiresAt) => {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = Math.floor((expiry - now) / 1000);
    return Math.max(0, diff);
  };

  // Format seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle visibility change (app backgrounded or device locked)
  // Requirement 9.4: Hide OTP when app is backgrounded or device locked
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Set up Socket.IO listeners for OTP events
  useEffect(() => {
    if (!orderId) return;

    console.log(`[DeliveryOtpDisplay] Setting up Socket.IO listeners for order ${orderId}`);

    const getToken = () => localStorage.getItem("auth_customer");
    const socket = getOrderSocket(getToken);
    
    console.log(`[DeliveryOtpDisplay] Socket connection status:`, socket?.connected);
    console.log(`[DeliveryOtpDisplay] Socket ID:`, socket?.id);

    // Listen for OTP generation event
    // Requirement 4.1: Receive notification to display OTP
    const offGenerated = onDeliveryOtpGenerated(getToken, (payload) => {
      console.log(`[DeliveryOtpDisplay] Received delivery:otp:generated event:`, payload);
      if (payload?.orderId === orderId) {
        console.log(`[DeliveryOtpDisplay] OTP matches current order, displaying OTP:`, payload.otp);
        setOtpData({
          otp: payload.otp,
          expiresAt: payload.expiresAt,
          deliveryPersonNearby: payload.deliveryPersonNearby,
        });
        setIsDelivered(false);
        setRemainingSeconds(calculateRemainingTime(payload.expiresAt));
      } else {
        console.log(`[DeliveryOtpDisplay] OTP for different order. Expected: ${orderId}, Got: ${payload?.orderId}`);
      }
    });

    // Listen for OTP validation event
    // Requirement 4.1: Show delivery confirmation
    const offValidated = onDeliveryOtpValidated(getToken, (payload) => {
      console.log(`[DeliveryOtpDisplay] Received delivery:otp:validated event:`, payload);
      if (payload?.orderId === orderId) {
        console.log(`[DeliveryOtpDisplay] OTP validated for current order, showing delivery confirmation`);
        setIsDelivered(true);
        setOtpData(null);
      }
    });

    return () => {
      console.log(`[DeliveryOtpDisplay] Cleaning up Socket.IO listeners for order ${orderId}`);
      offGenerated();
      offValidated();
    };
  }, [orderId]);

  // Countdown timer
  // Requirement 7.5: Display countdown timer showing remaining validity
  useEffect(() => {
    if (!otpData || remainingSeconds <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setOtpData(null);
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [otpData, remainingSeconds]);

  // Show delivery confirmation
  if (isDelivered) {
    return (
      <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-center mb-3">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <h3 className="text-lg font-bold text-green-900 dark:text-green-100 mb-1">
          Delivery Confirmed!
        </h3>
        <p className="text-sm text-green-700 dark:text-green-300">
          Your order has been successfully delivered
        </p>
      </div>
    );
  }

  // Show OTP display when available and visible
  if (otpData && isVisible) {
    const isExpiringSoon = remainingSeconds <= 120; // Less than 2 minutes

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Delivery Person Nearby Indicator */}
        {/* Requirement 4.4: Show visual indicator that delivery person is nearby */}
        {otpData.deliveryPersonNearby && (
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                Delivery Partner Nearby
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Within 0-120 meters of your location
              </p>
            </div>
          </div>
        )}

        {/* OTP Display */}
        {/* Requirement 4.2: Display OTP in prominent, easily readable format */}
        {/* Requirement 4.3: Display with font size at least 24 points */}
        <div
          className={`border rounded-2xl p-6 text-center transition-colors duration-300 ${
            isExpiringSoon
              ? "bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/30"
              : "bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-500/10 dark:to-blue-500/10 border-purple-200 dark:border-purple-500/20"
          }`}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <Shield className={`w-5 h-5 ${isExpiringSoon ? "text-amber-600" : "text-purple-600"}`} />
            <p
              className={`text-xs font-bold uppercase tracking-wider ${
                isExpiringSoon ? "text-amber-800 dark:text-amber-200" : "text-purple-800 dark:text-purple-200"
              }`}
            >
              Delivery OTP
            </p>
          </div>

          {/* OTP Value - Minimum 24pt font (32px = 24pt) */}
          {/* Requirement 4.3: Font size at least 24 points */}
          <div
            className={`text-5xl font-black font-mono tracking-[0.3em] mb-3 ${
              isExpiringSoon ? "text-amber-950 dark:text-amber-100" : "text-purple-950 dark:text-purple-100"
            }`}
            style={{ fontSize: "48px" }} // 36pt = 48px (exceeds 24pt requirement)
          >
            {otpData.otp}
          </div>

          <p className={`text-xs ${isExpiringSoon ? "text-amber-700 dark:text-amber-300" : "text-purple-700 dark:text-purple-300"}`}>
            Share this code with your delivery partner
          </p>
        </div>

        {/* Countdown Timer */}
        {/* Requirement 7.5: Display countdown timer showing remaining validity */}
        <div
          className={`border rounded-xl p-4 flex items-center justify-between transition-colors duration-300 ${
            isExpiringSoon
              ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30"
              : "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10"
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${isExpiringSoon ? "text-amber-600 dark:text-amber-400" : "text-gray-600 dark:text-slate-400"}`} />
            <span className={`text-xs font-semibold ${isExpiringSoon ? "text-amber-900 dark:text-amber-200" : "text-gray-700 dark:text-slate-300"}`}>
              {isExpiringSoon ? "Expiring Soon" : "Valid For"}
            </span>
          </div>
          <span
            className={`text-lg font-bold font-mono ${
              isExpiringSoon ? "text-amber-950 dark:text-amber-100" : "text-gray-900 dark:text-slate-100"
            }`}
          >
            {formatTime(remainingSeconds)}
          </span>
        </div>

        {/* Security Notice */}
        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-3">
          <p className="text-xs text-gray-600 dark:text-slate-400 text-center">
            🔒 This OTP is valid for 10 minutes and will be hidden when you switch apps
          </p>
        </div>
      </div>
    );
  }

  // Don't render anything if no OTP or app is backgrounded
  return null;
};

export default DeliveryOtpDisplay;
