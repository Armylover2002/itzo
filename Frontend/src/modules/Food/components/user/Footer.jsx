import { Link } from "react-router-dom"
import { Mail, Phone, MapPin, Heart } from "lucide-react"
import { useState, useEffect } from "react"
import { getCachedSettings, loadBusinessSettings, getAppLogo } from "@common/utils/businessSettings"
import { useCompanyName } from "@food/hooks/useCompanyName"

// Social Icons exactly from http://localhost:5173/ (FooterSection.jsx)
const InstagramOriginal = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#paint0_linear_food_user_insta)"/>
    <rect x="6" y="6" width="12" height="12" rx="3" stroke="white" strokeWidth="1.8" fill="none" />
    <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.8" fill="none" />
    <circle cx="15.5" cy="8.5" r="0.9" fill="white" />
    <defs>
      <linearGradient id="paint0_linear_food_user_insta" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#FEE140"/>
        <stop offset="25%" stopColor="#FA709A"/>
        <stop offset="50%" stopColor="#D6017B"/>
        <stop offset="75%" stopColor="#8A3AB9"/>
        <stop offset="100%" stopColor="#4C5FD7"/>
      </linearGradient>
    </defs>
  </svg>
);

const YoutubeOriginal = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.54 6.42C22.4214 5.94523 22.1554 5.51865 21.7801 5.20455C21.4047 4.89045 20.9398 4.70568 20.45 4.68C18.6 4.5 12 4.5 12 4.5C12 4.5 5.4 4.5 3.55 4.68C3.06019 4.70568 2.59526 4.89045 2.21992 5.20455C1.84457 5.51865 1.5786 5.94523 1.46 6.42C1.22 8.24 1.22 12 1.22 12C1.22 12 1.22 15.76 1.46 17.58C1.5786 18.0548 1.84457 18.4814 2.21992 18.7955C2.59526 19.1095 3.06019 19.2943 3.55 19.32C5.4 19.5 12 19.5 12 19.5C12 19.5 18.6 19.5 20.45 19.32C20.9398 19.2943 21.4047 19.1095 21.7801 18.7955C22.1554 18.4814 22.4214 18.0548 22.54 17.58C22.78 15.76 22.78 12 22.78 12C22.78 12 22.78 8.24 22.54 6.42Z" fill="#FF0000"/>
    <path d="M9.75 15.02L15.5 12L9.75 8.98V15.02Z" fill="white"/>
  </svg>
);

const LinkedinOriginal = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.447 20.452H16.891V14.881C16.891 13.554 16.868 11.848 15.044 11.848C13.201 11.848 12.918 13.287 12.918 14.786V20.452H9.362V9H12.776V10.561H12.825C13.3 9.66 14.463 8.712 16.182 8.712C19.774 8.712 20.447 11.074 20.447 14.167V20.452ZM5.337 7.433C4.195 7.433 3.275 6.51 3.275 5.37C3.275 4.232 4.195 3.309 5.337 3.309C6.474 3.309 7.4 4.232 7.4 5.37C7.4 6.51 6.474 7.433 5.337 7.433ZM7.119 20.452H3.555V9H7.119V20.452ZM22.225 0H1.771C0.792 0 0 0.774 0 1.729V22.271C0 23.227 0.792 24 1.771 24H22.222C23.2 24 24 23.227 24 22.271V1.729C24 0.774 23.2 0 22.225 0Z" fill="#0A66C2"/>
  </svg>
);

const FacebookOriginal = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073C24 5.405 18.627 0 12 0C5.373 0 0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24V15.563H7.078V12.073H10.125V9.412C10.125 6.388 11.916 4.716 14.658 4.716C15.97 4.716 17.344 4.951 17.344 4.951V7.92H15.831C14.34 7.92 13.875 8.85 13.875 9.805V12.073H17.188L16.656 15.563H13.875V24C19.612 23.094 24 18.1 24 12.073Z" fill="#1877F2"/>
  </svg>
);

const TwitterOriginal = () => (
  <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#000000"/>
  </svg>
);

