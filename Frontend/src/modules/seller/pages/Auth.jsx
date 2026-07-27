import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Store, Phone, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@food/components/ui/button";
import { useCompanyName } from "@food/hooks/useCompanyName";
import { useAuth } from "@core/context/AuthContext";
import { sellerApi } from "../services/sellerApi";

const DEFAULT_COUNTRY_CODE = "+91";

export default function SellerAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const companyName = useCompanyName();
  const [step, setStep] = useState("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpPhone, setOtpPhone] = useState("");
  const nextSellerPath =
    typeof location.state?.from === "string" &&
    location.state.from.startsWith("/seller")
      ? location.state.from
      : "/seller";

  const maskedPhone = useMemo(() => {
    if (phone.length < 4) return `${DEFAULT_COUNTRY_CODE} ${phone}`;
    return `${DEFAULT_COUNTRY_CODE} ${phone.slice(0, 2)}******${phone.slice(-2)}`;
  }, [phone]);

  const validatePhone = (value) => {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length !== 10) return "Enter a valid 10-digit mobile number";
    if (!["6", "7", "8", "9"].includes(digits[0])) return "Enter a valid Indian mobile number";
    return "";
  };

  const handleSendOtp = async () => {
    const validation = validatePhone(phone);
    if (validation) {
      toast.error(validation);
      return;
    }

    try {
      setIsLoading(true);
      const fullPhone = `${DEFAULT_COUNTRY_CODE} ${phone}`.trim();
      const response = await sellerApi.requestOtp(fullPhone);
      const payload = response?.data?.result || response?.data?.data || response?.data || {};
      const devOtp = payload?.otp || null;
      const deliveryMode = payload?.deliveryMode || "sms";
      const resolvedPhone = String(payload?.phone || fullPhone).trim();

      if (devOtp) {
        console.log(`[DEV ONLY] OTP for ${fullPhone} is: ${devOtp}`);
      }

      toast.success(
        deliveryMode === "sms"
          ? "OTP sent to your seller number."
          : "OTP sent successfully."
      );
      setOtpPhone(resolvedPhone);
      setOtp("");
      setStep("otp");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const code = String(otp || "").replace(/\D/g, "").slice(0, 6);
    if (code.length < 4) {
      toast.error("Enter the OTP you received");
      return;
    }

    try {
      setIsLoading(true);
      const verifyPhone = String(otpPhone || `${DEFAULT_COUNTRY_CODE} ${phone}`.trim()).trim();
      const response = await sellerApi.verifyOtp(verifyPhone, code);
      const data = response?.data?.result || response?.data?.data || response?.data || {};
      const accessToken = data?.accessToken || data?.token;
      const sellerUser = data?.seller || data?.user || data?.data?.seller || data?.data?.user;

      if (!accessToken) {
        throw new Error("Login succeeded but no access token was returned");
      }

      login({
        ...sellerUser,
        name:
          sellerUser?.name ||
          "Seller",
        shopName:
          sellerUser?.shopName ||
          sellerUser?.name ||
          "Store",
        phone:
          sellerUser?.phone ||
          `${DEFAULT_COUNTRY_CODE} ${phone}`.trim(),
        email: sellerUser?.email || "",
        token: accessToken,
        role: "seller",
      });
      toast.success(
        sellerUser?.approved === false
          ? "OTP verified. Continue your seller setup."
          : "Seller login successful",
      );
      navigate(
        sellerUser?.approved === false && sellerUser?.onboardingSubmitted !== true
          ? "/seller/onboarding"
          : nextSellerPath,
        { replace: true },
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "OTP verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fcfaf6] px-6 py-10 font-['Outfit']">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[-8%] top-[-8%] h-72 w-72 rounded-full bg-[#fed7aa]/40 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-5%] h-80 w-80 rounded-full bg-[#ffedd5]/50 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl overflow-hidden rounded-[36px] border border-white/70 bg-white shadow-[0_40px_120px_rgba(15,23,42,0.08)]">
        <div className="hidden w-[42%] flex-col justify-between bg-[linear-gradient(160deg,#0f172a_0%,#c2410c_50%,#FE5502_100%)] p-10 text-white md:flex">
          <div>
            <div className="inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em]">
              <Store className="h-4 w-4" />
              Seller Console
            </div>
            <h1 className="mt-8 text-4xl font-black leading-tight">
              Grow your store with a seller-first login flow.
            </h1>
            <p className="mt-4 max-w-md text-sm font-medium text-white/80">
              Based on your Blinkit reference, adapted to this project&apos;s live OTP backend so partners can actually sign in.
            </p>
          </div>

          <div className="space-y-3 text-sm font-semibold text-white/85">
            <div className="rounded-2xl bg-white/10 px-4 py-3">Fast OTP login for store owners</div>
          </div>
        </div>

        <div className="flex w-full items-center justify-center px-6 py-10 md:w-[58%] md:px-12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl"
          >
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary-orange">Partner Access</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                  {companyName} seller login
                </h2>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Use your registered store phone number to receive a one-time code.
                </p>
              </div>
              <div className="hidden h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 md:flex">
                <ShieldCheck className="h-8 w-8 text-primary-orange" />
              </div>
            </div>

            <div className="space-y-5 rounded-[32px] border border-slate-200 bg-slate-50/70 p-6">
              {step === "phone" ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Registered Mobile Number
                    </label>
                    <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                      <Phone className="h-5 w-5 text-slate-400" />
                      <span className="font-bold text-slate-900">{DEFAULT_COUNTRY_CODE}</span>
                      <div className="h-5 w-px bg-slate-200" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="10-digit mobile number"
                        className="flex-1 bg-transparent text-base font-bold text-slate-900 outline-none placeholder:text-slate-300"
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={isLoading}
                    className="h-14 w-full rounded-[24px] bg-primary-orange hover:bg-primary-hover active:bg-primary-dark text-sm font-black uppercase tracking-[0.22em] text-white transition-colors"
                  >
                    {isLoading ? "Sending OTP..." : "Send OTP"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Verify OTP
                    </label>
                    <div className="rounded-[24px] border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-800">
                      Code sent to {maskedPhone}
                    </div>
                    <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                      <KeyRound className="h-5 w-5 text-slate-400" />
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="Enter OTP"
                        className="flex-1 bg-transparent text-base font-bold tracking-[0.45em] text-slate-900 outline-none placeholder:tracking-normal placeholder:text-slate-300"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setStep("phone");
                        setOtp("");
                        setOtpPhone("");
                      }}
                      className="h-14 flex-1 rounded-[24px] border-slate-300 bg-white font-black uppercase tracking-[0.18em] text-slate-700"
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={isLoading}
                      className="h-14 flex-[1.4] rounded-[24px] bg-primary-orange hover:bg-primary-hover active:bg-primary-dark text-sm font-black uppercase tracking-[0.18em] text-white transition-colors"
                    >
                      {isLoading ? "Verifying..." : "Continue"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}




