import { Link } from "react-router-dom"
import { Facebook, Twitter, Instagram, Mail, Phone, MapPin, Heart } from "lucide-react"
import { useAppBranding } from "@common/hooks/useBusinessSettingsCache"


export default function Footer() {
  const { logoUrl, companyName } = useAppBranding("user")
  const currentYear = new Date().getFullYear()

  const footerLinks = {
    company: [
      { name: "About Us", href: "/food/user/profile/support" },
      { name: "Careers", href: "/food/user/profile/support" },
      { name: "Blog", href: "/food/user/profile/support" },
      { name: "Press", href: "/food/user/profile/support" },
    ],
    support: [
      { name: "Help Center", href: "/food/user/profile/support" },
      { name: "Contact Us", href: "/food/user/profile/support" },
      { name: "Privacy Policy", href: "/profile/privacy" },
      { name: "Terms of Service", href: "/profile/terms" },
    ],
    user: [
      { name: "My Account", href: "/user/profile" },
      { name: "My Orders", href: "/user/orders" },
      { name: "Favorites", href: "/user/profile/favorites" },
      { name: "Offers", href: "/user/offers" },
    ],
    restaurants: [
      { name: "Partner With Us", href: "/food/user/profile/support" },
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
                <span className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-red-400 bg-clip-text text-transparent">
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
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="transition-transform duration-200 hover:scale-110"
              >
                <Instagram className="h-5 w-5" />
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

