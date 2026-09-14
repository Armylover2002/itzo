import { useParams, useNavigate } from "react-router-dom"
import AddCouponPage from "./AddCouponPage"

export default function EditCouponPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  // If no id, just go back to coupon list
  if (!id) {
    navigate("/restaurant/coupon")
    return null
  }

  return <AddCouponPage mode="edit" couponId={id} />
}