export default function Footer() {
  const companyName = useCompanyName()
  const currentYear = new Date().getFullYear()
  const [logoUrl, setLogoUrl] = useState(undefined)
  const [businessSettings, setBusinessSettings] = useState(() => getCachedSettings() || {})

  // Load business settings and logo
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const cached = getCachedSettings()
        if (cached) {
          setBusinessSettings(cached)
          const foundLogo = cached.userLogo?.url || cached.landingFooterLogo?.url || cached.logo?.url || getAppLogo('user')
          if (foundLogo) setLogoUrl(foundLogo)
        } else {
          const settings = await loadBusinessSettings()
          if (settings) {
            setBusinessSettings(settings)
            const foundLogo = settings.userLogo?.url || settings.landingFooterLogo?.url || settings.logo?.url || getAppLogo('user')
            if (foundLogo) setLogoUrl(foundLogo)
          }
        }
      } catch (error) {
        // Silently fail, use default logo
      }
    }
    loadSettings()

    // Listen for business settings updates
    const handleSettingsUpdate = (e) => {
      const cached = e?.detail || getCachedSettings()
      if (cached) {
        setBusinessSettings(cached)
        const foundLogo = cached.userLogo?.url || cached.landingFooterLogo?.url || cached.logo?.url || getAppLogo('user')
        if (foundLogo) setLogoUrl(foundLogo)
      }
    }
    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate)

    return () => {
      window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate)
    }
  }, [])

  // Exact social links mapped from business settings, matching http://localhost:5173/
  const socialLinks = [
    { name: 'Linkedin', icon: LinkedinOriginal, url: businessSettings?.socialLinkedinUrl || '#' },
    { name: 'Instagram', icon: InstagramOriginal, url: businessSettings?.socialInstagramUrl || '#' },
    { name: 'Youtube', icon: YoutubeOriginal, url: businessSettings?.socialYoutubeUrl || '#' },
    { name: 'Facebook', icon: FacebookOriginal, url: businessSettings?.socialFacebookUrl || '#' },
    { name: 'X', icon: TwitterOriginal, url: businessSettings?.socialTwitterUrl || '#' },
  ]

  // Footer links: Company removed; Help Center and Contact Us removed from Support
  const footerLinks = {
    support: [
      { name: "Privacy Policy", href: "/profile/privacy" },
      { name: "Terms & Conditions", href: "/profile/terms" },
    ],
    user: [
      { name: "My Account", href: "/user/profile" },
      { name: "My Orders", href: "/user/orders" },
      { name: "Favorites", href: "/user/profile/favorites" },
      { name: "Offers", href: "/user/offers" },
    ],
  }

  return (
    <footer className="relative bg-gradient-to-br from-[#FE5502] via-orange-600 to-[#C83C00] text-white mt-auto pt-16 pb-20 md:pb-12 overflow-hidden">
      {/* Subtle Glow Overlay */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-30 blur-[150px] bg-orange-400" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full opacity-20 blur-[150px] bg-orange-400" />
      </div>

      {/* Top Curved Divider */}
      <div className="absolute top-[-1px] left-0 w-full overflow-hidden leading-[0]">
        <svg className="relative block w-[calc(100%+1.3px)] h-[20px] md:h-[40px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,0 Q600,120 1200,0 V0 H0 Z" className="fill-white dark:fill-[#0a0a0a]"></path>
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 mb-8">
          {/* Brand Section */}
          <div className="md:col-span-2 space-y-4">
            <div>
              <div className="flex items-center gap-3 mb-4">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt={companyName || "Logo"}
                    className="h-12 w-12 rounded-full object-cover bg-white p-0.5 shadow-md"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                )}
                <span className="text-2xl font-black tracking-tight text-white drop-shadow-sm">
                  {companyName || "ItzoFood"}
                </span>
              </div>
              <p className="text-white/90 text-sm leading-relaxed max-w-md font-medium">
                Delivering delicious food to your doorstep. Order from your favorite restaurants
                and enjoy fresh, hot meals in minutes.
              </p>
            </div>

            {/* Contact Info */}
            <div className="space-y-2">
              {(businessSettings?.companySupportNumber || businessSettings?.phone?.number) && (
                <div className="flex items-center gap-2 text-white/90 text-sm">
                  <Phone className="h-4 w-4 shrink-0 text-white" />
                  <a href={`tel:${(businessSettings.companySupportNumber || businessSettings.phone?.number || '').replace(/\s+/g, '')}`} className="hover:underline transition-all">
                    {businessSettings.companySupportNumber || (businessSettings.phone?.number ? `${businessSettings.phone.countryCode || '+91'} ${businessSettings.phone.number}` : '')}
                  </a>
                </div>
              )}
              {(businessSettings?.customerSupportEmail || businessSettings?.helpAndSupportEmail || businessSettings?.email) && (
                <div className="flex items-center gap-2 text-white/90 text-sm">
                  <Mail className="h-4 w-4 shrink-0 text-white" />
                  <a href={`mailto:${businessSettings.customerSupportEmail || businessSettings.helpAndSupportEmail || businessSettings.email}`} className="hover:underline transition-all">
                    {businessSettings.customerSupportEmail || businessSettings.helpAndSupportEmail || businessSettings.email}
                  </a>
                </div>
              )}
              {(businessSettings?.address || businessSettings?.state) && (
                <div className="flex items-center gap-2 text-white/90 text-sm">
                  <MapPin className="h-4 w-4 shrink-0 text-white" />
                  <span>{[businessSettings.address, businessSettings.state, businessSettings.pincode].filter(Boolean).join(', ')}</span>
                </div>
              )}
            </div>

            {/* Social Media matching http://localhost:5173/ */}
            <div className="flex items-center gap-3 pt-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1.5 shadow-md hover:scale-110 active:scale-95 transition-transform shrink-0"
                  aria-label={social.name}
                >
                  <social.icon />
                </a>
              ))}
            </div>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="font-bold text-lg mb-4 text-white">Support</h3>
            <ul className="space-y-2.5">
              {footerLinks.support.map((link, index) => (
                <li key={index}>
                  <Link
                    to={link.href}
                    className="text-white/85 hover:text-white transition-colors text-sm font-medium"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* User Links */}
          <div>
            <h3 className="font-bold text-lg mb-4 text-white">For You</h3>
            <ul className="space-y-2.5">
              {footerLinks.user.map((link, index) => (
                <li key={index}>
                  <Link
                    to={link.href}
                    className="text-white/85 hover:text-white transition-colors text-sm font-medium"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/20 pt-6 mt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/80 text-sm text-center md:text-left font-medium">
              &copy; {currentYear} {companyName}. All rights reserved.
            </p>
            <div className="flex items-center gap-1 text-white/80 text-sm font-medium">
              <span>Made with</span>
              <span>
                <Heart className="h-4 w-4 fill-white text-white" />
              </span>
              <span>for food lovers</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
