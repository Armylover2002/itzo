import React, { useMemo, useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ShieldCheck, Store, KeyRound, X, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@food/components/ui/button";
import { useCompanyName } from "@food/hooks/useCompanyName";
import { useAuth } from "@core/context/AuthContext";
import { useSettings } from "@core/context/SettingsContext";
import { sellerApi } from "../services/sellerApi";
import {
  clearSellerOnboardingDraft,
  draftMatchesSellerPhone,
  readSellerOnboardingDraft,
  writeSellerOnboardingDraft,
} from "../utils/onboardingDraft";
import {
  clearSellerOnboardingResume,
  markSellerOnboardingResume,
} from "../utils/sellerSession";
import { useSellerBackGuard } from "../hooks/useSellerBackGuard";
import { scrollRegistrationToTop } from "../utils/scrollRegistrationToTop";
import {
  getAppLogo,
  getSellerLoginBanner,
  subscribeBusinessSettings,
} from "@common/utils/businessSettings"
import loginBg from "@food/assets/loginbanner.png";
import AuthCircleLogo from "@shared/components/AuthCircleLogo";
import banner1 from "@/assets/seller_banners/banner1.png";
import banner2 from "@/assets/seller_banners/banner2.png";
import banner3 from "@/assets/seller_banners/banner3.png";

const DEFAULT_COUNTRY_CODE = "+91";

export default function SellerAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const companyName = useCompanyName();
  const { settings } = useSettings();
  const [step, setStep] = useState("phone");

  const [isLoading, setIsLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [otpPhone, setOtpPhone] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(null);
  const inputRefs = useRef([]);
  const [rejectionModalData, setRejectionModalData] = useState({
    isOpen: false,
    reason: "",
    userPayload: null
  });
  
  const [legalModal, setLegalModal] = useState({
    isOpen: false,
    isLoading: false,
    kind: "terms",
    content: "",
    title: "Terms & Conditions",
    supportData: null,
  });

  const LEGAL_PAGES = {
    terms: {
      title: "Terms & Conditions",
      empty: "<p>No terms and conditions found for sellers.</p>",
      error: "<p>Unable to load terms and conditions at this time.</p>",
      fetch: () => sellerApi.getTerms(),
    },
    privacy: {
      title: "Privacy Policy",
      empty: "<p>No privacy policy found for sellers.</p>",
      error: "<p>Unable to load privacy policy at this time.</p>",
      fetch: () => sellerApi.getPrivacy(),
    },
    support: {
      title: "Support",
      empty: "<p>No support information found for sellers.</p>",
      error: "<p>Unable to load support information at this time.</p>",
      fetch: () => sellerApi.getSupport(),
    },
  };

  const nextSellerPath =
    typeof location.state?.from === "string" &&
      location.state.from.startsWith("/seller")
      ? location.state.from
      : "/seller";

  const maskedPhone = useMemo(() => {
    if (phone.length < 4) return `${DEFAULT_COUNTRY_CODE} ${phone}`;
    return `${DEFAULT_COUNTRY_CODE} ${phone.slice(0, 2)}******${phone.slice(-2)}`;
  }, [phone]);


  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('seller'))
  const [bannerUrl, setBannerUrl] = useState(() => {
    const banner = getSellerLoginBanner()
    return (banner && banner.url && banner.active) ? banner.url : loginBg
  })

  const sliderImages = [
    banner1,
    banner2,
    banner3
  ];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [generatedOtp, setGeneratedOtp] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % sliderImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (settings) {
      setLogoUrl(getAppLogo('seller'))
      const banner = getSellerLoginBanner()
      if (banner && banner.url && banner.active) {
        setBannerUrl(banner.url)
      } else {
        setBannerUrl(loginBg)
      }
    }
  }, [settings])

  useEffect(() => {
    const apply = () => {
      const logo = getAppLogo('seller')
      if (logo) setLogoUrl(logo)
      const banner = getSellerLoginBanner()
      if (banner && banner.url && banner.active) {
        setBannerUrl(banner.url)
      } else {
        setBannerUrl(loginBg)
      }
    }
    apply()
    return subscribeBusinessSettings(apply)
  }, [])

  const closeLegalModal = () => {
    setLegalModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleOpenLegalPage = async (kind) => {
    const page = LEGAL_PAGES[kind] || LEGAL_PAGES.terms;
    setLegalModal({
      isOpen: true,
      isLoading: true,
      kind,
      content: "",
      title: page.title,
      supportData: null,
    });
    try {
      const res = await page.fetch();
      const payload = res?.data?.result || res?.data?.data || res?.data || {};
      setLegalModal((prev) => ({
        ...prev,
        title: payload?.title || page.title,
        content: payload?.content || page.empty,
        supportData: payload?.support || payload || null,
        isLoading: false,
      }));
    } catch (err) {
      setLegalModal((prev) => ({
        ...prev,
        content: page.error,
        supportData: null,
        isLoading: false,
      }));
    }
  };


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
      const fullPhone = `${DEFAULT_COUNTRY_CODE}${phone}`.trim();
      const response = await sellerApi.requestOtp(fullPhone);
      const payload = response?.data?.result || response?.data?.data || response?.data || {};
      const devOtp = payload?.otp || null;
      const deliveryMode = payload?.deliveryMode || "sms";
      const resolvedPhone = String(payload?.phone || `${DEFAULT_COUNTRY_CODE} ${phone}`).trim();

      if (!response?.data?.success && response?.data?.message) {
        throw new Error(response.data.message);
      }

      toast.success(
        devOtp
          ? (import.meta.env.DEV ? `OTP sent. Dev code: ${devOtp}` : "OTP sent to your seller number.")
          : deliveryMode === "sms"
            ? "OTP sent to your seller number."
            : "OTP generated. Check your messages shortly.",
      );
      setOtpPhone(resolvedPhone);
      setGeneratedOtp(devOtp);

      setOtp(["", "", "", ""]);

      setStep("otp");
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    } catch (error) {
      const status = error?.response?.status;
      const apiMessage = error?.response?.data?.message;
      if (status === 429) {
        toast.error(apiMessage || "Too many OTP requests. Please try again later.");
      } else if (error?.code === "ECONNABORTED") {
        toast.error("OTP request timed out. Please try again.");
      } else if (!error?.response) {
        toast.error("Unable to reach server. Check your connection and try again.");
      } else {
        toast.error(apiMessage || error?.message || "Failed to send OTP");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetToPhoneStep = () => {
    setStep("phone");
    setOtp(["", "", "", ""]);
    setOtpPhone("");
  };

  const stepRef = useRef(step);
  const legalOpenRef = useRef(false);
  const rejectionOpenRef = useRef(false);
  stepRef.current = step;
  legalOpenRef.current = legalModal.isOpen;
  rejectionOpenRef.current = rejectionModalData.isOpen;

  useSellerBackGuard(() => {
    if (legalOpenRef.current) {
      setLegalModal((prev) => ({ ...prev, isOpen: false }));
      return;
    }
    if (rejectionOpenRef.current) {
      setRejectionModalData((prev) => ({ ...prev, isOpen: false }));
      return;
    }
    if (stepRef.current === "otp") {
      resetToPhoneStep();
    }
  });

  useEffect(() => {
    scrollRegistrationToTop();
  }, [step]);

  const handleVerifyOtp = async (otpValue = null) => {
    const code = otpValue || otp.join("").replace(/\D/g, "").slice(0, 4);
    if (code.length < 4) {
      toast.error("Enter the 4-digit OTP you received");
      return;
    }

    try {
      setIsLoading(true);
      const verifyPhone = String(otpPhone || `${DEFAULT_COUNTRY_CODE}${phone}`).trim();
      const response = await sellerApi.verifyOtp(verifyPhone, code);
      const data = response?.data?.result || response?.data?.data || response?.data || {};
      const accessToken = data?.accessToken || data?.token;
      const sellerUser = data?.seller || data?.user || data?.data?.seller || data?.data?.user;

      if (!accessToken) {
        throw new Error("Login succeeded but no access token was returned");
      }

      // Drop another seller's half-filled onboarding draft before this session continues.
      const loginPhone =
        sellerUser?.phone || `${DEFAULT_COUNTRY_CODE} ${phone}`.trim();
      const existingDraft = readSellerOnboardingDraft();
      if (!draftMatchesSellerPhone(existingDraft, loginPhone)) {
        clearSellerOnboardingDraft();
      }

      const needsOnboarding =
        sellerUser?.approved === false &&
        (sellerUser?.onboardingSubmitted !== true ||
          sellerUser?.approvalStatus === "draft" ||
          sellerUser?.approvalStatus === "rejected");
      if (needsOnboarding) {
        markSellerOnboardingResume();
        if (!draftMatchesSellerPhone(existingDraft, loginPhone)) {
          writeSellerOnboardingDraft({
            phone: loginPhone,
            form: { phone: loginPhone },
            step: 1,
          });
        }
      } else {
        clearSellerOnboardingResume();
      }

      const userPayload = {
        ...sellerUser,
        name: sellerUser?.name || "",
        shopName: sellerUser?.shopName || "",
        phone:
          sellerUser?.phone ||
          `${DEFAULT_COUNTRY_CODE} ${phone}`.trim(),
        email: sellerUser?.email || "",
        token: accessToken,
        role: "seller",
      };

      if (sellerUser?.approvalStatus === "rejected") {
        setIsLoading(false);
        setRejectionModalData({
          isOpen: true,
          reason: sellerUser.approvalNotes || sellerUser.rejectionReason || "Your previous application was rejected. Please update your details and re-apply.",
          userPayload
        });
        return;
      }

      // Ensure seller token is saved in localStorage so Onboarding page can access it
      localStorage.setItem("auth_seller", accessToken);
      localStorage.setItem("token", accessToken);
      window.dispatchEvent(new Event("sellerAuthChanged"));

      login(userPayload);
      toast.success(
        sellerUser?.approved === false
          ? "OTP verified. Welcome to seller onboarding!"
          : "Seller login successful",
      );
      navigate(
        sellerUser?.approved === false && sellerUser?.onboardingSubmitted !== true
          ? "/seller/onboarding"
          : nextSellerPath,
        { replace: true },
      );
    } catch (error) {
      const apiMessage = error?.response?.data?.message || error?.message || "OTP verification failed";
      if (apiMessage.toLowerCase().includes("seller account not found")) {
        toast.info("Please complete your seller registration.");
        navigate("/seller/onboarding", { replace: true });
        return;
      }
      toast.error(apiMessage);
      setOtp(["", "", "", ""]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every((digit) => digit !== "") && newOtp.length === 4) {
      handleVerifyOtp(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
      }
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const digits = pastedData.replace(/\D/g, "").slice(0, 4).split("");
    const newOtp = ["", "", "", ""];
    digits.forEach((digit, i) => {
      if (i < 4) {
        newOtp[i] = digit;
      }
    });
    setOtp(newOtp);
    if (digits.length === 4) {
      handleVerifyOtp(newOtp.join(""));
    } else {
      inputRefs.current[digits.length]?.focus();
    }
  };

  const isPhoneValid = phone.length === 10;

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row pt-0 sm:pt-0 font-sans">
      {/* Top Banner section with Image Slider and Curve */}
      <div className="w-full lg:w-1/2 relative h-[350px] md:h-[450px] lg:h-screen flex flex-col items-center justify-center text-center text-white lg:shadow-2xl z-10">
        {/* Background Image Slider */}
        {sliderImages.map((img, idx) => (
          <div
            key={idx}
            className="absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-1000"
            style={{
              backgroundImage: `url('${img}')`,
              opacity: currentImageIndex === idx ? 1 : 0,
            }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent" />

        {/* Back Button (if otp step) */}
        {step === "otp" && (
          <button 
            type="button"
            onClick={resetToPhoneStep}
            className="absolute top-6 left-6 z-20 p-2 bg-white/20 hover:bg-white/30 active:scale-95 rounded-full backdrop-blur-sm transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        )}

        <div className="relative z-10 flex flex-col items-center mt-[-40px]">
          <motion.div 
            animate={{ rotate: currentImageIndex * 360 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="mb-4"
          >
            <AuthCircleLogo src={logoUrl} alt={companyName} fallbackText={companyName} accentClassName="bg-[#E71D28]" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2 drop-shadow-lg text-white">
            {companyName}
          </h1>
          <p className="text-xs md:text-sm font-bold text-white/90 tracking-[0.2em] uppercase drop-shadow-md">
            Manage your store easily
          </p>
        </div>

        {/* Curved Bottom SVG (Hidden on Desktop) */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none z-10 lg:hidden">
          <svg
            className="relative block w-full h-[60px] md:h-[80px]"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
          >
            <path
              fill="currentColor"
              className="text-white"
              d="M0,192L48,202.7C96,213,192,235,288,229.3C384,224,480,192,576,192C672,192,768,224,864,213.3C960,203,1056,149,1152,133.3C1248,117,1344,139,1392,149.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            ></path>
          </svg>
        </div>
      </div>

      <div className="flex-1 bg-white max-w-full w-full lg:w-1/2 relative z-20 flex flex-col items-center lg:justify-center">
        <div className="w-full max-w-[480px] px-5 sm:px-6 py-4 flex flex-col justify-start sm:justify-center -mt-16 lg:mt-0">
          {/* Main Card */}
          <div className="bg-white rounded-[24px] sm:rounded-3xl p-5 sm:p-7 md:px-10 md:py-8 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.1)] lg:shadow-none lg:border-none border border-gray-100">
             <div className="text-center mb-5 sm:mb-6 mt-[-5px] space-y-1.5 sm:space-y-2">
                 <h2 className="text-xl sm:text-2xl font-semibold text-[#1c1c1e] tracking-tight">
                  {step === "phone" ? "Seller Login" : "Verify OTP"}
                </h2>
                <div className="h-[2px] w-12 sm:w-16 bg-[#e71d28] mx-auto rounded-full" />
             </div>

             <div className="space-y-5 sm:space-y-6">
               {step === "phone" ? (
                 <>
                   <div className="space-y-3 sm:space-y-4">
                     <div className="flex items-center border-b-2 border-gray-200 focus-within:border-[#e71d28] transition-all py-1.5 sm:py-2 group">
                       <div className="pl-1 flex items-center pointer-events-none">
                         <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#e71d28]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                         </svg>
                       </div>
                       <div className="flex items-center pointer-events-none pl-2">
                          <span className="text-base sm:text-lg font-bold text-gray-900 border-r border-gray-200 pr-2 sm:pr-3">{DEFAULT_COUNTRY_CODE}</span>
                       </div>
                       <input
                         type="tel"
                         maxLength={10}
                         inputMode="numeric"
                         placeholder="Phone number"
                         value={phone}
                         onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                         className="block w-full pl-2 sm:pl-3 pr-4 py-1 bg-transparent text-gray-900 outline-none placeholder:text-gray-300 font-bold text-base sm:text-lg"
                       />
                     </div>
                   </div>
                   <p className="text-[10px] sm:text-[11px] text-gray-400 text-center leading-relaxed px-2">
                     We will send success notifications and order updates via verification code
                   </p>
                   
                   <Button
                      onClick={handleSendOtp}
                      disabled={!isPhoneValid || isLoading}
                      className={`w-full h-11 sm:h-12 md:h-14 rounded-xl sm:rounded-2xl font-black text-sm sm:text-base md:text-lg tracking-wide transition-all duration-300 ${isPhoneValid && !isLoading
                        ? "bg-[#e71d28] hover:bg-[#c41922] text-white shadow-lg shadow-[#e71d28]/20 transform active:scale-[0.98]"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                        }`}
                    >
                      {isLoading ? "Processing..." : "Get Verification Code"}
                    </Button>
                 </>
               ) : (
                 <>
                   <p className="text-sm font-bold text-slate-400 text-center mb-4">
                     Sent to {maskedPhone}
                   </p>
                   {/* 6-Digit Grid */}
                   <div className="flex justify-center gap-2">
                     {otp.map((digit, index) => (
                       <input
                         key={index}
                         ref={(el) => (inputRefs.current[index] = el)}
                         type="text"
                         inputMode="numeric"
                         maxLength={1}
                         value={digit}
                         onChange={(e) => handleOtpChange(index, e.target.value)}
                         onKeyDown={(e) => handleOtpKeyDown(index, e)}
                         onPaste={index === 0 ? handleOtpPaste : undefined}
                         onFocus={() => setFocusedIndex(index)}
                         onBlur={() => setFocusedIndex(null)}
                         disabled={isLoading}
                         className={`w-10 h-14 sm:w-12 sm:h-14 bg-transparent border-b-2 text-center text-2xl font-medium text-slate-900 focus:outline-none transition-all duration-300 ${focusedIndex === index
                           ? "border-[#e71d28]"
                           : "border-gray-200"
                           }`}
                       />
                     ))}
                   </div>

                   <Button
                     onClick={() => handleVerifyOtp()}
                     disabled={isLoading || otp.join("").length < 4}
                     className={`w-full h-12 md:h-14 rounded-2xl font-black text-base md:text-lg tracking-wide transition-all duration-300 ${otp.join("").length >= 4 && !isLoading
                       ? "bg-[#e71d28] hover:bg-[#c41922] text-white shadow-lg shadow-[#e71d28]/20 transform active:scale-[0.98]"
                       : "bg-slate-100 text-slate-400 cursor-not-allowed"
                       }`}
                   >
                     {isLoading ? "Verifying..." : "Verify Code"}
                   </Button>
                 </>
               )}
             </div>
             
             {step === "phone" && (
             <div className="mt-5 sm:mt-8">
               <div className="pt-4 sm:pt-5 border-t border-gray-100 text-center space-y-1.5 sm:space-y-2">
                 <p className="text-[10px] sm:text-[11px] md:text-xs text-slate-400 font-medium">
                    By logging in, you agree to our
                  </p>
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] md:text-xs font-bold text-[#c41922]">
                    <button
                      type="button"
                      onClick={() => handleOpenLegalPage("terms")}
                      className="hover:underline cursor-pointer"
                    >
                      Terms & Conditions
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => handleOpenLegalPage("privacy")}
                      className="hover:underline cursor-pointer"
                    >
                      Privacy Policy
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => handleOpenLegalPage("support")}
                      className="hover:underline cursor-pointer"
                    >
                      Support
                    </button>
                  </div>
               </div>
             </div>
             )}
          </div>
          <div className="pb-6 sm:pb-8 text-center mt-5 sm:mt-6">
            <p className="text-[10px] font-medium text-slate-400 tracking-wider uppercase">
              &copy; {new Date().getFullYear()} {companyName.toUpperCase()} SELLER PARTNER
            </p>
          </div>
        </div>
      </div>

      {rejectionModalData.isOpen && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-100 transform transition-all duration-300 animate-in zoom-in-95 duration-300 flex flex-col font-sans">
            {/* Top Red Gradient Banner */}
            <div className="bg-gradient-to-r from-red-500 to-rose-600 px-6 py-8 text-center text-white relative">
              <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto flex items-center justify-center backdrop-blur-sm mb-3">
                <X className="w-8 h-8 text-white stroke-[3px]" />
              </div>
              <h3 className="text-xl font-black tracking-tight uppercase">Application Rejected</h3>
              <p className="text-white/80 text-xs font-semibold mt-1">Our review team has rejected your onboarding request.</p>
            </div>

            {/* Reason content */}
            <div className="p-6 space-y-4 flex-1">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rejection Reason</span>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-700 text-sm font-medium italic relative overflow-hidden">
                  <span className="absolute -left-1 -top-2 text-7xl text-slate-200/50 pointer-events-none select-none font-serif">“</span>
                  <p className="relative z-10 leading-relaxed font-sans">{rejectionModalData.reason}</p>
                </div>
              </div>

              <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 flex gap-3">
                <div className="flex-1 text-xs text-amber-800 leading-relaxed font-medium">
                  <strong>Please note:</strong> Your previous application details are saved. You can edit the required fields and submit again for review.
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="px-6 pb-6 pt-2 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (rejectionModalData.userPayload) {
                    login(rejectionModalData.userPayload);
                    sessionStorage.setItem("sellerReonboard", "true");
                  }
                  setRejectionModalData({ isOpen: false, reason: "", userPayload: null });
                  navigate("/seller/onboarding", { replace: true });
                }}
                className="w-full h-14 bg-gradient-to-r from-rose-600 to-red-500 hover:from-rose-700 hover:to-red-600 text-white rounded-2xl font-black text-sm tracking-widest uppercase shadow-lg shadow-red-500/20 active:scale-[0.98] transition-all"
              >
                Edit & Re-apply
              </button>
              <button
                type="button"
                onClick={() => setRejectionModalData({ isOpen: false, reason: "", userPayload: null })}
                className="w-full h-12 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-2xl font-bold text-sm tracking-wider transition-all"
              >
                Cancel / Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {legalModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl border border-slate-100 transform transition-all duration-300 flex flex-col font-sans relative">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-900">{legalModal.title || "Details"}</h3>
              <button
                type="button"
                onClick={closeLegalModal}
                className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 text-slate-700 text-sm leading-relaxed prose prose-slate max-w-none">
              {legalModal.isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                  <div className="w-8 h-8 border-2 border-slate-200 border-t-[#e71d28] rounded-full animate-spin" />
                  <p className="font-medium">Loading...</p>
                </div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: legalModal.content || "No information available at this time." }} />
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end">
              <Button
                type="button"
                onClick={closeLegalModal}
                className="bg-slate-900 text-white font-bold px-8 h-12 rounded-xl hover:bg-black transition-colors"
              >
                I Understand
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
