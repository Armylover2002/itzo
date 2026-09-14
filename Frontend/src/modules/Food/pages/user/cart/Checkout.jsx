import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { CheckCircle, MapPin, CreditCard, ArrowLeft, Percent, ChevronRight } from "lucide-react"
import { Link } from "react-router-dom"
import AnimatedPage from "@food/components/user/AnimatedPage"
import ScrollReveal from "@food/components/user/ScrollReveal"
import { Card, CardHeader, CardTitle, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { Badge } from "@food/components/ui/badge"
import { useCart } from "@food/context/CartContext"
import { useProfile } from "@food/context/ProfileContext"
import { useOrders } from "@food/context/OrdersContext"
import { restaurantAPI } from "@food/api"

export default function Checkout() {
  const navigate = useNavigate()
  const { cart, clearCart } = useCart()
  const { getDefaultAddress, getDefaultPaymentMethod, setDefaultAddress, addresses, paymentMethods, activeAddress } = useProfile()
  const { createOrder } = useOrders()
  const getAddressId = (address) => address?.id || address?._id || ""
  const [selectedPayment, setSelectedPayment] = useState(getDefaultPaymentMethod()?.id || "")
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)

  const [couponCode, setCouponCode] = useState("")
  const [manualCouponCode, setManualCouponCode] = useState("")
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [availableCoupons, setAvailableCoupons] = useState([])
  const [loadingCoupons, setLoadingCoupons] = useState(false)
  const [showCoupons, setShowCoupons] = useState(false)
  const [discount, setDiscount] = useState(0)

  const selectedAddress = activeAddress
  const defaultPayment = paymentMethods.find(pm => pm.id === selectedPayment) || getDefaultPaymentMethod()

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity * 83, 0)
  const otherPlatformSubtotal = cart.reduce((sum, item) => sum + (item.otherPrice || item.price) * item.quantity * 83, 0)
  const deliveryFee = 2.99 * 83
  const tax = subtotal * 0.08

  const restaurantId = cart.length > 0 ? (cart[0]?.restaurantId || null) : null

  useEffect(() => {
    const fetchCoupons = async () => {
      if (!restaurantId) return
      try {
        setLoadingCoupons(true)
        const response = await restaurantAPI.getCouponsByItemIdPublic(restaurantId, "")
        const list = response?.data?.data?.coupons || []
        setAvailableCoupons(list.map(c => {
          const discountVal = c.discountPercentage 
            ? Math.floor(subtotal * (Number(c.discountPercentage) / 100))
            : Number(c.originalPrice || 0);

          return {
            code: c.couponCode,
            discount: discountVal,
            discountPercentage: c.discountPercentage || 0,
            minOrder: c.minOrderValue || c.minOrder || 0,
            description: c.description || (c.discountPercentage ? `${c.discountPercentage}% OFF` : `₹${c.originalPrice} FLAT OFF`)
          };
        }))
      } catch (error) {
        console.error("Error loading checkout coupons:", error)
      } finally {
        setLoadingCoupons(false)
      }
    }
    fetchCoupons()
  }, [restaurantId, subtotal])

  useEffect(() => {
    if (!appliedCoupon) {
      setDiscount(0)
      return
    }
    // Do not invent caps — prefer server-computed discount when present; else show 0 until recalculated.
    const serverDiscount = Number(appliedCoupon.serverDiscount)
    if (Number.isFinite(serverDiscount) && serverDiscount >= 0) {
      setDiscount(Math.min(subtotal, serverDiscount))
      return
    }
    setDiscount(0)
  }, [appliedCoupon, subtotal])

  // Legacy demo checkout: totals are display-only. Live cart uses server calculateOrder.
  const total = Math.max(0, subtotal + deliveryFee + tax - discount)
  const otherPlatformSavings = Math.max(0, otherPlatformSubtotal - subtotal)

  const handleApplyCoupon = (coupon) => {
    if (subtotal < coupon.minOrder) {
      alert(`Minimum order amount of ₹${coupon.minOrder} is required to use this coupon.`)
      return
    }
    setAppliedCoupon(coupon)
    setCouponCode(coupon.code)
    setShowCoupons(false)
  }

  const handleApplyCouponCode = () => {
    const code = manualCouponCode.trim().toUpperCase()
    if (!code) return
    const matched = availableCoupons.find(c => c.code === code)
    if (matched) {
      handleApplyCoupon(matched)
    } else {
      setAppliedCoupon({
        code,
        discount: 0,
        minOrder: 0,
        description: `Promo code ${code}`
      })
      setCouponCode(code)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode("")
    setManualCouponCode("")
  }

  const handlePlaceOrder = async () => {
    if (!selectedAddress || !selectedPayment) {
      alert("Please select a delivery address and payment method")
      return
    }

    if (cart.length === 0) {
      alert("Your cart is empty")
      return
    }

    setIsPlacingOrder(true)

    // Simulate API call
    setTimeout(() => {
      const orderId = createOrder({
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image
        })),
        address: selectedAddress,
        paymentMethod: defaultPayment,
        subtotal,
        deliveryFee,
        tax,
        total,
        discount,
        couponCode: couponCode || null,
        restaurant: cart[0]?.restaurant || cart[0]?.name || "Multiple Restaurants"
      })

      clearCart()
      setIsPlacingOrder(false)
      navigate(`/user/orders/${orderId}?confirmed=true`)
    }, 1500)
  }

  if (cart.length === 0) {
    return (
      <AnimatedPage className="min-h-screen bg-linear-to-b from-red-50/30 via-white to-red-50/20 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg md:text-xl">Checkout</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg mb-4">Your cart is empty</p>
                <Link to="/user/cart">
                  <Button>Go to Cart</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-linear-to-b from-red-50/30 via-white to-red-50/20 dark:from-[#0a0a0a] dark:via-[#1a1a1a] dark:to-[#0a0a0a] p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        <ScrollReveal>
          <div className="flex items-center gap-4 mb-6 md:mb-8">
            <Link to="/user/cart">
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 md:h-10 md:w-10">
                <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
              </Button>
            </Link>
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold dark:text-white">Checkout</h1>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address */}
            <ScrollReveal delay={0.1}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-[#FF0000]" />
                    Delivery Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {addresses.length > 0 ? (
                    <div className="space-y-3">
                      {/* Current Location Section */}
                      {(() => {
                        const currentLocation = addresses.find(a => a.type === "current" || a.label === "Current Location");
                        if (!currentLocation) return null;
                        
                        const addressId = getAddressId(currentLocation);
                        const isSelected = selectedAddressId === addressId;
                        const addressString = [
                          currentLocation.street,
                          currentLocation.additionalDetails,
                          `${currentLocation.city}, ${currentLocation.state} ${currentLocation.zipCode}`
                        ].filter(Boolean).join(", ");

                        return (
                          <div
                            key={addressId || `current-${currentLocation.street}`}
                            className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${isSelected
                                ? "border-[#FF0000] bg-red-50 dark:bg-red-900/10"
                                : "border-gray-200 dark:border-gray-800 hover:border-red-300 dark:hover:border-red-700"
                              }`}
                            onClick={() => {
                              setSelectedAddressId(addressId);
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-[#FF0000]" />
                                  <h4 className="font-bold text-[#FF0000]">Current Location</h4>
                                </div>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{addressString}</p>
                              </div>
                              {isSelected && <CheckCircle className="h-5 w-5 text-[#FF0000]" />}
                            </div>
                          </div>
                        );
                      })()}
                      
                      {/* Saved Addresses Section */}
                      {(() => {
                        const savedList = addresses.filter(a => a.type !== "current" && a.label !== "Current Location");
                        if (savedList.length === 0) return null;
                        
                        return (
                          <>
                            <h4 className="font-bold text-sm text-gray-500 uppercase tracking-wider mt-6 mb-3 border-b pb-2">Saved Addresses</h4>
                            {savedList.map((address) => {
                        const addressId = getAddressId(address)
                        const isSelected = selectedAddressId === addressId
                        const addressString = [
                          address.street,
                          address.additionalDetails,
                          address.city,
                          address.state,
                          address.zipCode
                        ].filter(Boolean).join(", ")

                        return (
                          <div
                            key={addressId || `${address.label}-${address.street}-${address.city}`}
                            className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${isSelected
                                ? "border-[#FF0000] bg-red-50 dark:bg-red-900/10"
                                : "border-gray-200 dark:border-gray-800 hover:border-red-300 dark:hover:border-red-700"
                              }`}
                            onClick={() => {
                              setSelectedAddressId(addressId)
                              if (addressId) setDefaultAddress(addressId)
                            }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                {address.isDefault && (
                                  <Badge className="mb-2 bg-[#FF0000] text-white">Default</Badge>

                                )}
                                <p className="text-sm font-medium">{addressString}</p>
                              </div>
                              {isSelected && (
                                <CheckCircle className="h-5 w-5 text-[#FF0000]" />
                              )}
                          </div>
                        )
                      })}
                          </>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">No addresses saved</p>
                      <Button
                        onClick={() =>
                          navigate("/user/cart/select-address", { state: { from: "/user/cart/checkout" } })
                        }
                      >
                        Add Address
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollReveal>

            {/* Payment Method */}
            <ScrollReveal delay={0.2}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-[#FF0000]" />
                    Payment Method
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {paymentMethods.length > 0 ? (
                    <div className="space-y-3">
                      {paymentMethods.map((payment) => {
                        const isSelected = selectedPayment === payment.id
                        const cardNumber = `**** **** **** ${payment.cardNumber}`

                        return (
                          <div
                            key={payment.id}
                            className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${isSelected
                                ? "border-[#FF0000] bg-red-50"
                                : "border-gray-200 hover:border-red-300"
                              }`}
                            onClick={() => setSelectedPayment(payment.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {payment.isDefault && (
                                    <Badge className="bg-[#FF0000] text-white">Default</Badge>
                                  )}
                                  <Badge variant="outline" className="capitalize">
                                    {payment.type}
                                  </Badge>
                                </div>
                                <p className="font-semibold">{cardNumber}</p>
                                <p className="text-sm text-muted-foreground">
                                  {payment.cardHolder} � Expires {payment.expiryMonth}/{payment.expiryYear.slice(-2)}
                                </p>
                              </div>
                              {isSelected && (
                                <CheckCircle className="h-5 w-5 text-[#FF0000]" />
                              )}
                            </div>
                          </div>
                        )
                      })}
                      <Link to="/user/profile/payments">
                        <Button variant="outline" className="w-full">
                          Manage Payment Methods
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">No payment methods saved</p>
                      <Link to="/user/profile/payments/new">
                        <Button>Add Payment Method</Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <ScrollReveal delay={0.3}>
              <Card className="sticky top-4 md:top-6 dark:bg-[#1a1a1a] dark:border-gray-800">
                <CardHeader>
                  <CardTitle className="text-base md:text-lg lg:text-xl dark:text-white">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  <div className="space-y-3 md:space-y-4 max-h-64 md:max-h-80 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 md:gap-4 pb-3 md:pb-4 border-b dark:border-gray-700">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm md:text-base dark:text-gray-200">{item.name}</p>
                          {item.variantName ? (
                            <p className="text-xs md:text-sm text-muted-foreground">{item.variantName}</p>
                          ) : null}
                          <p className="text-xs md:text-sm text-muted-foreground">
                            ₹{(item.price * 83).toFixed(0)} × {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold text-sm md:text-base dark:text-gray-200">
                          ₹{(item.price * 83 * item.quantity).toFixed(0)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Coupon Section */}
                  <div className="border-t border-slate-100 dark:border-gray-800 pt-4 mt-2">
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Coupons & Offers</h4>
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
                        <div className="flex items-center gap-2">
                          <Percent className="h-4 w-4 text-[#FF0000]" />
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-gray-200">'{appliedCoupon.code}' Applied</p>
                            <p className="text-[11px] text-green-600 dark:text-green-400 font-semibold mt-0.5">Saved ₹{discount}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleRemoveCoupon} className="text-xs text-[#FF0000] hover:text-[#FF0000] p-0 h-auto font-bold bg-transparent hover:bg-transparent">
                          REMOVE
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter coupon code"
                            value={manualCouponCode}
                            onChange={(e) => setManualCouponCode(e.target.value.toUpperCase())}
                            className="h-9 text-xs"
                          />
                          <Button size="sm" onClick={handleApplyCouponCode} className="bg-slate-900 hover:bg-slate-800 text-white h-9 px-4">
                            Apply
                          </Button>
                        </div>
                        {loadingCoupons ? (
                          <p className="text-[11px] text-slate-400">Loading coupons...</p>
                        ) : availableCoupons.length > 0 ? (
                          <div className="space-y-2 max-h-36 overflow-y-auto">
                            {availableCoupons.map((coupon) => {
                              const canApply = subtotal >= coupon.minOrder;
                              return (
                                <div key={coupon.code} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-slate-900/30 text-xs">
                                  <div className="flex-1 pr-2">
                                    <span className="font-bold text-slate-800 dark:text-gray-200 tracking-wider bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded mr-1.5">
                                      {coupon.code}
                                    </span>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                                      {coupon.description}
                                    </p>
                                    {!canApply && (
                                      <p className="text-[9px] text-[#FF0000] font-semibold mt-0.5">
                                        Add ₹{(coupon.minOrder - subtotal).toFixed(0)} more to unlock
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[10px] px-2.5 font-bold text-[#FF0000] border-[#FF0000] hover:bg-red-50"
                                    onClick={() => handleApplyCoupon(coupon)}
                                    disabled={!canApply}
                                  >
                                    APPLY
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No offers available for this store.</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 md:space-y-3 pt-4 md:pt-6 border-t dark:border-gray-700">
                    {otherPlatformSavings > 0 && (
                      <div className="flex justify-between text-sm md:text-base text-green-600 font-bold mb-2 p-2 bg-green-50 rounded-lg border border-green-100">
                        <span>Other platform comparison</span>
                        <span>-₹{Math.round(otherPlatformSavings)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">Subtotal</span>
                      <div className="text-right">
                        {otherPlatformSubtotal > subtotal && (
                          <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 mr-2">
                            Other: ₹{Math.round(otherPlatformSubtotal)}
                          </span>
                        )}
                        <span className="dark:text-gray-200">₹{subtotal.toFixed(0)}</span>
                      </div>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-sm md:text-base text-green-600 font-bold">
                        <span>Coupon Discount ({appliedCoupon?.code})</span>
                        <span>-₹{discount}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span className="dark:text-gray-200">₹{deliveryFee.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">Tax</span>
                      <span className="dark:text-gray-200">₹{tax.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg md:text-xl lg:text-2xl pt-2 md:pt-3 border-t dark:border-gray-700">
                      <span className="dark:text-white">Total</span>
                      <span className="text-[#FF0000] dark:text-red-400">₹{total.toFixed(0)}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-[#FF0000] hover:bg-[#C83C00] text-white mt-4 md:mt-6 h-11 md:h-12 text-sm md:text-base border-none"
                    onClick={handlePlaceOrder}
                    disabled={isPlacingOrder || !selectedAddress || !selectedPayment}
                  >
                    {isPlacingOrder ? "Placing Order..." : "Place Order"}
                  </Button>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </AnimatedPage>
  )
}
