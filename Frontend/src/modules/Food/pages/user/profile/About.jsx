import { Link, useLocation, useNavigate } from "react-router-dom"
import { useState, useEffect } from "react"
import { ArrowLeft, ArrowRight, Heart, Users, Shield, Clock, Star, Award, FileText, Lock, Loader2, Receipt, Truck, XCircle } from "lucide-react"
import { motion } from "framer-motion"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import { Card, CardContent } from "@food/components/ui/card"

import api from "@food/api"
import { API_ENDPOINTS } from "@food/api/config"
import { useCompanyName } from "@food/hooks/useCompanyName"
import { getAppLogo, subscribeBusinessSettings } from "@common/utils/businessSettings"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


// Icon mapping
const iconMap = {
  Heart,
  Users,
  Shield,
  Clock,
  Star,
  Award
}

export default function About() {
  const location = useLocation()
  const navigate = useNavigate()
  const companyName = useCompanyName()
  const isSharedProfile = location.pathname.startsWith("/profile")
  const profileSource = new URLSearchParams(location.search).get("from")
  const sharedSourceQuery = profileSource ? `?from=${profileSource}` : ""
  const basePath = location.pathname.substring(0, location.pathname.lastIndexOf('/')) || '/user/profile';
  const profileHomePath = isSharedProfile ? `/profile${sharedSourceQuery}` : basePath;
  const termsPath = isSharedProfile ? `/profile/terms${sharedSourceQuery}` : `${basePath}/terms`;
  const privacyPath = isSharedProfile ? `/profile/privacy${sharedSourceQuery}` : `${basePath}/privacy`;
  const refundPath = isSharedProfile ? `/profile/refund${sharedSourceQuery}` : `${basePath}/refund`;
  const shippingPath = isSharedProfile ? `/profile/shipping${sharedSourceQuery}` : `${basePath}/shipping`;
  const cancellationPath = isSharedProfile ? `/profile/cancellation${sharedSourceQuery}` : `${basePath}/cancellation`;
  const [loading, setLoading] = useState(true)
  const [logoUrl, setLogoUrl] = useState(null)
  const [aboutData, setAboutData] = useState({
    appName: '',
    version: '',
    description: '',
    logo: '',
    features: [],
    stats: []
  })

  useEffect(() => {
    fetchAboutData()

    const apply = () => {
      const userLogo = getAppLogo("user")
      if (userLogo) setLogoUrl(userLogo)
    }
    apply()
    return subscribeBusinessSettings(apply)
  }, [])

  const fetchAboutData = async () => {
    try {
      setLoading(true)
      const response = await api.get(`${API_ENDPOINTS.ADMIN.ABOUT_PUBLIC}?role=all`)
      if (response.data.success) {
        setAboutData(response.data.data || {})
      }
    } catch (error) {
      debugError('Error fetching about data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <AnimatedPage className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-[#0a0a0a] dark:to-[#1a1a1a]">
        <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-600 dark:text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-[#0a0a0a] dark:to-[#1a1a1a]">
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
          <Button onClick={() => navigate(-1)} variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 p-0 hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="h-5 w-5 md:h-6 md:w-6 text-gray-900 dark:text-white" />
          </Button>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">About</h1>
        </div>

        {/* App Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-lg border-0 dark:border-gray-800 mb-6 overflow-hidden">
            <div className="bg-gradient-to-br from-red-50 to-amber-50 dark:from-red-900/20 dark:to-amber-900/20 p-8 md:p-10 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="flex justify-center mb-6"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-[#FF0000] rounded-full blur-2xl opacity-30 animate-pulse" />
                  <div className="relative bg-white dark:bg-gray-800 rounded-full p-4 md:p-6 shadow-xl flex items-center justify-center min-w-[80px] min-h-[80px]">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${companyName || aboutData.appName} Logo`}
                        className="h-16 w-16 md:h-20 md:w-20 object-contain rounded-full"
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    ) : (
                      <span className="text-2xl font-bold text-[#FF0000]">
                        {(companyName || aboutData.appName).charAt(0)}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-2"
              >
                {aboutData.appName || companyName || "About"}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-gray-600 dark:text-gray-400 text-sm md:text-base mb-4"
              >
                {aboutData.version ? `Version ${aboutData.version}` : " "}
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-gray-700 dark:text-gray-300 leading-relaxed text-base md:text-lg max-w-2xl mx-auto"
              >
                {aboutData.description
                  ? aboutData.description
                  : "This page will appear once the admin adds About content."}
              </motion.p>
            </div>
          </Card>
        </motion.div>

        {/* Features Grid */}
        {aboutData.features && aboutData.features.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6"
          >
            {aboutData.features.map((feature, index) => {
              const IconComponent = iconMap[feature.icon] || Heart
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + index * 0.1, duration: 0.3 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-md border-0 dark:border-gray-800 hover:shadow-xl transition-shadow duration-300 h-full">
                    <CardContent className="p-5 md:p-6">
                      <div className="flex items-start gap-4">
                        <div className={`${feature.bgColor} rounded-xl p-3 flex-shrink-0`}>
                          <IconComponent className={`h-6 w-6 md:h-7 md:w-7 ${feature.color}`} />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                            {feature.title}
                          </h3>
                          <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                            {feature.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {/* Legal Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        >
          <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-md border-0 dark:border-gray-800">
            <CardContent className="p-5 md:p-6">
              <h3 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                Legal Information
              </h3>
              <div className="space-y-3">
                <Link
                  to={termsPath}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                >
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                    <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-900 dark:text-white group-hover:text-[#FF0000] dark:group-hover:text-[#F97316] transition-colors">
                      Terms and Conditions
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-500">
                      Read our terms and conditions
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                </Link>

                <Link
                  to={privacyPath}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                >
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                    <Lock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-900 dark:text-white group-hover:text-[#FF0000] dark:group-hover:text-[#F97316] transition-colors">
                      Privacy Policy
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-500">
                      Learn how we protect your data
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                </Link>

                <Link
                  to={refundPath}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                >
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                    <Receipt className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-900 dark:text-white group-hover:text-[#FF0000] dark:group-hover:text-[#F97316] transition-colors">
                      Refund Policy
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-500">
                      Read our refund terms and conditions
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                </Link>

                <Link
                  to={shippingPath}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                >
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                    <Truck className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-900 dark:text-white group-hover:text-[#FF0000] dark:group-hover:text-[#F97316] transition-colors">
                      Shipping Policy
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-500">
                      Learn about our shipping terms
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                </Link>

                <Link
                  to={cancellationPath}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                >
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 group-hover:bg-gray-200 dark:group-hover:bg-gray-700 transition-colors">
                    <XCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-base font-medium text-gray-900 dark:text-white group-hover:text-[#FF0000] dark:group-hover:text-[#F97316] transition-colors">
                      Cancellation Policy
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-500">
                      Read our cancellation terms and conditions
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.5 }}
          className="text-center mt-8 mb-4"
        >
          <p className="text-sm text-gray-500 dark:text-gray-500">
            � {new Date().getFullYear()} {companyName}. All rights reserved.
          </p>
        </motion.div>
      </div>
    </AnimatedPage>
  )
}


