import { Link } from "react-router-dom"
import { CreditCard, Trash2, Edit, Check, Plus } from "lucide-react"
import AnimatedPage from "@food/components/user/AnimatedPage"
import { Card, CardHeader, CardTitle, CardContent } from "@food/components/ui/card"
import { Button } from "@food/components/ui/button"
import { Badge } from "@food/components/ui/badge"
import { useProfile } from "@food/context/ProfileContext"

export default function Payments() {
  const { paymentMethods, deletePaymentMethod, setDefaultPaymentMethod } = useProfile()

  const formatCardNumber = (cardNumber) => {
    if (!cardNumber) return "****"
    return `**** **** **** ${cardNumber}`
  }

  const formatExpiry = (month, year) => {
    if (!month || !year) return ""
    return `${month.padStart(2, "0")}/${year.slice(-2)}`
  }

  const getCardTypeIcon = (type) => {
    if (type === "visa") return "??"
    if (type === "mastercard") return "??"
    return "??"
  }

  const getCardTypeName = (type) => {
    if (type === "visa") return "Visa"
    if (type === "mastercard") return "Mastercard"
    return "Card"
  }

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this payment method?")) {
      deletePaymentMethod(id)
    }
  }

  const handleSetDefault = (id) => {
    setDefaultPaymentMethod(id)
  }

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-red-50/20 p-4 sm:p-6 md:p-8 lg:p-10">
      <div className="max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto space-y-4 sm:space-y-6 md:space-y-8 lg:space-y-10">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Payment Methods</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Manage your payment methods
            </p>
          </div>
          <Link to="/user/profile/payments/new" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto bg-gradient-to-r from-yellow-500 to-red-500 hover:from-yellow-600 hover:to-red-600 text-white text-sm sm:text-base">
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </Link>
        </div>
        {paymentMethods.length === 0 ? (
          <Card className="shadow-lg">
            <CardContent className="py-12 text-center">
              <CreditCard className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No payment methods saved yet</h3>
              <p className="text-muted-foreground mb-6">
                Add your first payment method to get started with orders
              </p>
              <Link to="/user/profile/payments/new">
                <Button className="bg-gradient-to-r from-yellow-500 to-red-500 hover:from-yellow-600 hover:to-red-600 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Payment Method
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-5 lg:gap-6 md:space-y-0">
            {paymentMethods.map((payment) => (
              <Card
                key={payment.id}
                className={`shadow-lg ${
                  payment.isDefault ? "border-yellow-500 border-2 bg-yellow-50/50" : ""
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className={`h-5 w-5 ${payment.isDefault ? "text-yellow-600" : "text-muted-foreground"}`} />
                      {getCardTypeName(payment.type)} Card
                    </CardTitle>
                    {payment.isDefault && (
                      <Badge className="bg-yellow-500 text-white">Default</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-gradient-to-br from-yellow-50 to-red-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{getCardTypeIcon(payment.type)}</span>
                        <div>
                          <p className="font-bold text-xl">{formatCardNumber(payment.cardNumber)}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {payment.cardHolder}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm pt-3 border-t border-yellow-200">
                      <div>
                        <span className="text-muted-foreground">Expires: </span>
                        <span className="font-semibold">
                          {formatExpiry(payment.expiryMonth, payment.expiryYear)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Type: </span>
                        <span className="font-semibold capitalize">{getCardTypeName(payment.type)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap pt-2 border-t">
                    {!payment.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(payment.id)}
                        className="flex items-center gap-1"
                      >
                        <Check className="h-4 w-4" />
                        Set as Default
                      </Button>
                    )}
                    <Link to={`/user/profile/payments/${payment.id}/edit`}>
                      <Button variant="outline" size="sm" className="flex items-center gap-1">
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(payment.id)}
                      className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:border-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AnimatedPage>
  )
}
