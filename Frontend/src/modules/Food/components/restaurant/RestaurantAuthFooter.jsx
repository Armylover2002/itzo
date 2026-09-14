import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from "lucide-react"
import { useBusinessSettingsCache } from "@common/hooks/useBusinessSettingsCache"

const LEGAL_LINKS = [
  { label: "Terms & Conditions", path: "/food/restaurant/terms" },
  { label: "Privacy Policy", path: "/food/restaurant/privacy" },
  { label: "Support", path: "/food/restaurant/support" },
]

const SOCIAL_ICON_MAP = [
  { key: "facebook", Icon: Facebook },
  { key: "instagram", Icon: Instagram },
  { key: "twitter", Icon: Twitter },
  { key: "linkedin", Icon: Linkedin },
  { key: "youtube", Icon: Youtube },
]

export default function RestaurantAuthFooter({
  className = "",
  linkClassName = "",
  variant = "light",
}) {
  const navigate = useNavigate()
  const settings = useBusinessSettingsCache()

  const socialLinks = useMemo(() => {
    const links = settings?.socialLinks || {}
    return SOCIAL_ICON_MAP
      .filter(({ key }) => Boolean(String(links[key] || "").trim()))
      .map(({ key, Icon }) => ({
        key,
        Icon,
        href: String(links[key]).trim(),
      }))
  }, [settings])

  const mutedTextClass = variant === "dark" ? "text-white/70" : "text-slate-400"
  const socialButtonClass = variant === "dark"
    ? "border-white/20 text-white/80 hover:text-white hover:border-white/40"
    : "border-slate-200 text-slate-500 hover:text-[#FF0000] hover:border-[#FF0000]/30"
  const defaultLinkClass = variant === "dark" ? "text-white/90 hover:text-white" : "text-[#FF0000]"

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="text-center">
        <p className={`${mutedTextClass} text-[10px] md:text-xs font-medium`}>
          By logging in, you agree to our
        </p>
        <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center justify-center gap-x-1.5 sm:gap-x-2 gap-y-1">
          {LEGAL_LINKS.map((item, index) => (
            <span key={item.path} className="inline-flex items-center gap-1.5 sm:gap-2">
              {index > 0 && <span className={variant === "dark" ? "text-white/30" : "text-slate-300"}>•</span>}
              <button
                type="button"
                onClick={() => navigate(item.path)}
                className={`bg-transparent border-0 p-0 text-[10px] md:text-xs font-bold hover:underline cursor-pointer ${defaultLinkClass} ${linkClassName}`}
              >
                {item.label}
              </button>
            </span>
          ))}
        </div>
      </div>

      {socialLinks.length > 0 && (
        <div className="flex items-center justify-center gap-3">
          {socialLinks.map(({ key, href, Icon }) => (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${socialButtonClass}`}
              aria-label={key}
            >
              <Icon className="w-4 h-4" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
