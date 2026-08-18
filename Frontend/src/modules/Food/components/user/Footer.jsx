import { Link } from "react-router-dom"
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin, Heart } from "lucide-react"
import { useState, useEffect } from "react"
import { getCachedSettings, loadBusinessSettings } from "@common/utils/businessSettings"
import { useCompanyName } from "@food/hooks/useCompanyName"


export default function Footer() {
  const companyName = useCompanyName()
  const currentYear = new Date().getFullYear()
  const [logoUrl, setLogoUrl] = useState(undefined)

  // Load business settings logo
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const cached = getCachedSettings()
        if (cached?.logo?.url) {
          setLogoUrl(cached.logo.url)
        } else {
          const settings = await loadBusinessSettings()
          if (settings?.logo?.url) {
            setLogoUrl(settings.logo.url)
          }
        }
      } catch (error) {
        // Silently fail, use default logo
      }
    }
    loadLogo()

    // Listen for business settings updates
    const handleSettingsUpdate = () => {
      const cached = getCachedSettings()
      if (cached?.logo?.url) {
        setLogoUrl(cached.logo.url)
      }
    }
    window.addEventListener('businessSettingsUpdated', handleSettingsUpdate)

    return () => {
      window.removeEventListener('businessSettingsUpdated', handleSettingsUpdate)
    }
  }, [])

  const footerLinks = {
    company: [
      { name: "About Us", href: "/user/help" },
      { name: "Careers", href: "/user/help" },
      { name: "Blog", href: "/user/help" },
      { name: "Press", href: "/user/help" },
    ],
    support: [
      { name: "Help Center", href: "/user/help" },
      { name: "Contact Us", href: "/user/help" },
      { name: "Privacy Policy", href: "/profile/privacy" },
      { name: "Terms & Conditions", href: "/profile/terms" },
    ],
    user: [
      { name: "My Account", href: "/user/profile" },
      { name: "My Orders", href: "/user/orders" },
      { name: "Favorites", href: "/user/profile/favorites" },
      { name: "Offers", href: "/user/offers" },
    ],
    restaurants: [
      { name: "Partner With Us", href: "/user/help" },
      { name: "Restaurant Login", href: "/restaurant" },
      { name: "Delivery", href: "/delivery" },
    ],
  }

  return (
    <footer className="hidden md:block bg-zinc-900 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
          {/* Brand Section */}
          <div className="lg:col-span-2 space-y-4">
            <div
              style={{
                animation: 'fadeInUp 0.5s ease-out'
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt={companyName || "Logo"}
                    className="h-10 w-10 rounded-full object-cover"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                )}
                <span className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                  {companyName || "Appzeto"}
                </span>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed max-w-md">
                Delivering delicious food to your doorstep. Order from your favorite restaurants
                and enjoy fresh, hot meals in minutes.
              </p>
            </div>

            {/* Contact Info */}
            <div
              className="space-y-2"
            >
              <div className="flex items-center gap-2 text-slate-300 text-sm">
                <Phone className="h-4 w-4" />
                <span>+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300 text-sm">
                <Mail className="h-4 w-4" />
                <span>support@{companyName.toLowerCase().replace(/\s+/g, '')}.com</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300 text-sm">
                <MapPin className="h-4 w-4" />
                <span>New York, NY</span>
              </div>
            </div>

            {/* Social Media */}
            <div
              className="flex items-center gap-4 pt-2"
            >
              <a
                href="#"
                className="transition-transform duration-200 hover:scale-110"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="transition-transform duration-200 hover:scale-110"
                aria-label="X (formerly Twitter)"
              >
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="#"
                className="transition-transform duration-200 hover:scale-110"
                aria-label="Instagram"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#paint0_linear_insta_footer)"/>
                  <rect x="6" y="6" width="12" height="12" rx="3" stroke="white" strokeWidth="1.8" fill="none" />
                  <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.8" fill="none" />
                  <circle cx="15.5" cy="8.5" r="0.9" fill="white" />
                  <defs>
                    <linearGradient id="paint0_linear_insta_footer" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#FEE140"/>
                      <stop offset="25%" stopColor="#FA709A"/>
                      <stop offset="50%" stopColor="#D6017B"/>
                      <stop offset="75%" stopColor="#8A3AB9"/>
                      <stop offset="100%" stopColor="#4C5FD7"/>
                    </linearGradient>
                  </defs>
                </svg>
              </a>
            </div>
          </div>

          {/* Company Links */}
          <div
          >
            <h3 className="font-bold text-lg mb-4 text-yellow-400">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  <Link
                    to={link.href}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div
          >
            <h3 className="font-bold text-lg mb-4 text-yellow-400">Support</h3>
            <ul className="space-y-2">
              {footerLinks.support.map((link, index) => (
                <li key={index}>
                  <Link
                    to={link.href}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* User Links */}
          <div
          >
            <h3 className="font-bold text-lg mb-4 text-yellow-400">For You</h3>
            <ul className="space-y-2">
              {footerLinks.user.map((link, index) => (
                <li key={index}>
                  <Link
                    to={link.href}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          className="border-t border-slate-600 pt-8 mt-8"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-400 text-sm text-center md:text-left">
              � {currentYear} {companyName}. All rights reserved.
            </p>
            <div className="flex items-center gap-1 text-slate-400 text-sm">
              <span>Made with</span>
              <span
              >
                <Heart className="h-4 w-4 fill-red-500 text-red-500" />
              </span>
              <span>for food lovers</span>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </footer>
  )
}

