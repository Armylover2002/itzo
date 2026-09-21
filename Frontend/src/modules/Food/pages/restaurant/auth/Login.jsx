import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ShieldCheck } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { restaurantAPI } from "@food/api"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { getAppLogo, getRestaurantLoginBanner, subscribeBusinessSettings } from "@common/utils/businessSettings"
import loginBg from "@food/assets/loginbanner.png"
import RestaurantAuthFooter from "@food/components/restaurant/RestaurantAuthFooter"
import AuthCircleLogo from "@shared/components/AuthCircleLogo"
import LoginGrowthPanel from "@shared/components/LoginGrowthPanel"

const DEFAULT_COUNTRY_CODE = "+91"
const countryCodes = [
  { code: DEFAULT_COUNTRY_CODE, country: "IN", flag: "India" },
]

export default function RestaurantLogin() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const phoneInputRef = useRef(null)
  const [logoUrl, setLogoUrl] = useState(() => getAppLogo('restaurant'))
  const [bannerUrl, setBannerUrl] = useState(() => {
    const banner = getRestaurantLoginBanner()
    return (banner && banner.url && banner.active) ? banner.url : loginBg
  })

  const sliderImages = [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1200&q=80",
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80"
  ];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % sliderImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const apply = () => {
      const logo = getAppLogo('restaurant')
      if (logo) setLogoUrl(logo)
      const banner = getRestaurantLoginBanner()
      if (banner && banner.url && banner.active) {
        setBannerUrl(banner.url)
      } else {
        setBannerUrl(loginBg)
      }
    }
    apply()
    return subscribeBusinessSettings(apply)
  }, [])

  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem("restaurantLoginPhone")
    return {
      phone: saved || "",
      countryCode: DEFAULT_COUNTRY_CODE,
    }
  })
  const [error, setError] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [keyboardInset, setKeyboardInset] = useState(0)

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return undefined

    const updateKeyboardInset = () => {
      const viewport = window.visualViewport
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      setKeyboardInset(inset > 0 ? inset : 0)
    }

    updateKeyboardInset()
    window.visualViewport.addEventListener("resize", updateKeyboardInset)
    window.visualViewport.addEventListener("scroll", updateKeyboardInset)

    return () => {
      window.visualViewport.removeEventListener("resize", updateKeyboardInset)
      window.visualViewport.removeEventListener("scroll", updateKeyboardInset)
    }
  }, [])

  useEffect(() => {
    if (keyboardInset > 0) {
      ensurePhoneFieldVisible()
    }
  }, [keyboardInset])

  const validatePhone = (phone, countryCode) => {
    if (!phone || phone.trim() === "") return "Phone number is required"

    const digitsOnly = phone.replace(/\D/g, "")
    if (digitsOnly.length < 7) return "Phone number must be at least 7 digits"
    if (digitsOnly.length > 15) return "Phone number is too long"

    if (digitsOnly.length !== 10) return "Indian phone number must be 10 digits"
    if (!["6", "7", "8", "9"].includes(digitsOnly[0])) {
      return "Invalid Indian mobile number"
    }

    return ""
  }

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 10)
    setFormData((prev) => ({ ...prev, phone: value }))
    sessionStorage.setItem("restaurantLoginPhone", value)

    if (error) {
      setError(validatePhone(value, formData.countryCode))
    }
  }

  const ensurePhoneFieldVisible = () => {
    window.setTimeout(() => {
      const content = document.getElementById('login-content')
      if (content) {
        content.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        phoneInputRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
      }
    }, 300)
  }

  const handleSendOTP = async () => {
    const phoneError = validatePhone(formData.phone, formData.countryCode)
    setError(phoneError)
    if (phoneError) return

    const fullPhone = `${formData.countryCode || DEFAULT_COUNTRY_CODE} ${formData.phone}`.trim()

    try {
      setIsSending(true)
      await restaurantAPI.sendOTP(fullPhone, "login")

      const authData = {
        method: "phone",
        phone: fullPhone,
        isSignUp: false,
        module: "restaurant",
      }
      sessionStorage.setItem("restaurantAuthData", JSON.stringify(authData))
      navigate("/food/restaurant/otp")
    } catch (apiErr) {
      const message =
        apiErr?.response?.data?.message ||
        apiErr?.response?.data?.error ||
        "Failed to send OTP. Please try again."
      setError(message)
    } finally {
      setIsSending(false)
    }
  }

  const isValidPhone = !validatePhone(formData.phone, formData.countryCode)

  return (
    <div className="min-h-screen bg-slate-800 lg:bg-white flex flex-col lg:flex-row pt-0 sm:pt-0 font-sans">
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

        {/* Back Button Placeholder if needed */}

        <div className="relative z-10 flex flex-col items-center mt-[-40px]">
          <div className="mb-4">
            <AuthCircleLogo src={logoUrl} alt={companyName} fallbackText={companyName} />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2 drop-shadow-lg text-white">
            {companyName}
          </h1>
          <p className="text-xs md:text-sm font-bold text-white/90 tracking-[0.2em] uppercase drop-shadow-md">
            Taste the best, forget the rest
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
              className="text-slate-800"
              d="M0,192L48,202.7C96,213,192,235,288,229.3C384,224,480,192,576,192C672,192,768,224,864,213.3C960,203,1056,149,1152,133.3C1248,117,1344,139,1392,149.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            ></path>
          </svg>
        </div>
      </div>

      <div className="flex-1 bg-slate-800 lg:bg-white max-w-full w-full lg:w-1/2 relative z-20 flex flex-col items-center lg:justify-center">
        <div className="w-full max-w-[480px] px-5 sm:px-6 py-4 flex flex-col justify-start sm:justify-center -mt-16 lg:mt-0">
          {/* Main Card */}
          <div className="bg-white rounded-[24px] sm:rounded-3xl p-5 sm:p-7 md:px-10 md:py-8 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.3)] lg:shadow-none lg:border-none border border-gray-50">
             <div className="text-center mb-5 sm:mb-6 mt-[-5px] space-y-1.5 sm:space-y-2">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-serif font-bold text-gray-900 tracking-wide">Login or Signup</h2>
                <div className="h-[2px] w-12 sm:w-16 bg-[#6b554b] mx-auto rounded-full" />
             </div>

             <div className="space-y-5 sm:space-y-6">
               <div className="space-y-3 sm:space-y-4">
                 <div className="flex items-center border-b-2 border-gray-200 focus-within:border-[#0D315B] transition-all py-1.5 sm:py-2 group">
                   <div className="pl-1 flex items-center pointer-events-none">
                     <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#0D315B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                       <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                     </svg>
                   </div>
                   <div className="flex items-center pointer-events-none pl-2">
                      <span className="text-base sm:text-lg font-bold text-gray-900 border-r border-gray-200 pr-2 sm:pr-3">{formData.countryCode}</span>
                   </div>
                   <input
                     ref={phoneInputRef}
                     type="tel"
                     maxLength={10}
                     inputMode="numeric"
                     autoComplete="tel-national"
                     enterKeyHint="done"
                     placeholder="Phone number"
                     value={formData.phone}
                     onChange={handlePhoneChange}
                     onFocus={ensurePhoneFieldVisible}
                     className="block w-full pl-2 sm:pl-3 pr-4 py-1 bg-transparent text-gray-900 outline-none placeholder:text-gray-300 font-bold text-base sm:text-lg"
                   />
                 </div>
                 {error && (
                   <p className="text-[#0D315B] text-xs font-bold italic animate-bounce px-2">
                     {error}
                   </p>
                 )}
               </div>
               <p className="text-[10px] sm:text-[11px] text-gray-400 text-center leading-relaxed px-2">
                 We will send success notifications and order updates via verification code
               </p>
               
               <Button
                  onClick={handleSendOTP}
                  disabled={!isValidPhone || isSending}
                  className={`w-full h-11 sm:h-12 md:h-14 rounded-xl sm:rounded-2xl font-black text-sm sm:text-base md:text-lg tracking-wide transition-all duration-300 ${isValidPhone && !isSending
                    ? "bg-[#0D315B] hover:bg-[#E64D02] text-white shadow-lg shadow-[#0D315B]/20 transform active:scale-[0.98]"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                >
                  {isSending ? "Processing..." : "Get Verification Code"}
                </Button>
             </div>
             
             <div className="mt-5 sm:mt-8">
               <RestaurantAuthFooter className="pt-4 sm:pt-5 border-t border-gray-100" />
             </div>

             <LoginGrowthPanel role="restaurant" className="mt-5 sm:mt-6" />
          </div>
        </div>
      </div>
    </div>
  )
}
