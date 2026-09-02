import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import api, { uploadAPI } from "@food/api"
import { API_ENDPOINTS } from "@food/api/config"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Textarea } from "@food/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@food/components/ui/card"
import { Label } from "@food/components/ui/label"
import { 
  TrendingUp, 
  Plus, 
  X, 
  Save, 
  Trash2, 
  HelpCircle, 
  Settings,
  UtensilsCrossed,
  Truck,
  Users,
  ShieldAlert
} from "lucide-react"

export default function LoginGrowthSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("restaurant")

  const [restaurantData, setRestaurantData] = useState({
    headline: "",
    subheadline: "",
    benefits: [],
    savingsExample: {
      orderValue: 500,
      traditionalCommission: "",
      itzoCommission: "",
      keepsRevenueText: ""
    },
    additionalMessaging: {
      monthlyProfit: "",
      yearlyProfit: ""
    },
    consultingServices: [],
    benefitImage1: "",
    benefitImage2: ""
  })

  const restFileInput1Ref = useRef(null)
  const restFileInput2Ref = useRef(null)
  const [restBenefitImage1Preview, setRestBenefitImage1Preview] = useState(null)
  const [restBenefitImage2Preview, setRestBenefitImage2Preview] = useState(null)
  const [restBenefitImage1File, setRestBenefitImage1File] = useState(null)
  const [restBenefitImage2File, setRestBenefitImage2File] = useState(null)

  const [deliveryData, setDeliveryData] = useState({
    headline: "",
    subheadline: "",
    benefits: [],
    partnerWelfare: [],
    operationalBenefits: [],
    driverMarketingBanner: "",
    ctaText: "",
    benefitImage1: "",
    benefitImage2: ""
  })

  const delFileInput1Ref = useRef(null)
  const delFileInput2Ref = useRef(null)
  const [delBenefitImage1Preview, setDelBenefitImage1Preview] = useState(null)
  const [delBenefitImage2Preview, setDelBenefitImage2Preview] = useState(null)
  const [delBenefitImage1File, setDelBenefitImage1File] = useState(null)
  const [delBenefitImage2File, setDelBenefitImage2File] = useState(null)

  const fileInput1Ref = useRef(null)
  const fileInput2Ref = useRef(null)
  const [benefitImage1Preview, setBenefitImage1Preview] = useState(null)
  const [benefitImage2Preview, setBenefitImage2Preview] = useState(null)
  const [benefitImage1File, setBenefitImage1File] = useState(null)
  const [benefitImage2File, setBenefitImage2File] = useState(null)

  const [userData, setUserData] = useState({
    headline: "",
    subheadline: "",
    benefits: [],
    comparison: {
      traditionalAppsText: "",
      itzoFoodText: ""
    },
    keyAdvantages: [],
    privacyMessage: "",
    benefitImage1: "",
    benefitImage2: ""
  })

  useEffect(() => {
    fetchPageData()
  }, [])

  const fetchPageData = async () => {
    try {
      setLoading(true)
      const response = await api.get(API_ENDPOINTS.ADMIN.LOGIN_GROWTH, { contextModule: "admin" })
      if (response.data.success) {
        const data = response.data.data
        if (data) {
          if (data.restaurant) {
            setRestaurantData({
              headline: data.restaurant.headline || "",
              subheadline: data.restaurant.subheadline || "",
              benefits: Array.isArray(data.restaurant.benefits) ? data.restaurant.benefits : [],
              savingsExample: {
                orderValue: data.restaurant.savingsExample?.orderValue ?? 500,
                traditionalCommission: data.restaurant.savingsExample?.traditionalCommission || "",
                itzoCommission: data.restaurant.savingsExample?.itzoCommission || "",
                keepsRevenueText: data.restaurant.savingsExample?.keepsRevenueText || ""
              },
              additionalMessaging: {
                monthlyProfit: data.restaurant.additionalMessaging?.monthlyProfit || "",
                yearlyProfit: data.restaurant.additionalMessaging?.yearlyProfit || ""
              },
              consultingServices: Array.isArray(data.restaurant.consultingServices) ? data.restaurant.consultingServices : [],
              benefitImage1: data.restaurant.benefitImage1 || "",
              benefitImage2: data.restaurant.benefitImage2 || ""
            })
            if (data.restaurant.benefitImage1) setRestBenefitImage1Preview(data.restaurant.benefitImage1)
            if (data.restaurant.benefitImage2) setRestBenefitImage2Preview(data.restaurant.benefitImage2)
          }
          if (data.delivery) {
            setDeliveryData({
              headline: data.delivery.headline || "",
              subheadline: data.delivery.subheadline || "",
              benefits: Array.isArray(data.delivery.benefits) ? data.delivery.benefits : [],
              partnerWelfare: Array.isArray(data.delivery.partnerWelfare) ? data.delivery.partnerWelfare : [],
              operationalBenefits: Array.isArray(data.delivery.operationalBenefits) ? data.delivery.operationalBenefits : [],
              driverMarketingBanner: data.delivery.driverMarketingBanner || "",
              ctaText: data.delivery.ctaText || "",
              benefitImage1: data.delivery.benefitImage1 || "",
              benefitImage2: data.delivery.benefitImage2 || ""
            })
            if (data.delivery.benefitImage1) setDelBenefitImage1Preview(data.delivery.benefitImage1)
            if (data.delivery.benefitImage2) setDelBenefitImage2Preview(data.delivery.benefitImage2)
          }
          if (data.user) {
            setUserData({
              headline: data.user.headline || "",
              subheadline: data.user.subheadline || "",
              benefits: Array.isArray(data.user.benefits) ? data.user.benefits : [],
              comparison: {
                traditionalAppsText: data.user.comparison?.traditionalAppsText || "",
                itzoFoodText: data.user.comparison?.itzoFoodText || ""
              },
              keyAdvantages: Array.isArray(data.user.keyAdvantages) ? data.user.keyAdvantages : [],
              privacyMessage: data.user.privacyMessage || "",
              benefitImage1: data.user.benefitImage1 || "",
              benefitImage2: data.user.benefitImage2 || ""
            })
            if (data.user.benefitImage1) setBenefitImage1Preview(data.user.benefitImage1)
            if (data.user.benefitImage2) setBenefitImage2Preview(data.user.benefitImage2)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching login growth data:', error)
      toast.error('Failed to load login growth settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)

      let restImg1Url = restaurantData.benefitImage1 || ""
      let restImg2Url = restaurantData.benefitImage2 || ""

      if (restBenefitImage1File) {
        const res = await uploadAPI.uploadMedia(restBenefitImage1File, { folder: "business/growth" })
        if (res.data.success) {
          restImg1Url = res.data.data.url
        }
      }

      if (restBenefitImage2File) {
        const res = await uploadAPI.uploadMedia(restBenefitImage2File, { folder: "business/growth" })
        if (res.data.success) {
          restImg2Url = res.data.data.url
        }
      }

      const updatedRestaurantData = {
        ...restaurantData,
        benefitImage1: restImg1Url,
        benefitImage2: restImg2Url
      }

      let img1Url = userData.benefitImage1 || ""
      let img2Url = userData.benefitImage2 || ""

      if (benefitImage1File) {
        const res = await uploadAPI.uploadMedia(benefitImage1File, { folder: "business/growth" })
        if (res.data.success) {
          img1Url = res.data.data.url
        }
      }

      if (benefitImage2File) {
        const res = await uploadAPI.uploadMedia(benefitImage2File, { folder: "business/growth" })
        if (res.data.success) {
          img2Url = res.data.data.url
        }
      }

      const updatedUserData = {
        ...userData,
        benefitImage1: img1Url,
        benefitImage2: img2Url
      }

      let delImg1Url = deliveryData.benefitImage1 || ""
      let delImg2Url = deliveryData.benefitImage2 || ""

      if (delBenefitImage1File) {
        const res = await uploadAPI.uploadMedia(delBenefitImage1File, { folder: "business/growth" })
        if (res.data.success) {
          delImg1Url = res.data.data.url
        }
      }

      if (delBenefitImage2File) {
        const res = await uploadAPI.uploadMedia(delBenefitImage2File, { folder: "business/growth" })
        if (res.data.success) {
          delImg2Url = res.data.data.url
        }
      }

      const updatedDeliveryData = {
        ...deliveryData,
        benefitImage1: delImg1Url,
        benefitImage2: delImg2Url
      }

      const response = await api.put(
        API_ENDPOINTS.ADMIN.LOGIN_GROWTH,
        {
          restaurant: updatedRestaurantData,
          delivery: updatedDeliveryData,
          user: updatedUserData,
          role: "all"
        },
        { contextModule: "admin" }
      )
      if (response.data.success) {
        toast.success('Login growth settings updated successfully')
        setRestBenefitImage1File(null)
        setRestBenefitImage2File(null)
        setBenefitImage1File(null)
        setBenefitImage2File(null)
        setDelBenefitImage1File(null)
        setDelBenefitImage2File(null)
        fetchPageData()
      }
    } catch (error) {
      console.error('Error saving login growth data:', error)
      toast.error(error.response?.data?.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  // Generic list update handlers
  const addListItem = (setter, field) => {
    setter(prev => ({
      ...prev,
      [field]: [...prev[field], ""]
    }))
  }

  const updateListItem = (setter, field, index, value) => {
    setter(prev => {
      const newList = [...prev[field]]
      newList[index] = value
      return { ...prev, [field]: newList }
    })
  }

  const removeListItem = (setter, field, index) => {
    setter(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }))
  }

  const handleImageSelect = (e, target) => {
    const file = e.target.files[0]
    if (!file) return
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image size exceeds 10MB limit")
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      if (target === "user1") {
        setBenefitImage1Preview(reader.result)
        setBenefitImage1File(file)
      } else if (target === "user2") {
        setBenefitImage2Preview(reader.result)
        setBenefitImage2File(file)
      } else if (target === "del1") {
        setDelBenefitImage1Preview(reader.result)
        setDelBenefitImage1File(file)
      } else if (target === "del2") {
        setDelBenefitImage2Preview(reader.result)
        setDelBenefitImage2File(file)
      } else if (target === "rest1") {
        setRestBenefitImage1Preview(reader.result)
        setRestBenefitImage1File(file)
      } else if (target === "rest2") {
        setRestBenefitImage2Preview(reader.result)
        setRestBenefitImage2File(file)
      }
    }
    reader.readAsDataURL(file)
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 p-4 lg:p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6412C6] mx-auto"></div>
          <p className="mt-4 text-slate-600 font-semibold">Loading settings configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 lg:p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-[#6412C6]" />
              Login Onboarding Growth Settings
            </h1>
            <p className="text-sm text-slate-600 mt-1">Configure role-specific saving figures, benefits lists, and marketing overlays for login journeys</p>
          </div>
          
          <Button onClick={handleSave} disabled={saving} className="bg-[#6412C6] text-white font-bold hover:bg-[#4E0E9A] flex items-center gap-2 px-6 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg self-start md:self-auto">
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save All Settings'}
          </Button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 mb-6 gap-2">
          {[
            { id: "restaurant", label: "Restaurant Growth", icon: UtensilsCrossed },
            { id: "delivery", label: "Delivery Partner Growth", icon: Truck },
            { id: "user", label: "User / Customer Growth", icon: Users }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-[#6412C6] text-[#6412C6]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Restaurant Tab */}
        {activeTab === "restaurant" && (
          <div className="space-y-6">
            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
                <CardTitle className="text-xl font-bold text-slate-950">Restaurant Onboarding Headline & Copy</CardTitle>
                <CardDescription>Configure core value messaging shown to prospective restaurant owners on desktop split login and mobile carousels.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="restHeadline" className="font-semibold text-slate-800">Headline</Label>
                  <Input
                    id="restHeadline"
                    value={restaurantData.headline}
                    onChange={(e) => setRestaurantData(prev => ({ ...prev, headline: e.target.value }))}
                    placeholder="Grow Your Restaurant Without Paying Commission"
                    className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="restSubheadline" className="font-semibold text-slate-800">Subheadline</Label>
                  <Input
                    id="restSubheadline"
                    value={restaurantData.subheadline}
                    onChange={(e) => setRestaurantData(prev => ({ ...prev, subheadline: e.target.value }))}
                    placeholder="Keep More Profit. Get More Orders. Pay Only ₹30/Day."
                    className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
                <CardTitle className="text-xl font-bold text-slate-950">Savings Showcase Settings</CardTitle>
                <CardDescription>Set the mock order savings comparison points displayed inside the commission visual helper.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="restOrderVal" className="font-semibold text-slate-800">Mock Order Value (₹)</Label>
                    <Input
                      id="restOrderVal"
                      type="number"
                      value={restaurantData.savingsExample.orderValue}
                      onChange={(e) => setRestaurantData(prev => ({
                        ...prev,
                        savingsExample: { ...prev.savingsExample, orderValue: Number(e.target.value) }
                      }))}
                      className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="restTradComm" className="font-semibold text-slate-800">Traditional Comm. Subtext</Label>
                    <Input
                      id="restTradComm"
                      value={restaurantData.savingsExample.traditionalCommission}
                      onChange={(e) => setRestaurantData(prev => ({
                        ...prev,
                        savingsExample: { ...prev.savingsExample, traditionalCommission: e.target.value }
                      }))}
                      placeholder="₹120–₹150 Commission"
                      className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="restItzoComm" className="font-semibold text-slate-800">Itzo Commission Subtext</Label>
                    <Input
                      id="restItzoComm"
                      value={restaurantData.savingsExample.itzoCommission}
                      onChange={(e) => setRestaurantData(prev => ({
                        ...prev,
                        savingsExample: { ...prev.savingsExample, itzoCommission: e.target.value }
                      }))}
                      placeholder="₹0 Commission"
                      className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="restRevenueText" className="font-semibold text-slate-800">Commission Advantage Helper Copy</Label>
                    <Input
                      id="restRevenueText"
                      value={restaurantData.savingsExample.keepsRevenueText}
                      onChange={(e) => setRestaurantData(prev => ({
                        ...prev,
                        savingsExample: { ...prev.savingsExample, keepsRevenueText: e.target.value }
                      }))}
                      placeholder="Restaurant Keeps Full Revenue"
                      className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <h3 className="text-lg font-bold text-slate-900">Admin Configured Static Profit Figures</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="restMonthly" className="font-semibold text-slate-800">Monthly Additional Profit Text</Label>
                      <Input
                        id="restMonthly"
                        value={restaurantData.additionalMessaging.monthlyProfit}
                        onChange={(e) => setRestaurantData(prev => ({
                          ...prev,
                          additionalMessaging: { ...prev.additionalMessaging, monthlyProfit: e.target.value }
                        }))}
                        placeholder="₹59,100"
                        className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="restYearly" className="font-semibold text-slate-800">Yearly Additional Profit Text</Label>
                      <Input
                        id="restYearly"
                        value={restaurantData.additionalMessaging.yearlyProfit}
                        onChange={(e) => setRestaurantData(prev => ({
                          ...prev,
                          additionalMessaging: { ...prev.additionalMessaging, yearlyProfit: e.target.value }
                        }))}
                        placeholder="₹7,19,050"
                        className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Restaurant Lists */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Restaurant Benefits */}
              <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-950">Partner Benefits List</CardTitle>
                    <CardDescription>Key selling points for restaurants</CardDescription>
                  </div>
                  <Button onClick={() => addListItem(setRestaurantData, "benefits")} size="sm" className="bg-[#6412C6] text-white font-bold hover:bg-[#4E0E9A] rounded-xl">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {restaurantData.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={benefit}
                        onChange={(e) => updateListItem(setRestaurantData, "benefits", idx, e.target.value)}
                        placeholder="e.g. 0% Commission"
                        className="border-slate-200 text-sm rounded-xl"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeListItem(setRestaurantData, "benefits", idx)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {restaurantData.benefits.length === 0 && (
                    <p className="text-center text-slate-400 py-4 text-sm">No benefits added. Add some to display.</p>
                  )}
                </CardContent>
              </Card>

              {/* Consulting Services */}
              <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-950">FSSAI / GST Consulting Assistance</CardTitle>
                    <CardDescription>Services offered to help restaurants register</CardDescription>
                  </div>
                  <Button onClick={() => addListItem(setRestaurantData, "consultingServices")} size="sm" className="bg-[#6412C6] text-white font-bold hover:bg-[#4E0E9A] rounded-xl">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {restaurantData.consultingServices.map((srv, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={srv}
                        onChange={(e) => updateListItem(setRestaurantData, "consultingServices", idx, e.target.value)}
                        placeholder="e.g. FSSAI Registration"
                        className="border-slate-200 text-sm rounded-xl"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeListItem(setRestaurantData, "consultingServices", idx)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {restaurantData.consultingServices.length === 0 && (
                    <p className="text-center text-slate-400 py-4 text-sm">No services listed. Add some to display.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden mt-6">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
                <CardTitle className="text-xl font-bold text-slate-950">Onboarding Benefit Images</CardTitle>
                <CardDescription>Upload two promotional benefit images shown on the restaurant partner login page.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Image 1 */}
                  <div className="space-y-4">
                    <Label className="font-semibold text-slate-800">Benefit Image 1</Label>
                    <div className="relative aspect-video rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:border-[#6412C6] transition-colors cursor-pointer flex items-center justify-center overflow-hidden group min-h-[160px]">
                      {restBenefitImage1Preview ? (
                        <>
                          <img src={restBenefitImage1Preview} alt="Restaurant Benefit 1" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRestBenefitImage1Preview(null);
                              setRestBenefitImage1File(null);
                              setRestaurantData(prev => ({ ...prev, benefitImage1: "" }));
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-50 text-red-500 shadow-sm border border-red-100 hover:bg-red-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <div onClick={() => restFileInput1Ref.current?.click()} className="flex flex-col items-center gap-2 text-slate-400">
                          <Plus className="h-8 w-8 text-slate-300" />
                          <span className="text-xs font-semibold">Upload Image 1</span>
                        </div>
                      )}
                      <input
                        type="file"
                        ref={restFileInput1Ref}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageSelect(e, "rest1")}
                      />
                    </div>
                  </div>

                  {/* Image 2 */}
                  <div className="space-y-4">
                    <Label className="font-semibold text-slate-800">Benefit Image 2</Label>
                    <div className="relative aspect-video rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:border-[#6412C6] transition-colors cursor-pointer flex items-center justify-center overflow-hidden group min-h-[160px]">
                      {restBenefitImage2Preview ? (
                        <>
                          <img src={restBenefitImage2Preview} alt="Restaurant Benefit 2" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRestBenefitImage2Preview(null);
                              setRestBenefitImage2File(null);
                              setRestaurantData(prev => ({ ...prev, benefitImage2: "" }));
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-50 text-red-500 shadow-sm border border-red-100 hover:bg-red-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <div onClick={() => restFileInput2Ref.current?.click()} className="flex flex-col items-center gap-2 text-slate-400">
                          <Plus className="h-8 w-8 text-slate-300" />
                          <span className="text-xs font-semibold">Upload Image 2</span>
                        </div>
                      )}
                      <input
                        type="file"
                        ref={restFileInput2Ref}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageSelect(e, "rest2")}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Delivery Tab */}
        {activeTab === "delivery" && (
          <div className="space-y-6">
            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
                <CardTitle className="text-xl font-bold text-slate-950">Delivery partner Onboarding Headline & Copy</CardTitle>
                <CardDescription>Configure core value messaging shown to delivery sarathi partners during auth.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="delHeadline" className="font-semibold text-slate-800">Headline</Label>
                  <Input
                    id="delHeadline"
                    value={deliveryData.headline}
                    onChange={(e) => setDeliveryData(prev => ({ ...prev, headline: e.target.value }))}
                    placeholder="Earn More. Keep 100% Of Your Delivery Earnings."
                    className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delSubheadline" className="font-semibold text-slate-800">Subheadline</Label>
                  <Input
                    id="delSubheadline"
                    value={deliveryData.subheadline}
                    onChange={(e) => setDeliveryData(prev => ({ ...prev, subheadline: e.target.value }))}
                    placeholder="Zero Commission. Unlimited Opportunities."
                    className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="delBanner" className="font-semibold text-slate-800">Driver Marketing Banner Copy</Label>
                    <Input
                      id="delBanner"
                      value={deliveryData.driverMarketingBanner}
                      onChange={(e) => setDeliveryData(prev => ({ ...prev, driverMarketingBanner: e.target.value }))}
                      placeholder="AB COMMISSION KA KHEL KHATAM!"
                      className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6] font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delCtaText" className="font-semibold text-slate-800">CTA Text</Label>
                    <Input
                      id="delCtaText"
                      value={deliveryData.ctaText}
                      onChange={(e) => setDeliveryData(prev => ({ ...prev, ctaText: e.target.value }))}
                      placeholder="Sirf ₹30 Mein Apni Delivery Agency Shuru Karein."
                      className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivery Lists */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Delivery Benefits */}
              <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-950">Partner Benefits</CardTitle>
                  </div>
                  <Button onClick={() => addListItem(setDeliveryData, "benefits")} size="sm" className="bg-[#6412C6] text-white font-bold hover:bg-[#4E0E9A] rounded-xl">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {deliveryData.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={benefit}
                        onChange={(e) => updateListItem(setDeliveryData, "benefits", idx, e.target.value)}
                        placeholder="e.g. 100% Delivery Fee Retention"
                        className="border-slate-200 text-sm rounded-xl"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeListItem(setDeliveryData, "benefits", idx)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {deliveryData.benefits.length === 0 && (
                    <p className="text-center text-slate-400 py-4 text-sm">No benefits added.</p>
                  )}
                </CardContent>
              </Card>

              {/* Partner Welfare */}
              <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-950">Welfare & Insurance</CardTitle>
                  </div>
                  <Button onClick={() => addListItem(setDeliveryData, "partnerWelfare")} size="sm" className="bg-[#6412C6] text-white font-bold hover:bg-[#4E0E9A] rounded-xl">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {deliveryData.partnerWelfare.map((welfare, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={welfare}
                        onChange={(e) => updateListItem(setDeliveryData, "partnerWelfare", idx, e.target.value)}
                        placeholder="e.g. Accident Insurance up to ₹5 Lakhs"
                        className="border-slate-200 text-sm rounded-xl"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeListItem(setDeliveryData, "partnerWelfare", idx)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {deliveryData.partnerWelfare.length === 0 && (
                    <p className="text-center text-slate-400 py-4 text-sm">No welfare items added.</p>
                  )}
                </CardContent>
              </Card>

              {/* Operational Benefits */}
              <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-950">Operational Comforts</CardTitle>
                  </div>
                  <Button onClick={() => addListItem(setDeliveryData, "operationalBenefits")} size="sm" className="bg-[#6412C6] text-white font-bold hover:bg-[#4E0E9A] rounded-xl">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {deliveryData.operationalBenefits.map((op, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={op}
                        onChange={(e) => updateListItem(setDeliveryData, "operationalBenefits", idx, e.target.value)}
                        placeholder="e.g. Smart Order Allocation"
                        className="border-slate-200 text-sm rounded-xl"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeListItem(setDeliveryData, "operationalBenefits", idx)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {deliveryData.operationalBenefits.length === 0 && (
                    <p className="text-center text-slate-400 py-4 text-sm">No operational items added.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden mt-6">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
                <CardTitle className="text-xl font-bold text-slate-950">Onboarding Benefit Images</CardTitle>
                <CardDescription>Upload two promotional benefit images shown on the delivery partner login page.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Image 1 */}
                  <div className="space-y-4">
                    <Label className="font-semibold text-slate-800">Benefit Image 1</Label>
                    <div className="relative aspect-video rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:border-[#6412C6] transition-colors cursor-pointer flex items-center justify-center overflow-hidden group min-h-[160px]">
                      {delBenefitImage1Preview ? (
                        <>
                          <img src={delBenefitImage1Preview} alt="Delivery Benefit 1" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDelBenefitImage1Preview(null);
                              setDelBenefitImage1File(null);
                              setDeliveryData(prev => ({ ...prev, benefitImage1: "" }));
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-50 text-red-500 shadow-sm border border-red-100 hover:bg-red-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <div onClick={() => delFileInput1Ref.current?.click()} className="flex flex-col items-center gap-2 text-slate-400">
                          <Plus className="h-8 w-8 text-slate-300" />
                          <span className="text-xs font-semibold">Upload Image 1</span>
                        </div>
                      )}
                      <input
                        type="file"
                        ref={delFileInput1Ref}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageSelect(e, "del1")}
                      />
                    </div>
                  </div>

                  {/* Image 2 */}
                  <div className="space-y-4">
                    <Label className="font-semibold text-slate-800">Benefit Image 2</Label>
                    <div className="relative aspect-video rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:border-[#6412C6] transition-colors cursor-pointer flex items-center justify-center overflow-hidden group min-h-[160px]">
                      {delBenefitImage2Preview ? (
                        <>
                          <img src={delBenefitImage2Preview} alt="Delivery Benefit 2" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDelBenefitImage2Preview(null);
                              setDelBenefitImage2File(null);
                              setDeliveryData(prev => ({ ...prev, benefitImage2: "" }));
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-50 text-red-500 shadow-sm border border-red-100 hover:bg-red-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <div onClick={() => delFileInput2Ref.current?.click()} className="flex flex-col items-center gap-2 text-slate-400">
                          <Plus className="h-8 w-8 text-slate-300" />
                          <span className="text-xs font-semibold">Upload Image 2</span>
                        </div>
                      )}
                      <input
                        type="file"
                        ref={delFileInput2Ref}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageSelect(e, "del2")}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* User Tab */}
        {activeTab === "user" && (
          <div className="space-y-6">
            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
                <CardTitle className="text-xl font-bold text-slate-950">User / Customer Onboarding Headline & Copy</CardTitle>
                <CardDescription>Configure core value messaging shown to customers during auth.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="usrHeadline" className="font-semibold text-slate-800">Headline</Label>
                  <Input
                    id="usrHeadline"
                    value={userData.headline}
                    onChange={(e) => setUserData(prev => ({ ...prev, headline: e.target.value }))}
                    placeholder="Order Smarter. Save More."
                    className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usrSubheadline" className="font-semibold text-slate-800">Subheadline</Label>
                  <Input
                    id="usrSubheadline"
                    value={userData.subheadline}
                    onChange={(e) => setUserData(prev => ({ ...prev, subheadline: e.target.value }))}
                    placeholder="Real Restaurant Prices. No Hidden Charges."
                    className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
                <CardTitle className="text-xl font-bold text-slate-950">Pricing & Comparison Settings</CardTitle>
                <CardDescription>Customize menu pricing comparisons shown on the user login split view.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="usrTradApps" className="font-semibold text-slate-800">Traditional Apps Costing Subtext</Label>
                    <Input
                      id="usrTradApps"
                      value={userData.comparison.traditionalAppsText}
                      onChange={(e) => setUserData(prev => ({
                        ...prev,
                        comparison: { ...prev.comparison, traditionalAppsText: e.target.value }
                      }))}
                      placeholder="Menu Price + Markup + Fees"
                      className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="usrItzoFood" className="font-semibold text-slate-800">ItzoFood Costing Subtext</Label>
                    <Input
                      id="usrItzoFood"
                      value={userData.comparison.itzoFoodText}
                      onChange={(e) => setUserData(prev => ({
                        ...prev,
                        comparison: { ...prev.comparison, itzoFoodText: e.target.value }
                      }))}
                      placeholder="Actual Menu Price + Delivery Fee"
                      className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6 space-y-2">
                  <Label htmlFor="usrPrivacy" className="font-semibold text-slate-800 flex items-center gap-1.5 text-amber-700">
                    <ShieldAlert className="h-4 w-4" />
                    Female Customer Contact Privacy Messaging
                  </Label>
                  <Textarea
                    id="usrPrivacy"
                    value={userData.privacyMessage}
                    onChange={(e) => setUserData(prev => ({ ...prev, privacyMessage: e.target.value }))}
                    placeholder="Your Privacy Matters: Female customer contact information remains protected..."
                    rows={3}
                    className="rounded-xl border-slate-200 focus-visible:ring-[#6412C6]"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-6">
                <CardTitle className="text-xl font-bold text-slate-950">Onboarding Benefit Images</CardTitle>
                <CardDescription>Upload two promotional benefit images shown on the customer login page.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Image 1 */}
                  <div className="space-y-4">
                    <Label className="font-semibold text-slate-800">Benefit Image 1</Label>
                    <div className="relative aspect-video rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:border-[#6412C6] transition-colors cursor-pointer flex items-center justify-center overflow-hidden group min-h-[160px]">
                      {benefitImage1Preview ? (
                        <>
                          <img src={benefitImage1Preview} alt="Benefit 1" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBenefitImage1Preview(null);
                              setBenefitImage1File(null);
                              setUserData(prev => ({ ...prev, benefitImage1: "" }));
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-50 text-red-500 shadow-sm border border-red-100 hover:bg-red-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <div onClick={() => fileInput1Ref.current?.click()} className="flex flex-col items-center gap-2 text-slate-400">
                          <Plus className="h-8 w-8 text-slate-300" />
                          <span className="text-xs font-semibold">Upload Image 1</span>
                        </div>
                      )}
                      <input
                        type="file"
                        ref={fileInput1Ref}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageSelect(e, "user1")}
                      />
                    </div>
                  </div>

                  {/* Image 2 */}
                  <div className="space-y-4">
                    <Label className="font-semibold text-slate-800">Benefit Image 2</Label>
                    <div className="relative aspect-video rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:border-[#6412C6] transition-colors cursor-pointer flex items-center justify-center overflow-hidden group min-h-[160px]">
                      {benefitImage2Preview ? (
                        <>
                          <img src={benefitImage2Preview} alt="Benefit 2" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBenefitImage2Preview(null);
                              setBenefitImage2File(null);
                              setUserData(prev => ({ ...prev, benefitImage2: "" }));
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-50 text-red-500 shadow-sm border border-red-100 hover:bg-red-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <div onClick={() => fileInput2Ref.current?.click()} className="flex flex-col items-center gap-2 text-slate-400">
                          <Plus className="h-8 w-8 text-slate-300" />
                          <span className="text-xs font-semibold">Upload Image 2</span>
                        </div>
                      )}
                      <input
                        type="file"
                        ref={fileInput2Ref}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageSelect(e, "user2")}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Lists */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* User Benefits */}
              <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-950">Benefits List</CardTitle>
                    <CardDescription>Primary reasons to order from ItzoFood</CardDescription>
                  </div>
                  <Button onClick={() => addListItem(setUserData, "benefits")} size="sm" className="bg-[#6412C6] text-white font-bold hover:bg-[#4E0E9A] rounded-xl">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {userData.benefits.map((benefit, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={benefit}
                        onChange={(e) => updateListItem(setUserData, "benefits", idx, e.target.value)}
                        placeholder="e.g. Actual Restaurant Menu Pricing"
                        className="border-slate-200 text-sm rounded-xl"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeListItem(setUserData, "benefits", idx)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {userData.benefits.length === 0 && (
                    <p className="text-center text-slate-400 py-4 text-sm">No benefits added.</p>
                  )}
                </CardContent>
              </Card>

              {/* User Advantages */}
              <Card className="border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-950">Consumer Advantages</CardTitle>
                    <CardDescription>Core value advantages points</CardDescription>
                  </div>
                  <Button onClick={() => addListItem(setUserData, "keyAdvantages")} size="sm" className="bg-[#6412C6] text-white font-bold hover:bg-[#4E0E9A] rounded-xl">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-3">
                  {userData.keyAdvantages.map((adv, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        value={adv}
                        onChange={(e) => updateListItem(setUserData, "keyAdvantages", idx, e.target.value)}
                        placeholder="e.g. Better Local Economy Support"
                        className="border-slate-200 text-sm rounded-xl"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeListItem(setUserData, "keyAdvantages", idx)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {userData.keyAdvantages.length === 0 && (
                    <p className="text-center text-slate-400 py-4 text-sm">No key advantages added.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
