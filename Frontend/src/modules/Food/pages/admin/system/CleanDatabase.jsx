import { useState } from "react"
import { AlertCircle } from "lucide-react"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const databaseTables = [
  // Column 1
  { name: "Account_transactions", count: 8 },
  { name: "Admin_features", count: 4 },
  { name: "Admin_wallets", count: 1 },
  { name: "Allergy_food", count: 4 },
  { name: "Attributes", count: 3 },
  { name: "Cache_locks", count: 0 },
  { name: "Carts", count: 3 },
  { name: "Categories", count: 29 },
  { name: "Contact_messages", count: 0 },
  { name: "Cuisine_restaurant", count: 11 },
  { name: "D_m_reviews", count: 2 },
  { name: "Delivery_men", count: 9 },
  { name: "Disbursements", count: 2 },
  { name: "Employee_roles", count: 1 },
  { name: "Food", count: 73 },
  { name: "Food_tag", count: 13 },
  { name: "Incentives", count: 4 },
  { name: "Logs", count: 0 },
  { name: "Newsletters", count: 1 },
  { name: "Nutritions", count: 2 },
  { name: "Order_cancel_reasons", count: 9 },
  { name: "Order_edit_logs", count: 0 },
  { name: "Order_taxes", count: 8 },
  { name: "Page_seo_data", count: 14 },
  { name: "Provide_d_m_earnings", count: 7 },
  { name: "React_faqs", count: 8 },
  { name: "React_promotional_ba...", count: 3 },
  { name: "React_services", count: 3 },
  { name: "Recent_searches", count: 0 },
  { name: "Refund_reasons", count: 4 },
  { name: "Restaurant_configs", count: 9 },
  { name: "Restaurant_tag", count: 0 },
  { name: "Reviews", count: 10 },
  { name: "Subscription_billing...", count: 0 },
  { name: "Subscription_pauses", count: 0 },
  { name: "Subscriptions", count: 5 },
  { name: "Tax_additional_setup...", count: 1 },
  { name: "Time_logs", count: 2 },
  { name: "User_notifications", count: 447 },
  { name: "Vehicles", count: 2 },
  { name: "Wallet_bonuses", count: 2 },
  { name: "Websockets_statistic...", count: 0 },
  { name: "Withdrawal_methods", count: 2 },
  
  // Column 2
  { name: "Add_ons", count: 40 },
  { name: "Admin_special_criter...", count: 0 },
  { name: "Advertisements", count: 5 },
  { name: "Allergy_item_campaig...", count: 0 },
  { name: "Banners", count: 6 },
  { name: "Campaign_restaurant", count: 10 },
  { name: "Cash_back_histories", count: 2 },
  { name: "Characteristic_resta...", count: 30 },
  { name: "Conversations", count: 2 },
  { name: "Cuisines", count: 8 },
  { name: "Delivery_histories", count: 0 },
  { name: "Disbursement_details", count: 10 },
  { name: "Discounts", count: 3 },
  { name: "Expenses", count: 45 },
  { name: "Food_nutrition", count: 7 },
  { name: "Guests", count: 65 },
  { name: "Item_campaign_nutrit...", count: 0 },
  { name: "Loyalty_point_transa...", count: 36 },
  { name: "Notification_message...", count: 11 },
  { name: "Offline_payment_meth...", count: 1 },
  { name: "Order_delivery_histo...", count: 0 },
  { name: "Order_payments", count: 0 },
  { name: "Order_transactions", count: 56 },
  { name: "Payment_requests", count: 7 },
  { name: "React_opportunities", count: 4 },
  { name: "React_testimonials", count: 5 },
  { name: "Restaurant_schedule", count: 105 },
  { name: "Restaurant_wallets", count: 15 },
  { name: "Shifts", count: 3 },
  { name: "Subscription_logs", count: 5 },
  { name: "Subscription_schedul...", count: 5 },
  { name: "System_tax_setups", count: 1 },
  { name: "Taxables", count: 0 },
  { name: "Track_deliverymen", count: 0 },
  { name: "Variation_options", count: 42 },
  { name: "Vendors", count: 16 },
  { name: "Wallet_payments", count: 2 },
  { name: "Wishlists", count: 67 },
  { name: "Zones", count: 1 },
  
  // Column 3
  { name: "Addon_categories", count: 4 },
  { name: "Admin_testimonials", count: 4 },
  { name: "Allergies", count: 2 },
  { name: "Analytic_scripts", count: 0 },
  { name: "Cache", count: 51 },
  { name: "Campaigns", count: 3 },
  { name: "Cash_backs", count: 2 },
  { name: "Characteristics", count: 16 },
  { name: "Coupons", count: 4 },
  { name: "Customer_addresses", count: 12 },
  { name: "Delivery_man_wallets", count: 8 },
  { name: "Disbursement_withdra...", count: 12 },
  { name: "Email_templates", count: 47 },
  { name: "F_a_q_s", count: 6 },
  { name: "Food_seo_data", count: 0 },
  { name: "Incentive_logs", count: 7 },
  { name: "Item_campaigns", count: 6 },
  { name: "Messages", count: 10 },
  { name: "Notifications", count: 18 },
  { name: "Offline_payments", count: 0 },
  { name: "Order_details", count: 204 },
  { name: "Order_references", count: 0 },
  { name: "Orders", count: 167 },
  { name: "Priority_lists", count: 26 },
  { name: "Refunds", count: 3 },
  { name: "Restaurant_subscript...", count: 5 },
  { name: "Restaurants", count: 16 },
  { name: "Social_media", count: 5 },
  { name: "Subscription_package...", count: 3 },
  { name: "Subscription_transac...", count: 6 },
  { name: "Tags", count: 8 },
  { name: "Taxes", count: 3 },
  { name: "User_infos", count: 8 },
  { name: "Variations", count: 16 },
  { name: "Visitor_logs", count: 87 },
  { name: "Wallet_transactions", count: 4 },
  { name: "Withdraw_requests", count: 2 }
]

