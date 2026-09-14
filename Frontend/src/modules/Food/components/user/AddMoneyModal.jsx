import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import { IndianRupee, Loader2, X } from "lucide-react"
import { userAPI } from "@food/api"
import { initRazorpayPayment } from "@food/utils/razorpay"
import { toast } from "sonner"
import { getCompanyNameAsync } from "@common/utils/businessSettings"

const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

export default function AddMoneyModal({ open, onOpenChange, onSuccess }) {
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)

  const quickAmounts = [100, 250, 500, 1000, 2000, 5000]

  const handleAmountSelect = (selectedAmount) => {
    setAmount(selectedAmount.toString())
  }

  const handleAmountChange = (e) => {
    const value = e.target.value.replace(/[^0-9.]/g, "")
    if (value === "" || (parseFloat(value) >= 1 && parseFloat(value) <= 50000)) {
      setAmount(value)
    }
  }

  const handleAddMoney = async () => {
    const amountNum = parseFloat(amount)

    if (!amount || isNaN(amountNum) || amountNum < 1) {
      toast.error("Please enter a valid amount (minimum \u20B91)")
      return
    }

    if (amountNum > 50000) {
      toast.error("Maximum amount is \u20B950,000")
      return
    }

    try {
      setLoading(true)

      debugLog("Creating wallet top-up order for amount:", amountNum)
      const orderResponse = await userAPI.createWalletTopupOrder(amountNum)
      debugLog("Order response:", orderResponse)

      const { razorpay } = orderResponse.data.data

      if (!razorpay || !razorpay.orderId || !razorpay.key) {
        debugError("Invalid Razorpay response:", { razorpay, orderResponse })
        throw new Error("Failed to initialize payment gateway")
      }

      setLoading(false)
      onOpenChange(false)

      await new Promise((resolve) => setTimeout(resolve, 100))

      setProcessing(true)

      let userInfo = {}
      try {
        const userResponse = await userAPI.getProfile()
        userInfo = userResponse?.data?.data?.user || userResponse?.data?.user || {}
      } catch (err) {
        debugWarn("Could not fetch user profile for Razorpay prefill:", err)
      }

      const userPhone = userInfo.phone || ""
      const userEmail = userInfo.email || ""
      const userName = userInfo.name || ""
      const formattedPhone = userPhone.replace(/\D/g, "").slice(-10)
      const companyName = await getCompanyNameAsync()

      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        order_id: razorpay.orderId,
        name: companyName,
        description: `Wallet Top-up - \u20B9${amountNum.toFixed(2)}`,
        prefill: {
          name: userName,
          email: userEmail,
          contact: formattedPhone,
        },
        notes: {
          type: "wallet_topup",
          amount: amountNum.toString(),
        },
        handler: async (response) => {
          try {
            await userAPI.verifyWalletTopupPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              amount: amountNum,
            })

            toast.success(`\u20B9${amountNum} added to wallet successfully!`)
            setAmount("")
            setProcessing(false)
            onOpenChange(false)

            if (onSuccess) {
              onSuccess()
            }
          } catch (error) {
            debugError("Payment verification error:", error)
            toast.error(error?.response?.data?.message || "Payment verification failed. Please contact support.")
            setProcessing(false)
          }
        },
        onError: (error) => {
          debugError("Razorpay payment error:", error)
          toast.error(error?.description || "Payment failed. Please try again.")
          setProcessing(false)
        },
        onClose: () => {
          setProcessing(false)
        },
      })
    } catch (error) {
      debugError("Error creating payment order:", error)
      debugError("Error response:", error?.response)
      debugError("Error response data:", error?.response?.data)

      let errorMessage = "Failed to initialize payment. Please try again."

      if (error?.response?.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error
        } else if (typeof error.response.data === "string") {
          errorMessage = error.response.data
        }
      } else if (error?.message) {
        errorMessage = error.message
      }

      debugError("Final error message:", errorMessage)
      toast.error(errorMessage)
      setLoading(false)
      setProcessing(false)
    }
  }

  const handleClose = () => {
    if (!loading && !processing) {
      setAmount("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-1rem)] max-w-[22rem] sm:max-w-md rounded-3xl p-0 overflow-hidden"
      >
        <div className="relative px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading || processing}
            className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            aria-label="Close add money modal"
          >
            <X className="h-5 w-5" />
          </button>

          <DialogHeader className="pr-10 text-center">
            <DialogTitle className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
              Add Money to Wallet
            </DialogTitle>
            <DialogDescription className="text-sm md:text-base text-gray-600 dark:text-gray-400">
              Enter the amount you want to add to your wallet
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enter Amount
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <IndianRupee className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  type="text"
                  value={amount}
                  onChange={handleAmountChange}
                  placeholder="Enter amount"
                  className="pl-10 h-12 text-lg"
                  disabled={loading || processing}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Minimum: {"\u20B9"}1 | Maximum: {"\u20B9"}50,000
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Quick Select
              </label>
              <div className="grid grid-cols-3 gap-2">
                {quickAmounts.map((quickAmount) => (
                  <Button
                    key={quickAmount}
                    type="button"
                    variant={amount === quickAmount.toString() ? "default" : "outline"}
                    className="h-10"
                    onClick={() => handleAmountSelect(quickAmount)}
                    disabled={loading || processing}
                  >
                    {"\u20B9"}{quickAmount}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleAddMoney}
              disabled={!amount || loading || processing || parseFloat(amount) < 1}
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-semibold text-base"
            >
              {loading || processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {loading ? "Processing..." : "Opening Payment Gateway..."}
                </>
              ) : (
                `Add \u20B9${amount || "0"}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
