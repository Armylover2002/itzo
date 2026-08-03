import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  DollarSign,
  CheckCircle2,
  QrCode,
  Loader2,
  Info,
  X,
  RefreshCw,
  Package,
} from "lucide-react";
import { deliveryAPI } from "@food/api";
import { toast } from "sonner";
import { ActionSlider } from "@/modules/DeliveryV2/components/ui/ActionSlider";

const Backdrop = ({ onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="absolute inset-0 bg-black/40 -z-10 pointer-events-auto"
    onClick={onClose}
  />
);

const DeliveryInstructionsPanel = ({ note }) => {
  const text = String(note || "").trim();
  if (!text) return null;

  return (
    <div className="w-full rounded-3xl mb-6 overflow-hidden border border-orange-100 shadow-sm">
      <div className="bg-linear-to-r from-orange-500 to-amber-500 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-white/20 rounded-2xl flex items-center justify-center text-white">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em]">
              Delivery instruction
            </p>
            <p className="text-[11px] font-semibold text-white/90">
              Read before handover
            </p>
          </div>
        </div>
      </div>
      <div className="bg-orange-50 px-5 py-4">
        <p className="text-sm font-bold text-gray-950 leading-relaxed wrap-break-word">
          “{text}”
        </p>
      </div>
    </div>
  );
};

const OtpModal = ({ order, onVerified, onClose }) => {
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef([]);

  // Handle cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResendOtp = async () => {
    if (cooldown > 0 || resendingOtp) return;
    try {
      setResendingOtp(true);
      let res;
      if (order?.isReturn) {
        res = await deliveryAPI.resendReturnOtp(order._id);
      } else {
        res = await deliveryAPI.resendDropOtp(order._id);
      }
      toast.success('OTP resent successfully!');
      if (res.data?.cooldownRemaining) {
        setCooldown(res.data.cooldownRemaining);
      } else {
        setCooldown(60);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to resend OTP';
      toast.error(msg);
      if (err.response?.data?.cooldownRemaining) {
        setCooldown(err.response.data.cooldownRemaining);
      }
    } finally {
      setResendingOtp(false);
    }
  };

  useEffect(() => {
    const savedCode = order?.deliveryVerification?.dropOtp?.code;
    if (savedCode && String(savedCode).length === 4) {
      setOtp(String(savedCode).split(""));
    }
  }, [order?.deliveryVerification?.dropOtp?.code]);

  useEffect(() => {
    // Focus first input only if all fields are empty and inputs are rendered
    if (
      otp.every((digit) => digit === "") &&
      inputRefs.current[0] &&
      inputRefs.current.length === 4
    ) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [otp, inputRefs.current.length]);

  const orderId = order.orderId || order._id || "ORD";

  const handleOtpChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);
    if (value && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0)
      inputRefs.current[index - 1]?.focus();
  };

  const verifyOtp = async () => {
    const otpString = otp.join("");
    if (otpString.length < 4) return;
    setIsVerifyingOtp(true);
    try {
      const res = order?.isReturn
        ? await deliveryAPI.verifyReturnSellerOtp(orderId, otpString)
        : await deliveryAPI.verifyDropOtp(orderId, otpString);
        
      if (res?.data?.success) {
        setIsOtpVerified(true);
        // toast.success("OTP Verified Successfully");
        setTimeout(() => onVerified(otpString, res?.data?.data), 600);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Invalid OTP entered");
      throw err;
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const isAlreadyVerified = order?.deliveryVerification?.dropOtp?.verified;

  return (
    <div className="absolute inset-x-0 bottom-0 z-120 p-0 sm:p-4 h-full flex items-end justify-center pointer-events-none">
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="w-full bg-white rounded-t-[2.5rem] shadow-[0_-20px_60px_rgba(0,0,0,0.3)] p-6 pb-12 pointer-events-auto max-w-lg">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isOtpVerified ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Handover Code</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Step 1 of Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <DeliveryInstructionsPanel note={order?.note} />

        <div className="flex justify-center gap-3 mb-8">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => (inputRefs.current[i] = el)}
              type="number"
              disabled={isOtpVerified}
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`w-14 h-18 bg-gray-50 border-2 rounded-2xl text-center text-3xl font-bold transition-all ${
                isOtpVerified
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 focus:border-green-600 text-gray-700"
              }`}
            />
          ))}
        </div>

        <div className="flex justify-center mb-8 mt-[-1rem]">
          <button
            onClick={handleResendOtp}
            disabled={resendingOtp || cooldown > 0 || isOtpVerified}
            className={`text-xs font-bold px-4 py-2 rounded-full transition-all flex items-center gap-2 ${
              cooldown > 0 || isOtpVerified
                ? "bg-gray-100 text-gray-400 cursor-not-allowed" 
                : "bg-green-50 text-green-600 hover:bg-green-100 active:scale-95"
            }`}
          >
            {resendingOtp ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Sending...</>
            ) : cooldown > 0 ? (
              `Resend OTP in ${cooldown}s`
            ) : (
              "Resend OTP"
            )}
          </button>
        </div>

        <ActionSlider
          key="action-otp"
          label={
            isVerifyingOtp
              ? "Verifying..."
              : isAlreadyVerified
                ? "Code already verified ✓"
                : "Slide to Verify OTP"
          }
          successLabel="Verified!"
          disabled={
            otp.some((d) => !d) ||
            isVerifyingOtp ||
            isOtpVerified ||
            isAlreadyVerified
          }
          onConfirm={verifyOtp}
          color="bg-primary"
        />
      </motion.div>
    </div>
  );
};

