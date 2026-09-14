import { createContext, useContext } from "react"

const SellerOrdersContext = createContext({
  orders: [],
  ordersLoading: false,
  refreshOrders: () => {},
})

export const useSellerOrders = () => useContext(SellerOrdersContext)

export default SellerOrdersContext
