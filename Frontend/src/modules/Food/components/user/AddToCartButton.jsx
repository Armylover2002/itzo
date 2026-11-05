import { Plus, Minus } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { useCart } from "@food/context/CartContext"

export default function AddToCartButton({ item, className = "" }) {
  const { addToCart, isInCart, getCartItem, updateQuantity } = useCart()
  const inCart = isInCart(item.id)
  const cartItem = getCartItem(item.id)

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()

    // Guests can build a cart; login is asked when they place the order (Cart page).
    addToCart(item)
  }

  const handleIncrease = (e) => {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(item.id, (cartItem?.quantity || 0) + 1)
  }

  const handleDecrease = (e) => {
    e.preventDefault()
    e.stopPropagation()
    updateQuantity(item.id, (cartItem?.quantity || 0) - 1)
  }

  if (inCart) {
    return (
      <div className={`flex items-center gap-2 ${className}`} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
        <div className="flex items-center gap-1 border border-primary-orange rounded-md">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-6 hover:bg-gray-100"
            onClick={handleDecrease}
          >
            <Minus className="h-4 w-4" />
          </Button>
          <span className="px-1 text-sm font-semibold min-w-[1rem] text-center">
            {cartItem?.quantity || 0}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-6 hover:bg-gray-100"
            onClick={handleIncrease}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      onClick={handleAddToCart}
      className="bg-primary-orange hover:opacity-90 text-white"
    >
      Add to Cart
    </Button>
  )
}
