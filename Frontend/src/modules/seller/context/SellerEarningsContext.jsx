import { createContext, useContext } from "react"

export const defaultEarnings = {
  balances: {},
  ledger: [],
  monthlyChart: [],
}

const SellerEarningsContext = createContext({
  earningsData: defaultEarnings,
  earningsLoading: false,
  refreshEarnings: () => {},
})

export const useSellerEarnings = () => useContext(SellerEarningsContext)

export default SellerEarningsContext
