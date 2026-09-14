import React, { useMemo } from "react"
import { motion } from "framer-motion"
import { useLocation, useNavigate } from "react-router-dom"
import { UtensilsCrossed, ShoppingBasket, ShieldCheck, User } from "lucide-react"
import { cn } from "@food/utils/utils"

const SERVICES = [
  {
    id: "food",
    moduleKey: "food",
    name: "Foods",
    description: "Delicious local favorites",
    image: "/super-app/food.png",
    path: "/food/user",
    icon: UtensilsCrossed,
    color: "from-primary-orange to-primary-hover",
    badge: "Fast",
    badgeIcon: "⚡"
  },
  {
    id: "grocery",
    moduleKey: "quickCommerce",
    name: "Quick Commerce",
    description: "20-Min Essentials",
    image: "/super-app/grocery.png",
    path: "/quick",
    icon: ShoppingBasket,
    color: "from-[#4CAF50] to-[#2DAB52]",
    badge: "Instant",
    badgeIcon: "⏱️"
  },
]

export default function SuperAppPortal() {
  const location = useLocation()
  const navigate = useNavigate()
  const redirectTo = typeof location.state?.redirectTo === "string" && location.state.redirectTo.trim()
    ? location.state.redirectTo.trim()
    : ""
  const isNativeLikeShell = typeof window !== "undefined" && (
    Boolean(window.flutter_inappwebview) ||
    Boolean(window.ReactNativeWebView) ||
    String(window.location?.protocol || "").toLowerCase() === "file:" ||
    String(window.navigator?.userAgent || "").toLowerCase().includes(" wv") ||
    String(window.navigator?.userAgent || "").toLowerCase().includes("; wv") ||
    String(window.navigator?.userAgent || "").toLowerCase().includes("flutterwebview")
  )
  const particlePositions = useMemo(
    () => Array.from({ length: 6 }, (_, index) => ({
      id: index,
      left: `${12 + index * 14}%`,
      top: `${10 + (index % 3) * 24}%`,
    })),
    [],
  )

  const [enabledModules, setEnabledModules] = React.useState({
    food: true,
    quickCommerce: true,
  })
  const [companyName, setCompanyName] = React.useState("App")
  const [logoUrl, setLogoUrl] = React.useState(null)

  React.useEffect(() => {
    let cancelled = false
    let unsubscribe = () => {}
    const init = async () => {
      try {
        const {
          getCachedSettings,
          getCompanyName,
          getAppLogo,
          setAppType,
          subscribeBusinessSettings,
        } = await import("@common/utils/businessSettings")
        if (cancelled) return
        setAppType('user')
        const apply = () => {
          const settings = getCachedSettings()
          if (settings?.modules) {
            setEnabledModules(settings.modules)
          }
          setCompanyName(getCompanyName())
          setLogoUrl(getAppLogo('user'))
        }
        apply()
        unsubscribe = subscribeBusinessSettings(apply)
      } catch (err) {
        console.error("Failed to load settings in Portal:", err)
      }
    }
    init()
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const filteredServices = useMemo(() => {
    return SERVICES.filter(service => enabledModules[service.moduleKey] !== false)
  }, [enabledModules])

  const handleServiceClick = (service) => {


    navigate(service.path)
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-[#fafafa] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
      {/* Floating profile action */}
      <button
        type="button"
        onClick={() => navigate("/user/auth/login")}
        className="absolute right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-40 flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-md transition-all hover:bg-gray-50 hover:shadow-lg sm:right-3 sm:top-3"
      >
        <User className="w-4 h-4 text-gray-500" />
        <span className="font-bold text-xs sm:text-sm text-gray-700">Profile</span>
      </button>

      {/* Lining Effect & Pattern Background */}
      {!isNativeLikeShell && (
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]">
          <div className="absolute inset-0" style={{ 
            backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
            backgroundSize: `40px 40px`
          }} />
          <div className="absolute inset-0 animate-scanline" style={{ 
            backgroundImage: `linear-gradient(transparent 0%, #000 50%, transparent 100%)`,
            backgroundSize: `100% 200px`,
            opacity: 0.5
          }} />
      </div>
      )}

      {/* Dynamic Background Particles */}
      {!isNativeLikeShell && (
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          {particlePositions.map((particle, i) => (
             <motion.div
               key={particle.id}
               animate={{
                 y: [0, -100, 0],
                 x: [0, 50, 0],
                 scale: [1, 1.2, 1],
                 opacity: [0.1, 0.2, 0.1]
               }}
               transition={{
                 duration: 10 + i * 2,
                 repeat: Infinity,
                 ease: "linear"
               }}
               className="absolute w-64 h-64 bg-[#CB202D]/5 rounded-full blur-3xl"
               style={{
                 left: particle.left,
                 top: particle.top,
               }}
             />
          ))}
      </div>
      )}

      {/* Top Header Section */}
      <div className="relative z-10 mt-14 flex flex-1 flex-col items-center justify-start space-y-3 text-center sm:mt-12 sm:space-y-4">
        <motion.div
          initial={isNativeLikeShell ? false : { opacity: 0, y: -20 }}
          animate={isNativeLikeShell ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-full px-4 py-2 flex items-center gap-2 shadow-lg shadow-gray-200/40 max-w-full"
        >
          <motion.div 
            animate={isNativeLikeShell ? undefined : { rotate: [0, 10, -10, 0] }}
            transition={isNativeLikeShell ? undefined : { duration: 4, repeat: Infinity }}
            className="w-8 h-8 bg-gradient-to-br from-primary-orange to-primary-hover rounded-md flex items-center justify-center shadow-md flex-shrink-0 overflow-hidden"
          >
             {logoUrl ? (
               <img src={logoUrl} alt={companyName} className="w-full h-full object-contain" />
             ) : (
               <span className="text-white text-[9px] font-black italic">{companyName.charAt(0).toUpperCase()}</span>
             )}
          </motion.div>
          <span className="text-[9px] sm:text-[10px] font-black tracking-[0.18em] text-[#BABCBD] uppercase whitespace-nowrap overflow-hidden text-ellipsis">
            Everything you need, delivered
          </span>
        </motion.div>

        <motion.h1 
          initial={isNativeLikeShell ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={isNativeLikeShell ? { duration: 0.2 } : { type: "spring", damping: 12 }}
          className="text-4xl sm:text-5xl md:text-7xl font-black text-[#1A202C] tracking-tight leading-[0.95]"
        >
          Welcome to <br />
          <span className={`text-transparent bg-clip-text bg-gradient-to-r from-primary-orange via-red-400 to-primary-orange bg-[length:200%_auto] block mt-1 sm:mt-2 ${isNativeLikeShell ? "" : "animate-gradient"}`}>{companyName}</span>
        </motion.h1>

        <motion.p 
          initial={isNativeLikeShell ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={isNativeLikeShell ? { duration: 0.2 } : { delay: 0.3 }}
          className="text-[#718096] text-[13px] sm:text-sm md:text-lg font-bold max-w-[250px] sm:max-w-[320px] mx-auto leading-snug"
        >
          Choose a service to continue
        </motion.p>

        {/* Main Service Grid - compact for mobile */}
        <div className={cn(
          "w-full max-w-[800px] mx-auto mt-3 sm:mt-4 grid gap-3 sm:gap-4 relative z-10",
          filteredServices.length === 1
            ? "grid-cols-1 max-w-[400px]"
            : filteredServices.length === 3
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              : "grid-cols-2"
        )}>
          {filteredServices.map((service, idx) => (
            <motion.div
              key={service.id}
              initial={isNativeLikeShell ? false : { opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={isNativeLikeShell ? { duration: 0.18 } : { 
                delay: 0.15 + idx * 0.06, 
                type: "spring", 
                stiffness: 120,
                damping: 18
              }}
              whileTap={isNativeLikeShell ? undefined : { scale: 0.97 }}
              onClick={() => handleServiceClick(service)}
              className="group cursor-pointer relative perspective"
            >
              <div className={`relative h-[175px] sm:h-[205px] w-full rounded-[1.5rem] overflow-hidden shadow-xl bg-white border border-white/30 ${isNativeLikeShell ? "" : "transition-all duration-500"}`}>
                {/* Image Base */}
                <div className="absolute inset-0 bg-gray-50 overflow-hidden">
                  <img 
                    src={service.image} 
                    alt={service.name} 
                    className={`w-full h-full object-cover ${isNativeLikeShell ? "" : "transition-transform duration-700 group-hover:scale-110"}`}
                  />
                  <div className={`absolute inset-0 bg-gradient-to-tr ${service.color.replace('from-', 'from-black/40 to-')} opacity-25`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
                </div>

                {/* Service Icon floating */}
                <div className="absolute top-3 left-3 z-30">
                  <motion.div 
                    animate={isNativeLikeShell ? undefined : { y: [0, -4, 0] }}
                    transition={isNativeLikeShell ? undefined : { duration: 3, repeat: Infinity, delay: idx * 0.3 }}
                    className={`p-2.5 rounded-xl border border-white/30 shadow-lg ${isNativeLikeShell ? "bg-white/25" : "bg-white/20 backdrop-blur-xl"}`}
                  >
                    <service.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </motion.div>
                </div>

                {/* Content Overlay */}
                <div className="absolute bottom-3 left-3 right-3 z-30 space-y-0.5">
                  <h2 className="text-[1.05rem] sm:text-xl font-black text-white tracking-tight leading-none">
                    {service.name}
                  </h2>
                  <p className="text-white/80 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.08em]">
                    {service.description}
                  </p>
                </div>

                {/* Corner Badge */}
                <div className="absolute top-0 right-0 z-30">
                   <motion.div 
                     initial={isNativeLikeShell ? false : { x: 12, opacity: 0 }}
                     animate={{ x: 0, opacity: 1 }}
                     transition={isNativeLikeShell ? { duration: 0.18 } : { delay: 0.25 + idx * 0.05 }}
                     className={`px-3 py-1.5 rounded-bl-2xl border-l border-b border-white/20 shadow-lg flex items-center gap-1.5 ${isNativeLikeShell ? "bg-black/75" : "bg-black/80 backdrop-blur-xl"}`}
                   >
                      <span className="text-[9px] scale-110">{service.badgeIcon}</span>
                      <span className="text-[9px] font-black text-white uppercase tracking-widest">{service.badge}</span>
                   </motion.div>
                </div>
              </div>

              {/* Neon Glow on Hover */}
              {!isNativeLikeShell && (
                <div className={`absolute inset-0 -z-10 rounded-[1.5rem] bg-gradient-to-br ${service.color} opacity-0 group-hover:opacity-25 blur-xl transition-all duration-500 scale-95`} />
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {!isNativeLikeShell && <style dangerouslySetInnerHTML={{ __html: `
        .perspective {
          perspective: 1000px;
        }
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .animate-scanline {
          animation: scanline 8s linear infinite;
        }
        @keyframes line-shine {
          0% { left: -100%; transition: none; }
          100% { left: 200%; transition: all 0.8s ease-in-out; }
        }
        .animate-line-shine {
          animation: line-shine 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
      `}} />}

      {/* Trust Badge at bottom */}
      <div className="mt-4 hidden sm:flex flex-col items-center gap-3 opacity-50">
         <div className="flex items-center gap-1.5 grayscale">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Secure by {companyName}</span>
         </div>
      </div>
    </div>
  )
}
