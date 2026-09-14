import React from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import {
  UtensilsCrossed,
  ShoppingBag,
  User,
  ArrowRight,
  TrendingUp,
  MapPin,
  Clock,
  ChevronRight
} from "lucide-react"

const MODULES = [
  {
    id: "food",
    title: "Food Delivery",
    description: "Delicious meals from your favorite restaurants delivered hot and fast to your doorstep.",
    icon: UtensilsCrossed,
    color: "from-red-500 to-rose-500",
    shadow: "shadow-red-500/20",
    bg: "bg-red-50",
    iconColor: "text-red-600",
    path: "/food/user",
    stats: "500+ Restaurants"
  },

  {
    id: "quick-commerce",
    title: "Quick Commerce",
    description: "Groceries, daily essentials, and more delivered in minutes. Never wait in line again.",
    icon: ShoppingBag,
    color: "from-emerald-500 to-teal-500",
    shadow: "shadow-emerald-500/20",
    bg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    path: "/quick",
    stats: "10 Min Delivery"
  }
]

export default function MasterLandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-red-500/30 overflow-hidden relative">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-white to-transparent pointer-events-none z-0" />
      <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-red-200/40 blur-[100px] rounded-full pointer-events-none z-0" />
      <div className="absolute top-[200px] left-[-100px] w-80 h-80 bg-blue-200/40 blur-[100px] rounded-full pointer-events-none z-0" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group">
            <div className="w-11 h-11 bg-gradient-to-br from-red-500 to-rose-500 rounded-xl flex items-center justify-center font-black text-2xl text-white shadow-lg shadow-red-500/20 group-hover:scale-105 transition-transform">
              A
            </div>
            <span className="text-2xl font-black tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700">BLAZE</span>
          </div>

          <button
            onClick={() => navigate("/portal")}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 px-5 py-2.5 rounded-full transition-all group shadow-sm hover:shadow-md"
          >
            <User className="w-5 h-5 text-gray-500 group-hover:text-red-500 transition-colors" />
            <span className="font-bold text-gray-700 group-hover:text-gray-900">Profile</span>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-36 pb-20 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-6 mb-20 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 bg-white shadow-sm px-5 py-2 rounded-full text-sm font-bold border border-gray-200 text-gray-700"
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-600 mr-1">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              Everything you need, in one app
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-gray-900 leading-[1.1]"
            >
              The Master <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-500 to-red-500 bg-[length:200%_auto] animate-gradient">Ecosystem</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-gray-500 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed"
            >
              Order food and get essentials delivered instantly.
              The ultimate multi-service platform designed for your lifestyle.
            </motion.p>
          </div>

          {/* Module Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-2">
            {MODULES.map((module, idx) => (
              <motion.div
                key={module.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + idx * 0.1, type: "spring", stiffness: 100 }}
                whileHover={{ y: -12, scale: 1.02 }}
                onClick={() => navigate(module.path)}
                className="group cursor-pointer"
              >
                <div className="relative h-full bg-white border border-gray-100 rounded-[32px] p-8 overflow-visible transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.04)] group-hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] flex flex-col items-center text-center">

                  {/* Floating Icon Container */}
                  <div className={`w-20 h-20 ${module.bg} rounded-3xl flex items-center justify-center mb-6 shadow-xl ${module.shadow} group-hover:scale-110 transition-transform duration-500 ease-out border border-white`}>
                    <module.icon className={`w-10 h-10 ${module.iconColor} drop-shadow-sm`} strokeWidth={2.5} />
                  </div>

                  <h3 className="text-2xl font-black mb-3 text-gray-900 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-gray-900 group-hover:to-gray-600 transition-colors">
                    {module.title}
                  </h3>

                  <p className="text-gray-500 font-medium leading-relaxed mb-8 px-2">
                    {module.description}
                  </p>

                  <div className="mt-auto w-full pt-6 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-400 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                      {module.stats}
                    </span>
                    <div className={`p-3 rounded-2xl bg-gray-50 group-hover:bg-gradient-to-br group-hover:${module.color} flex items-center justify-center group-hover:shadow-lg transition-all duration-300`}>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Features */}
          <div className="mt-32 max-w-5xl mx-auto bg-white rounded-3xl shadow-[0_8px_30px_rgba(0,0,0,0.03)] border border-gray-100 p-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="flex flex-col items-center text-center gap-4 group">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <MapPin className="w-7 h-7 text-red-500" />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2 text-gray-900">Live Tracking</h4>
                  <p className="text-gray-500 font-medium">Know exactly where your order or ride is in real-time.</p>
                </div>
              </div>
              <div className="flex flex-col items-center text-center gap-4 group">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Clock className="w-7 h-7 text-blue-500" />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2 text-gray-900">Instant Service</h4>
                  <p className="text-gray-500 font-medium">Our average response time is under 3 minutes.</p>
                </div>
              </div>
              <div className="flex flex-col items-center text-center gap-4 group">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <ShoppingBag className="w-7 h-7 text-emerald-500" />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-2 text-gray-900">Secure Payments</h4>
                  <p className="text-gray-500 font-medium">Multiple payment options with standard security.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 mt-10 border-t border-gray-200/60 text-center text-gray-500 font-medium relative z-10 w-full bg-white/50 backdrop-blur-sm">
        <p>&copy; 2026 Blaze Master Product. All rights reserved.</p>
      </footer>
    </div>
  )
}