export default function CleanDatabase() {
  const [selectedTables, setSelectedTables] = useState(new Set())

  const handleToggleTable = (tableName) => {
    setSelectedTables(prev => {
      const newSet = new Set(prev)
      if (newSet.has(tableName)) {
        newSet.delete(tableName)
      } else {
        newSet.add(tableName)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedTables.size === databaseTables.length) {
      setSelectedTables(new Set())
    } else {
      setSelectedTables(new Set(databaseTables.map(t => t.name)))
    }
  }

  const handleClear = () => {
    if (selectedTables.size === 0) {
      alert("Please select at least one table to clear.")
      return
    }
    const confirmMessage = `Are you sure you want to clear ${selectedTables.size} table(s)? This action cannot be undone.`
    if (window.confirm(confirmMessage)) {
      debugLog("Clearing tables:", Array.from(selectedTables))
      alert("Database cleared successfully!")
      setSelectedTables(new Set())
    }
  }

  // Split tables into 3 columns
  const column1 = databaseTables.slice(0, 42)
  const column2 = databaseTables.slice(42, 84)
  const column3 = databaseTables.slice(84)

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-7xl">
        {/* Page Title */}
        <div className="mb-3">
          <h1 className="text-lg font-bold text-slate-900">Clean Database</h1>
        </div>

        {/* Warning Banner */}
        <div className="bg-red-500 rounded-lg p-3 mb-4 flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-3 h-3 text-red-500" />
          </div>
          <p className="text-xs text-white">
            Note: This page contains sensitive information. Please make sure before click the button.
          </p>
        </div>

        {/* Database Tables Grid */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Column 1 */}
            <div className="space-y-2">
              {column1.map((table) => (
                <div
                  key={table.name}
                  className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
                  onClick={() => handleToggleTable(table.name)}
                >
                  <input
                    type="checkbox"
                    checked={selectedTables.has(table.name)}
                    onChange={() => handleToggleTable(table.name)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 flex-1">{table.name}</span>
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-200 text-slate-700 rounded-full">
                    {table.count}
                  </span>
                </div>
              ))}
            </div>

            {/* Column 2 */}
            <div className="space-y-2">
              {column2.map((table) => (
                <div
                  key={table.name}
                  className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
                  onClick={() => handleToggleTable(table.name)}
                >
                  <input
                    type="checkbox"
                    checked={selectedTables.has(table.name)}
                    onChange={() => handleToggleTable(table.name)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 flex-1">{table.name}</span>
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-200 text-slate-700 rounded-full">
                    {table.count}
                  </span>
                </div>
              ))}
            </div>

            {/* Column 3 */}
            <div className="space-y-2">
              {column3.map((table) => (
                <div
                  key={table.name}
                  className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
                  onClick={() => handleToggleTable(table.name)}
                >
                  <input
                    type="checkbox"
                    checked={selectedTables.has(table.name)}
                    onChange={() => handleToggleTable(table.name)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-700 flex-1">{table.name}</span>
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-200 text-slate-700 rounded-full">
                    {table.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Clear Button */}
        <div className="flex justify-end">
          <button
            onClick={handleClear}
            className="px-6 py-2.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}