const PaymentModal = ({ order, otpString, onComplete, onClose }) => {
  const [showQrModal, setShowQrModal] = useState(false);
  const [collectQrLink, setCollectQrLink] = useState(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const isInitialPaid = ["paid", "captured", "authorized"].includes(
    String(order.payment?.status || "").toLowerCase(),
  );
  const [paymentStatus, setPaymentStatus] = useState(
    isInitialPaid ? "paid" : "idle",
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedMode, setSelectedMode] = useState(null); // 'cash' or 'qr'
  const pollingRef = useRef(null);

  // State for OTP re-entry for online paid orders
  const [paymentOtp, setPaymentOtp] = useState(["", "", "", ""]);
  const [isPaymentOtpVerified, setIsPaymentOtpVerified] = useState(false);
  const paymentInputRefs = useRef([]);

  const orderId = order.orderId || order._id || "ORD";
  const amountToCollect = order.pricing?.total || order.amountToCollect || 0;

  const handlePaymentOtpChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;
    const newOtp = [...paymentOtp];
    newOtp[index] = value.substring(value.length - 1);
    setPaymentOtp(newOtp);
    if (value && index < 3) paymentInputRefs.current[index + 1]?.focus();
  };

  const handlePaymentKeyDown = (index, e) => {
    if (e.key === "Backspace" && !paymentOtp[index] && index > 0)
      paymentInputRefs.current[index - 1]?.focus();
  };

  useEffect(() => {
    const enteredOtp = paymentOtp.join("");
    if (enteredOtp.length === 4 && enteredOtp === otpString) {
      setIsPaymentOtpVerified(true);
    } else {
      setIsPaymentOtpVerified(false);
    }
  }, [paymentOtp, otpString]);

  useEffect(() => {
    // Auto-focus first OTP input for online paid orders if not verified
    if (isInitialPaid && !isPaymentOtpVerified && paymentInputRefs.current[0] && paymentInputRefs.current.length === 4) {
      setTimeout(() => {
        paymentInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isInitialPaid, isPaymentOtpVerified, paymentInputRefs.current.length]);

  const checkPaymentSync = useCallback(async () => {
    try {
      const res = await deliveryAPI.getPaymentStatus(orderId);
      const data = res?.data?.data || res?.data || {};
      const status = String(data?.payment?.status || "").toLowerCase();
      if (["paid", "captured", "authorized"].includes(status)) {
        setPaymentStatus("paid");
        if (pollingRef.current) clearInterval(pollingRef.current);
        toast.success("Payment Received Successfully!");
        setShowQrModal(false);
      }
    } catch (e) {
      toast.error("Could not check payment status");
    }
  }, [orderId]);

  const handleManualCheck = async () => {
    setIsSyncing(true);
    try {
      const res = await deliveryAPI.getPaymentStatus(orderId);
      const data = res?.data?.data || res?.data || {};
      const status = String(data?.payment?.status || "").toLowerCase();
      if (["paid", "captured", "authorized"].includes(status)) {
        setPaymentStatus("paid");
        if (pollingRef.current) clearInterval(pollingRef.current);
        toast.success("✅ Payment Received — Paid!");
        setShowQrModal(false);
      } else {
        toast.error("❌ Not Paid Yet — Ask customer to complete payment");
      }
    } catch (e) {
      toast.error("Could not check payment status");
    } finally {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  useEffect(() => {
    if (
      paymentStatus === "pending" ||
      (amountToCollect > 0 && paymentStatus !== "paid")
    ) {
      pollingRef.current = setInterval(checkPaymentSync, 5000);
    }
    return () => clearInterval(pollingRef.current);
  }, [paymentStatus, amountToCollect, checkPaymentSync]);

  const generateQr = async () => {
    setIsGeneratingQr(true);
    setSelectedMode("qr");
    try {
      const res = await deliveryAPI.createCollectQr(orderId, {
        name: order.userName || "Customer",
        phone: order.userPhone || "",
      });
      const link = res?.data?.data?.imageUrl || res?.data?.imageUrl || null;
      if (link) {
        setCollectQrLink(link);
        setPaymentStatus("pending");
        setShowQrModal(true);
      } else {
        toast.error("Could not generate QR code");
      }
    } catch (e) {
      toast.error("QR Generation failed");
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleCashSelection = () => {
    setSelectedMode("cash");
    // toast.info("Cash collection selected");
  };

  const isPaid = paymentStatus === "paid";

  return (
    <>
      <div className="absolute inset-x-0 bottom-0 z-120 p-0 sm:p-4 h-full flex items-end justify-center pointer-events-none">
        <Backdrop onClose={onClose} />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          className="w-full bg-white rounded-t-[2.5rem] shadow-[0_-20px_60px_rgba(0,0,0,0.3)] p-6 pb-12 pointer-events-auto max-w-lg">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isPaid ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"}`}>
                <DollarSign className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Collect Payment
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Step 2 of Verification
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <DeliveryInstructionsPanel note={order?.note} />

          <div className="bg-amber-50 rounded-3xl p-6 border border-amber-100 mb-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-amber-700 text-[10px] font-bold uppercase tracking-widest mb-1">
                  {isPaid ? "Amount Paid Online" : "Cash to Collect"}
                </p>
                <p className="text-amber-950 text-4xl font-bold">
                  ₹{amountToCollect.toFixed(2)}
                </p>
              </div>
              {isPaid && (
                <div className="bg-green-500 text-white px-4 py-2 rounded-full text-[10px] font-bold">
                  PAID ✓
                </div>
              )}
            </div>

            {!isPaid && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={generateQr}
                  disabled={isGeneratingQr}
                  className={`w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                    selectedMode === "qr"
                      ? "bg-amber-600 text-white shadow-lg ring-2 ring-amber-300 ring-offset-2"
                      : "bg-white border-2 border-amber-200 text-amber-800"
                  }`}>
                  {isGeneratingQr ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <QrCode className="w-5 h-5" />
                  )}
                  Show Payment QR
                </button>

                <button
                  onClick={handleCashSelection}
                  className={`w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                    selectedMode === "cash"
                      ? "bg-amber-600 text-white shadow-lg ring-2 ring-amber-300 ring-offset-2"
                      : "bg-white border-2 border-amber-200 text-amber-800"
                  }`}>
                  <DollarSign className="w-5 h-5" />
                  Cash in Hand
                </button>
              </div>
            )}

            {isPaid && (
              <div className="flex flex-col gap-3 mt-4">
                <p className="text-sm font-bold text-gray-900 text-center">
                  Re-enter Handover Code to Complete
                </p>
                <div className="flex justify-center gap-3">
                  {paymentOtp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (paymentInputRefs.current[i] = el)}
                      type="number"
                      disabled={isPaymentOtpVerified}
                      value={digit}
                      onChange={(e) =>
                        handlePaymentOtpChange(i, e.target.value)
                      }
                      onKeyDown={(e) => handlePaymentKeyDown(i, e)}
                      className={`w-14 h-18 bg-gray-50 border-2 rounded-2xl text-center text-3xl font-bold transition-all ${
                        isPaymentOtpVerified
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-gray-200 focus:border-green-600 text-gray-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* If the driver collects physical cash, they can directly slide this, bypassing QR */}
          <ActionSlider
            key="action-payment"
            label={
              !isPaid && !selectedMode
                ? "Select Payment Mode Above"
                : isPaid && !isPaymentOtpVerified
                  ? "Enter OTP to Complete Order"
                  : "Slide to Complete Order"
            }
            successLabel="Delivered! ✓"
            disabled={
              (!isPaid && !selectedMode) ||
              (!isPaid &&
                selectedMode === "qr" &&
                paymentStatus === "pending") ||
              (isPaid && !isPaymentOtpVerified)
            }
            onConfirm={async () => {
              try {
                await onComplete(otpString, { paymentMode: selectedMode });
              } catch (e) {
                // Slider handles reset
                throw e;
              }
            }}
            color="bg-primary"
          />
        </motion.div>
      </div>

      <AnimatePresence>
        {showQrModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-200 bg-black/80 flex items-center justify-center p-6 pointer-events-auto"
            onClick={() => setShowQrModal(false)}>
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <h3 className="text-gray-950 font-bold text-xl mb-2">
                Scan to Pay
              </h3>
              <p className="text-gray-500 text-sm mb-4 font-medium">
                Order Total: ₹{amountToCollect.toFixed(2)}
              </p>

              <button
                onClick={handleManualCheck}
                disabled={isSyncing}
                className="flex gap-1.5 items-center bg-[#FE5502] text-white px-4 py-2 mb-6 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Check Status
              </button>

              <div className="relative bg-gray-50 rounded-3xl border-2 border-gray-100 mb-8 w-64 h-64 overflow-hidden flex items-center justify-center">
                <img
                  src={collectQrLink}
                  alt="Razorpay QR"
                  className="w-full h-full object-cover scale-[1.6] translate-y-[-8%]"
                />
              </div>

              <button
                onClick={() => setShowQrModal(false)}
                className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold text-xs uppercase tracking-widest">
                Close QR
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export const DeliveryVerificationModal = ({ order, onComplete, onClose }) => {
  const alreadyVerified = !!order?.deliveryVerification?.dropOtp?.verified;
  const paymentMethod = (
    order?.paymentMethod ||
    order?.payment?.method ||
    order?.transaction?.payment?.method ||
    order?.transaction?.paymentMethod ||
    "cod"
  ).toLowerCase();
  const isCod = ["cash", "cod", "cash_on_delivery", "razorpay_qr"].includes(
    paymentMethod,
  );

  // Determine initial step: skip OTP if already verified
  const [step, setStep] = useState(() => {
    if (alreadyVerified) {
      return isCod && !order?.isReturn ? "payment" : "complete";
    }
    return "otp";
  });
  const [verifiedOtp, setVerifiedOtp] = useState(
    alreadyVerified ? order.deliveryVerification.dropOtp.code || "" : "",
  );

  const handleOtpVerified = (otpValue) => {
    setVerifiedOtp(otpValue);
    // After OTP is verified: COD → show payment panel, Online → show complete button
    setStep(isCod && !order?.isReturn ? "payment" : "complete");
  };

  // If OTP was already verified on mount and it's a non-COD order, auto-complete
  useEffect(() => {
    if (step === "complete" && (!isCod || order?.isReturn)) {
      onComplete(verifiedOtp);
    }
  }, []); // only on mount

  if (!order) return null;

  return (
    <AnimatePresence mode="wait">
      {step === "otp" && (
        <OtpModal
          key="otp-modal"
          order={order}
          onVerified={handleOtpVerified}
          onClose={onClose || (() => {})}
        />
      )}
      {step === "payment" && (
        <PaymentModal
          key="payment-modal"
          order={order}
          otpString={verifiedOtp}
          onComplete={onComplete}
          onClose={onClose || (() => {})}
        />
      )}
      {step === "complete" && (
        <div className="absolute inset-x-0 bottom-0 z-120 p-0 sm:p-4 h-full flex items-end justify-center pointer-events-none">
          <Backdrop onClose={onClose || (() => {})} />
          <motion.div
            key="complete-modal"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="w-full bg-white rounded-t-[2.5rem] shadow-[0_-20px_60px_rgba(0,0,0,0.3)] p-6 pb-12 pointer-events-auto max-w-lg">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-green-100 text-green-600">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  OTP Verified
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-600">
                  Payment Received Online
                </p>
              </div>
            </div>
            <ActionSlider
              key="action-complete"
              label="Slide to Complete Delivery"
              successLabel="Delivered! ✓"
              onConfirm={async () => {
                await onComplete(verifiedOtp);
              }}
              color="bg-primary"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
