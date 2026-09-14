import { useEffect, useState } from "react"
import { Link, useLocation as useRouterLocation, useNavigate } from "react-router-dom"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Textarea } from "@food/components/ui/textarea"
import { Card, CardContent } from "@food/components/ui/card"
import { orderAPI, restaurantAPI, supportAPI, authAPI } from "@food/api"
import { useLocation as useFoodLocation } from "@food/hooks/useLocation"
import { useZone } from "@food/hooks/useZone"
import { customerApi } from "../../../../quickCommerce/user/services/customerApi"
import axiosInstance from "@core/api/axios"
import { toast } from "sonner"
import { ArrowLeft, Building2, HelpCircle, ShoppingBag, ChevronRight, ChevronUp, ChevronDown } from "lucide-react"

const FAQ_CACHE_KEY = 'customer_faqs_cache_v1';
const FAQ_CACHE_TTL_MS = 5 * 60 * 1000;

const FAQItem = ({ question, answer }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{question}</span>
                {isOpen ? <ChevronUp size={18} className="text-slate-700 dark:text-slate-400" /> : <ChevronDown size={18} className="text-slate-400 dark:text-slate-500" />}
            </button>
            {isOpen && (
                <div className="px-5 pb-4 text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed bg-slate-50/50 dark:bg-slate-800/50">
                    {answer}
                </div>
            )}
        </div>
    );
};

