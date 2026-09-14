import { useState, useRef, useEffect, useMemo } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ChevronDown, ChevronUp, Download, Mail, X, Info } from "lucide-react"

export default function FinanceDetailsPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const location = useLocation()
  const financeData = location.state?.financeData || null
  const restaurantData = location.state?.restaurantData || null
  
  const [activeTab, setActiveTab] = useState("summary")
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showDownloadPopup, setShowDownloadPopup] = useState(false)
  const [showEmailPopup, setShowEmailPopup] = useState(false)
  const [expandedSections, setExpandedSections] = useState({
    netOrderValue: true,
    additions: true,
    orderLevelDeductions: true,
    taxDeductions: true,
    investmentsInGrowth: true,
  })
  const topTabBarRef = useRef(null)

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "orders", label: "Orders" },
    { id: "expenses", label: "Expenses" },
  ]

  const scrollToTopTab = (index) => {
    if (topTabBarRef.current) {
      const buttons = topTabBarRef.current.querySelectorAll("button")
      if (buttons[index]) {
        const button = buttons[index]
        const container = topTabBarRef.current
        const buttonLeft = button.offsetLeft
        const buttonWidth = button.offsetWidth
        const containerWidth = container.offsetWidth
        const scrollLeft = buttonLeft - containerWidth / 2 + buttonWidth / 2

        container.scrollTo({
          left: scrollLeft,
          behavior: "smooth",
        })
      }
    }
  }

  useEffect(() => {
    const index = tabs.findIndex((tab) => tab.id === activeTab)
    if (index >= 0) {
      requestAnimationFrame(() => scrollToTopTab(index))
    }
  }, [activeTab])

  const handleDownload = () => {
    setShowDownloadPopup(true)
    // In a real app, this would trigger PDF download
    setTimeout(() => {
      setShowDownloadPopup(false)
    }, 2000)
  }

  const handleEmail = () => {
    setShowEmailPopup(true)
    // In a real app, this would send email
    setTimeout(() => {
      setShowEmailPopup(false)
    }, 2000)
  }

  // Settlement data bound to finance API — do not invent TDS/deduction rows.
  const settlementData = useMemo(() => {
    const cycle = financeData?.currentCycle || {};
    const summary = financeData?.invoiceSummary || {};
    const taxes = Number(summary.taxes || 0);
    const subtotal = Number(summary.subtotal || 0);
    const gross = Number(summary.gross || subtotal + taxes);

    return {
      totalOrders: cycle.totalOrders || 0,
      netOrderValue: {
        itemSubtotal: subtotal,
        totalGSTCollected: taxes,
        restaurantDiscountPromos: 0,
        restaurantDiscountOthers: 0,
        total: gross || subtotal,
      },
      additions: {
        tds194H: 0,
        tds194C: 0,
        total: 0,
      },
      orderLevelDeductions: {
        total: 0,
      },
      taxDeductions: {
        gstOnServiceFees: 0,
        tds194O: 0,
        gstPaidByZomato: 0,
        total: taxes,
      },
      investmentsInGrowth: {
        onlineOrderingAds: 0,
        total: 0,
      },
      estimatedPayout: Number(cycle.estimatedPayout || financeData?.earnings?.availableBalance || 0),
      start: cycle.start?.day || "15",
      end: cycle.end?.day || "21",
      month: cycle.start?.month || "Dec",
      year: cycle.start?.year || "25",
    }
  }, [financeData])

  const estimatedPayout = settlementData.estimatedPayout;

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <div className="sticky bg-white top-0 z-40 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">
              {restaurantData?.name || "Your Restaurant"}
            </h1>
            <p className="text-xs text-gray-600 mt-0.5">
              ID: {restaurantData?.restaurantId || "N/A"} • {restaurantData?.address || "Location"}
            </p>
          </div>
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <div className="sticky top-[73px] z-30 bg-gray-100 pb-2">
        <div
          ref={topTabBarRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide bg-transparent rounded-full px-3 py-2 mt-2"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <style>{`
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <motion.button
                key={tab.id}
                onClick={() => {
                  if (!isTransitioning) {
                    setIsTransitioning(true)
                    setActiveTab(tab.id)
                    setTimeout(() => setIsTransitioning(false), 300)
                  }
                }}
                className={`shrink-0 px-6 py-3.5 rounded-full font-medium text-sm whitespace-nowrap relative overflow-hidden ${
                  isActive ? 'text-white' : 'bg-white text-black'
                }`}
                animate={{
                  scale: isActive ? 1.05 : 1,
                  opacity: isActive ? 1 : 0.7,
                }}
                transition={{
                  duration: 0.3,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
                whileTap={{ scale: 0.95 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="financeTopTabActive"
                    className="absolute inset-0 bg-black rounded-full -z-10"
                    initial={false}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                    }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === "summary" && (
              <div className="space-y-6">
                {/* Estimated Payout Card */}
                <div className="bg-white rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Active Earnings</p>
                      <p className="text-2xl font-bold text-gray-900 mb-1">
                        ₹{estimatedPayout.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-gray-600">from {settlementData.start} - {settlementData.end} {settlementData.month}'{settlementData.year}</p>
                      <p className="text-xs text-gray-600 mt-1">Payout date: -</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Payout for</p>
                      <p className="text-sm font-semibold text-gray-900">{settlementData.start} - {settlementData.end} {settlementData.month}'{settlementData.year}</p>
                    </div>
                  </div>
                </div>

                {/* Settlement Summary */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-bold text-gray-900">Settlement summary</h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleDownload}
                        className="p-3 bg-white rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        <Download className="w-4 h-4 text-gray-700" />
                      </button>
                      <button
                        onClick={handleEmail}
                        className="p-3 bg-white rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        <Mail className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg overflow-hidden">
                    {/* Total Orders */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-900">Total orders</span>
                        <span className="text-sm font-semibold text-gray-900">{settlementData.totalOrders}</span>
                      </div>
                    </div>

                    {/* Net order value (A) */}
                    <div className="border-b border-gray-100">
                      <button
                        onClick={() => toggleSection('netOrderValue')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">Net order value (A)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">
                            ₹{(settlementData.netOrderValue?.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          {expandedSections.netOrderValue ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      </button>
                      <AnimatePresence>
                        {expandedSections.netOrderValue && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 space-y-2 border-t border-dashed border-gray-200">
                              <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-gray-700">Item subtotal</span>
                                  <Info className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  ₹{settlementData.netOrderValue.itemSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-t border-dashed border-gray-200">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-gray-700">Total GST collected from customers</span>
                                  <Info className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  ₹{(settlementData.netOrderValue?.totalGSTCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-t border-dashed border-gray-200">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-gray-700">Restaurant discount (Promos)</span>
                                  <Info className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  ₹{settlementData.netOrderValue.restaurantDiscountPromos.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-t border-dashed border-gray-200">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-gray-700">Restaurant discount (Flat offs, Freebies, Gold, relisted orders and others)</span>
                                  <Info className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  ₹{(settlementData.netOrderValue?.restaurantDiscountOthers || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Additions (B) */}
                    <div className="border-b border-gray-100">
                      <button
                        onClick={() => toggleSection('additions')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">Additions (B)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">
                            ₹{settlementData.additions.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          {expandedSections.additions ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      </button>
                      <AnimatePresence>
                        {expandedSections.additions && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 space-y-2 border-t border-dashed border-gray-200">
                              <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-gray-700">TDS 194H</span>
                                  <Info className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  ₹{(settlementData.additions?.tds194H || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-t border-dashed border-gray-200">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-gray-700">TDS 194C</span>
                                  <Info className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  ₹{settlementData.additions.tds194C.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Order level deductions (C) */}
                    <div className="border-b border-gray-100">
                      <button
                        onClick={() => toggleSection('orderLevelDeductions')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">Order level deductions (C)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">
                            ₹{(settlementData.orderLevelDeductions?.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          {expandedSections.orderLevelDeductions ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      </button>
                    </div>

                    {/* Tax deductions (D) */}
                    <div className="border-b border-gray-100">
                      <button
                        onClick={() => toggleSection('taxDeductions')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">Tax deductions (D)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">
                            ₹{settlementData.taxDeductions.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          {expandedSections.taxDeductions ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      </button>
                      <AnimatePresence>
                        {expandedSections.taxDeductions && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 space-y-2 border-t border-dashed border-gray-200">
                              <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-gray-700">GST on service and payment mechanism fees @18%</span>
                                  <Info className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  ₹{(settlementData.taxDeductions?.gstOnServiceFees || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-t border-dashed border-gray-200">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-gray-700">TDS 194O</span>
                                  <Info className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  ₹{settlementData.taxDeductions.tds194O.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex items-center justify-between py-2 border-t border-dashed border-gray-200">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-gray-700">GST paid by Zomato on behalf of the restaurant u/s 9(5) of GST</span>
                                  <Info className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  ₹{(settlementData.taxDeductions?.gstPaidByZomato || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Investments in growth (E) */}
                    <div className="border-b border-gray-100">
                      <button
                        onClick={() => toggleSection('investmentsInGrowth')}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">Investments in growth (E)</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900">
                            ₹{settlementData.investmentsInGrowth.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                          {expandedSections.investmentsInGrowth ? (
                            <ChevronUp className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      </button>
                      <AnimatePresence>
                        {expandedSections.investmentsInGrowth && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-3 space-y-2 border-t border-dashed border-gray-200">
                              <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm text-gray-700">Online ordering ads</span>
                                  <Info className="w-3.5 h-3.5 text-gray-400" />
                                </div>
                                <span className="text-sm font-medium text-gray-900">
                                  ₹{(settlementData.investmentsInGrowth?.onlineOrderingAds || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Est. payout */}
                    <div className="px-4 py-3 border-t-2 border-gray-900 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900">Est. payout (A + B - C - D - E)</span>
                        <span className="text-sm font-bold text-gray-900">
                          ₹{estimatedPayout.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "orders" && (
              <div className=" rounded-lg p-4">
                <p className="text-sm text-gray-800 text-center py-8">
                  Orders data will be displayed here
                </p>
              </div>
            )}

            {activeTab === "expenses" && (
              <div className=" rounded-lg p-4">
                <p className="text-sm text-gray-800 text-center py-8">
                  Expenses data will be displayed here
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Download Popup */}
      <AnimatePresence>
        {showDownloadPopup && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDownloadPopup(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Download Report</h2>
                <button
                  onClick={() => setShowDownloadPopup(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Your settlement report is being downloaded as PDF...
              </p>
              <button
                onClick={() => setShowDownloadPopup(false)}
                className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Email Popup */}
      <AnimatePresence>
        {showEmailPopup && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEmailPopup(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Email Report</h2>
                <button
                  onClick={() => setShowEmailPopup(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Your settlement report has been sent to your registered email address.
              </p>
              <button
                onClick={() => setShowEmailPopup(false)}
                className="w-full py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