export default function Support() {
  const routerLocation = useRouterLocation()
  const navigate = useNavigate()
  const { location: currentFoodLocation } = useFoodLocation()
  const { zoneId: detectedFoodZoneId } = useZone(currentFoodLocation)
  const isSharedProfile = routerLocation.pathname.startsWith("/profile")
  const profileSource = new URLSearchParams(routerLocation.search).get("from")
  const isQuickProfile = profileSource === "quick"
  const sharedSourceQuery = profileSource ? `?from=${profileSource}` : ""
  const basePath = routerLocation.pathname.substring(0, routerLocation.pathname.lastIndexOf('/')) || '/user/profile';
  const profileHomePath = isSharedProfile ? `/profile${sharedSourceQuery}` : basePath;
  const [step, setStep] = useState("pick")
  const [orders, setOrders] = useState([])
  const [stores, setStores] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [selectedStore, setSelectedStore] = useState(null)
  const [issueType, setIssueType] = useState("")
  const [subject, setSubject] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [tickets, setTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [loadingStores, setLoadingStores] = useState(false)
  const [faqs, setFaqs] = useState([])

  useEffect(() => {
    const fetchFaqs = async () => {
        try {
            const cached = sessionStorage.getItem(FAQ_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                const isFresh = parsed?.ts && Date.now() - parsed.ts < FAQ_CACHE_TTL_MS;
                if (isFresh && Array.isArray(parsed?.items)) {
                    setFaqs(parsed.items);
                    return;
                }
            }
        } catch {}

        try {
            const response = await axiosInstance.get('/quick-commerce/public/faqs', {
                params: { audience: 'customer' }
            });
            const data = response.data?.result ?? response.data;
            const list = Array.isArray(data?.items) ? data.items : Array.isArray(data?.results) ? data.results : [];
            setFaqs(list);
            sessionStorage.setItem(
                FAQ_CACHE_KEY,
                JSON.stringify({ ts: Date.now(), items: list })
            );
        } catch (error) {
            console.error('Error fetching FAQs:', error);
        }
    };
    if (isQuickProfile) {
        fetchFaqs();
    }
  }, [isQuickProfile]);

  useEffect(() => {
    setLoadingTickets(true)

    const loadTickets = async () => {
      try {
        const res = isQuickProfile ? await customerApi.getSupportTickets() : await supportAPI.getMyTickets()
        const list = res?.data?.data?.tickets || res?.data?.tickets || res?.data?.result || []
        setTickets(Array.isArray(list) ? list : [])
      } catch (_) {
      } finally {
        setLoadingTickets(false)
      }
    }

    if (isQuickProfile) {
      loadTickets()
      return
    }

    authAPI
      .getCurrentUser()
      .catch(() => null)
      .finally(loadTickets)
  }, [isQuickProfile])

  const orderIssues = isQuickProfile
    ? ["Item missing", "Wrong item", "Damaged item", "Delivery issue", "Payment issue"]
    : ["Item missing", "Wrong item", "Not delivered", "Payment issue"]

  const storeIssues = isQuickProfile
    ? ["Bad service", "Store closed", "Wrong listing", "Other"]
    : ["Bad service", "Wrong info", "Other"]

  const resetForm = () => {
    setStep("pick")
    setSelectedOrder(null)
    setSelectedStore(null)
    setIssueType("")
    setSubject("")
    setDescription("")
  }

  const activeFoodZoneId =
    String(
      detectedFoodZoneId ||
      (typeof window !== "undefined" ? window.localStorage?.getItem("userZoneId") : "") ||
      "",
    ).trim()

  const buildQuickStoresFromOrders = (list) => {
    const uniqueStores = []
    const seen = new Set()

    list.forEach((order) => {
      const sellerId = String(order?.sellerId || order?.seller?._id || "").trim()
      const name = order?.storeName || order?.seller?.shopName || order?.seller?.name || ""
      if (!sellerId || !name || seen.has(sellerId)) return
      seen.add(sellerId)
      uniqueStores.push({
        _id: sellerId,
        id: sellerId,
        name,
        city: "Quick Commerce",
      })
    })

    setStores(uniqueStores)
    return uniqueStores
  }

  const buildQuickStoresFromProducts = (list) => {
    const uniqueStores = []
    const seen = new Set()

    list.forEach((product) => {
      const sellerId = String(product?.sellerId || product?.seller?._id || "").trim()
      const name = product?.storeName || product?.seller?.shopName || product?.seller?.name || product?.restaurantName || ""
      if (!sellerId || !name || seen.has(sellerId)) return
      seen.add(sellerId)
      uniqueStores.push({
        _id: sellerId,
        id: sellerId,
        name,
        city: "Quick Commerce",
      })
    })

    setStores(uniqueStores)
    return uniqueStores
  }

  const fetchOrders = async () => {
    try {
      const res = isQuickProfile
        ? await customerApi.getOrders({ limit: 20, page: 1 })
        : await orderAPI.getOrders({ limit: 10, page: 1 })
      const list = res?.data?.data?.orders || res?.data?.orders || res?.data?.result || res?.data?.results || []
      setOrders(Array.isArray(list) ? list : [])
      if (isQuickProfile) {
        buildQuickStoresFromOrders(Array.isArray(list) ? list : [])
      }
      return Array.isArray(list) ? list : []
    } catch {
      toast.error(isQuickProfile ? "Failed to load quick orders" : "Failed to load orders")
      return []
    }
  }

  const fetchStores = async () => {
    setLoadingStores(true)
    if (isQuickProfile) {
      const list = orders.length ? orders : await fetchOrders()
      const orderStores = buildQuickStoresFromOrders(list)
      if (orderStores.length > 0) {
        setLoadingStores(false)
        return
      }

      try {
        const res = await customerApi.getProducts({ limit: 100 })
        const products = res?.data?.result?.items || res?.data?.results || []
        buildQuickStoresFromProducts(Array.isArray(products) ? products : [])
      } catch {
        toast.error("Failed to load stores")
      } finally {
        setLoadingStores(false)
      }
      return
    }

    try {
      const params = { limit: 100, page: 1, _ts: Date.now() }
      if (activeFoodZoneId) {
        params.zoneId = activeFoodZoneId
      }
      const res = await restaurantAPI.getRestaurants(params, { noCache: true })
      const list = res?.data?.data?.restaurants || res?.data?.restaurants || []
      setStores(Array.isArray(list) ? list : [])
    } catch {
      toast.error("Failed to load restaurants")
    } finally {
      setLoadingStores(false)
    }
  }

  const handlePick = async (type) => {
    if (type === "order") {
      await fetchOrders()
      setStep("choose_order")
      return
    }

    if (type === "store") {
      await fetchStores()
      setStep("choose_store")
      return
    }

    setStep("other_form")
  }

  const submitTicket = async (payload) => {
    setSubmitting(true)
    try {
      const res = isQuickProfile
        ? await customerApi.createSupportTicket(payload)
        : await supportAPI.createTicket(payload)
      const data = res?.data
      if (!data?.success) throw new Error(data?.message || "Failed")
      toast.success("Ticket created")
      setTickets((prev) => [data?.data?.ticket, ...prev])
      resetForm()
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Failed to create ticket")
    } finally {
      setSubmitting(false)
    }
  }

  const statusClasses = (status) => {
    const s = String(status || "").toLowerCase()
    if (s === "resolved" || s === "closed") return "bg-green-100 text-green-700"
    if (s === "open") return "bg-amber-100 text-amber-700"
    return "bg-slate-100 text-slate-700"
  }

  const getOrderLabel = (order) => {
    if (isQuickProfile) {
      const storeName = order?.storeName || order?.seller?.shopName || order?.seller?.name || "Quick order"
      const dateValue = order?.createdAt || order?.date
      const dateLabel = dateValue ? new Date(dateValue).toLocaleDateString() : "No date"
      const amount = order?.pricing?.total ?? order?.total ?? 0
      const orderNumber = order?.orderId || order?.orderNumber || String(order?._id || order?.id || "").slice(-6)
      return `${storeName} - ${dateLabel} - Rs${amount} - ${orderNumber}`
    }

    const restaurantName = order?.restaurantName || order?.restaurant?.restaurantName || "Restaurant"
    const dateValue = order?.createdAt || order?.date
    const dateLabel = dateValue ? new Date(dateValue).toLocaleDateString() : "No date"
    const amount = order?.pricing?.total ?? order?.total ?? 0
    return `${restaurantName} - ${dateLabel} - Rs${amount}`
  }

  const getStoreLabel = (store) => {
    const name = store?.restaurantName || store?.name || (isQuickProfile ? "Store" : "Restaurant")
    const location = store?.city || store?.area || ""
    return `${name}${location ? ` - ${location}` : ""}`
  }

  const OrderList = () => {
    if (orders.length === 0) {
      return (
        <p className="text-sm text-slate-500">{isQuickProfile ? "No quick orders found" : "No recent orders found"}</p>
      )
    }

    return (
      <div className="space-y-2">
        <select
          value={String(selectedOrder?._id || selectedOrder?.id || "")}
          onChange={(e) => {
            const nextOrder = orders.find(
              (order) => String(order._id || order.id || "") === String(e.target.value || ""),
            )
            if (!nextOrder) return
            setSelectedOrder(nextOrder)
            setStep("order_issue")
          }}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-slate-400 focus:bg-white"
        >
          <option value="">Select order</option>
          {orders.map((order) => (
            <option key={order._id || order.id} value={String(order._id || order.id || "")}>
              {getOrderLabel(order)}
            </option>
          ))}
        </select>
      </div>
    )
  }

  const StoreList = () => {
    if (loadingStores) {
      return <p className="text-sm text-slate-500">Loading {isQuickProfile ? "stores" : "restaurants"}...</p>
    }

    if (stores.length === 0) {
      return (
        <p className="text-sm text-slate-500">{isQuickProfile ? "No stores found" : "No restaurants found"}</p>
      )
    }

    return (
      <div className="space-y-2">
        <select
          value={String(selectedStore?._id || selectedStore?.id || "")}
          onChange={(e) => {
            const nextStore = stores.find(
              (store) => String(store._id || store.id || "") === String(e.target.value || ""),
            )
            if (!nextStore) return
            setSelectedStore(nextStore)
            setStep("store_issue")
          }}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm font-medium text-slate-900 outline-none transition-colors focus:border-slate-400 focus:bg-white"
        >
          <option value="">
            {isQuickProfile ? "Select store" : "Select restaurant"}
          </option>
          {stores.map((store) => (
            <option key={store._id || store.id} value={String(store._id || store.id || "")}>
              {store?.restaurantName || store?.name || (isQuickProfile ? "Store" : "Restaurant")}
            </option>
          ))}
        </select>
      </div>
    )
  }

  const TicketList = () => (
    <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-slate-200 dark:border-gray-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">My Tickets</h3>
          <span className="text-xs font-medium px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {tickets.length}
          </span>
        </div>

        {loadingTickets ? (
          <p className="text-sm text-slate-500">Loading tickets...</p>
        ) : tickets.length === 0 ? (
          <p className="text-sm text-slate-500">No tickets yet</p>
        ) : (
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <div key={ticket._id || ticket.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-[#171717]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      #{String(ticket._id || ticket.id).slice(-6)} - {ticket.type === "seller" ? "store" : ticket.type} - {ticket.issueType}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(ticket.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${statusClasses(ticket.status)}`}>
                    {ticket.status}
                  </span>
                </div>
                {ticket.adminResponse ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">Reply: {ticket.adminResponse}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 sm:py-6 md:py-8 pb-20">
        <div className="mb-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 p-0"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate(profileHomePath);
              }
            }}
          >
            <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
          </Button>
        </div>

        <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 mb-3">
          <CardContent className="p-4">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Help & Support</h1>
            <p className="text-sm text-slate-500 mt-1">Raise a support ticket and track updates in one place.</p>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-sm border border-slate-200 dark:border-gray-800 mb-3">
          <CardContent className="p-5 space-y-4">
            {step === "pick" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button onClick={() => handlePick("order")} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-center justify-between">
                    <ShoppingBag className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-3 font-semibold text-slate-900 dark:text-white">Order Issue</p>
                  <p className="text-xs text-slate-500 mt-1">Missing item, wrong item, delivery issue</p>
                </button>

                <button onClick={() => handlePick("store")} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-center justify-between">
                    <Building2 className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-3 font-semibold text-slate-900 dark:text-white">{isQuickProfile ? "Store Issue" : "Restaurant Issue"}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {isQuickProfile ? "Store service, listing info, fulfillment report" : "Service, listing info, behavior report"}
                  </p>
                </button>

                <button onClick={() => handlePick("other")} className="w-full border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <div className="flex items-center justify-between">
                    <HelpCircle className="h-5 w-5 text-slate-700 dark:text-slate-200" />
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <p className="mt-3 font-semibold text-slate-900 dark:text-white">Other Issue</p>
                  <p className="text-xs text-slate-500 mt-1">Account, app, payment or general query</p>
                </button>
              </div>
            )}

            {step === "choose_order" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">Select an order</h3>
                <OrderList />
                <Button variant="outline" onClick={resetForm}>Back</Button>
              </div>
            )}

            {step === "order_issue" && selectedOrder && (
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">Issue type</h3>
                <div className="grid grid-cols-2 gap-2">
                  {orderIssues.map((item) => (
                    <Button key={item} variant={issueType === item ? "default" : "outline"} onClick={() => setIssueType(item)}>
                      {item}
                    </Button>
                  ))}
                </div>
                <Textarea placeholder="Describe the issue (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
                <div className="flex gap-2">
                  <Button
                    onClick={() => submitTicket({ type: "order", orderId: selectedOrder._id || selectedOrder.id, issueType, description })}
                    disabled={!issueType || submitting}
                  >
                    {submitting ? "Submitting..." : "Submit Ticket"}
                  </Button>
                  <Button variant="outline" onClick={resetForm}>Cancel</Button>
                </div>
              </div>
            )}

            {step === "choose_store" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{isQuickProfile ? "Select a store" : "Select a restaurant"}</h3>
                  {!isQuickProfile && activeFoodZoneId ? (
                    <p className="text-xs text-slate-500">Showing restaurants for your current service zone.</p>
                  ) : null}
                </div>
                <StoreList />
                <Button variant="outline" onClick={resetForm}>Back</Button>
              </div>
            )}

            {step === "store_issue" && selectedStore && (
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">Issue type</h3>
                <div className="grid grid-cols-2 gap-2">
                  {storeIssues.map((item) => (
                    <Button key={item} variant={issueType === item ? "default" : "outline"} onClick={() => setIssueType(item)}>
                      {item}
                    </Button>
                  ))}
                </div>
                <Textarea placeholder="Describe the issue (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      submitTicket(
                        isQuickProfile
                          ? { type: "seller", sellerId: selectedStore._id || selectedStore.id, issueType, description }
                          : { type: "restaurant", restaurantId: selectedStore._id || selectedStore.id, issueType, description },
                      )
                    }
                    disabled={!issueType || submitting}
                  >
                    {submitting ? "Submitting..." : "Submit Ticket"}
                  </Button>
                  <Button variant="outline" onClick={resetForm}>Cancel</Button>
                </div>
              </div>
            )}

            {step === "other_form" && (
              <div className="space-y-3">
                <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                <Textarea placeholder="Describe your issue" value={description} onChange={(e) => setDescription(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={() => submitTicket({ type: "other", issueType: subject || "Other", description })} disabled={!subject || submitting}>
                    {submitting ? "Submitting..." : "Submit Ticket"}
                  </Button>
                  <Button variant="outline" onClick={resetForm}>Cancel</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <TicketList />

        {isQuickProfile && (
            <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 mt-4">
                <CardContent className="p-4">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Frequently Asked Questions</h3>
                    <div className="space-y-3">
                        {faqs.length > 0 ? (
                            faqs.map((faq) => (
                                <FAQItem
                                    key={faq._id}
                                    question={faq.question}
                                    answer={faq.answer}
                                />
                            ))
                        ) : (
                            <div className="bg-slate-50 dark:bg-[#171717] rounded-xl border border-slate-100 dark:border-slate-800 px-5 py-4 text-sm text-slate-400 text-center">
                                No FAQs available right now.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        )}
      </div>
    </AnimatedPage>
  )
}
