import { useState, useMemo } from "react"
import { Bell, Info, Search, Download, ChevronDown, Settings, FileText, FileSpreadsheet, Code, Check, Columns, ArrowUpDown } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { exportNotificationsToCSV, exportNotificationsToExcel, exportNotificationsToPDF, exportNotificationsToJSON } from "@food/components/admin/notifications/notificationsExportUtils"

const adminNotifications = [
  {
    id: 1,
    topic: "Forget Password",
    description: "Choose How ECS Will Get Notified About Sent Notification On Forget Password.",
    pushNotification: "N/A",
    mail: true,
    sms: true
  },
  {
    id: 2,
    topic: "Deliveryman Self Registration",
    description: "Choose How ECS Will Get Notified About Sent Notification On Deliveryman Self Registration.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 3,
    topic: "Restaurant Self Registration",
    description: "Choose How ECS Will Get Notified About Sent Notification On Restaurant Self Registration.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 4,
    topic: "Campaign Join Request",
    description: "Choose How ECS Will Get Notified About Sent Notification On Campaign Join Request.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 5,
    topic: "Withdraw Request",
    description: "Choose How ECS Will Get Notified About Sent Notification On Withdraw Request.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 6,
    topic: "Order Refund Request",
    description: "Choose How ECS Will Get Notified About Sent Notification On Order Refund Request.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 7,
    topic: "Advertisement Add",
    description: "Choose How ECS Will Get Notified About Sent Notification On Advertisement Add.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 8,
    topic: "Advertisement Update",
    description: "Choose How ECS Will Get Notified About Sent Notification On Advertisement Update.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  }
]

const restaurantNotifications = [
  {
    id: 1,
    topic: "New Order Received",
    description: "Choose How Restaurant Will Get Notified About New Order Received.",
    pushNotification: "N/A",
    mail: true,
    sms: true
  },
  {
    id: 2,
    topic: "Order Status Update",
    description: "Choose How Restaurant Will Get Notified About Order Status Updates.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 3,
    topic: "Payment Received",
    description: "Choose How Restaurant Will Get Notified About Payment Received.",
    pushNotification: "N/A",
    mail: true,
    sms: true
  },
  {
    id: 4,
    topic: "Review Received",
    description: "Choose How Restaurant Will Get Notified About Customer Reviews.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 5,
    topic: "Withdrawal Request Status",
    description: "Choose How Restaurant Will Get Notified About Withdrawal Request Status.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 6,
    topic: "Campaign Invitation",
    description: "Choose How Restaurant Will Get Notified About Campaign Invitations.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 7,
    topic: "Order Cancelled",
    description: "Choose How Restaurant Will Get Notified About Order Cancellations.",
    pushNotification: "N/A",
    mail: true,
    sms: true
  },
  {
    id: 8,
    topic: "Food Out of Stock",
    description: "Choose How Restaurant Will Get Notified About Food Items Out of Stock.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  }
]

const customerNotifications = [
  {
    id: 1,
    topic: "Order Confirmation",
    description: "Choose How Customer Will Get Notified About Order Confirmation.",
    pushNotification: "N/A",
    mail: true,
    sms: true
  },
  {
    id: 2,
    topic: "Order Status Update",
    description: "Choose How Customer Will Get Notified About Order Status Updates.",
    pushNotification: "N/A",
    mail: true,
    sms: true
  },
  {
    id: 3,
    topic: "Order Delivered",
    description: "Choose How Customer Will Get Notified About Order Delivery.",
    pushNotification: "N/A",
    mail: true,
    sms: true
  },
  {
    id: 4,
    topic: "Order Cancelled",
    description: "Choose How Customer Will Get Notified About Order Cancellation.",
    pushNotification: "N/A",
    mail: true,
    sms: true
  },
  {
    id: 5,
    topic: "Payment Confirmation",
    description: "Choose How Customer Will Get Notified About Payment Confirmation.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 6,
    topic: "Promotional Offers",
    description: "Choose How Customer Will Get Notified About Promotional Offers.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 7,
    topic: "Refund Processed",
    description: "Choose How Customer Will Get Notified About Refund Processing.",
    pushNotification: "N/A",
    mail: true,
    sms: true
  },
  {
    id: 8,
    topic: "Wallet Transaction",
    description: "Choose How Customer Will Get Notified About Wallet Transactions.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  }
]

const deliverymanNotifications = [
  {
    id: 1,
    topic: "New Order Assignment",
    description: "Choose How Deliveryman Will Get Notified About New Order Assignment.",
    pushNotification: "N/A",
    mail: true,
    sms: true
  },
  {
    id: 2,
    topic: "Order Pickup Request",
    description: "Choose How Deliveryman Will Get Notified About Order Pickup Requests.",
    pushNotification: "N/A",
    mail: true,
    sms: true
  },
  {
    id: 3,
    topic: "Order Delivery Status",
    description: "Choose How Deliveryman Will Get Notified About Order Delivery Status.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 4,
    topic: "Payment Received",
    description: "Choose How Deliveryman Will Get Notified About Payment Received.",
    pushNotification: "N/A",
    mail: true,
    sms: true
  },
  {
    id: 5,
    topic: "Bonus Notification",
    description: "Choose How Deliveryman Will Get Notified About Bonus Notifications.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 6,
    topic: "Incentive Update",
    description: "Choose How Deliveryman Will Get Notified About Incentive Updates.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  },
  {
    id: 7,
    topic: "Shift Reminder",
    description: "Choose How Deliveryman Will Get Notified About Shift Reminders.",
    pushNotification: "N/A",
    mail: true,
    sms: true
  },
  {
    id: 8,
    topic: "Withdrawal Status",
    description: "Choose How Deliveryman Will Get Notified About Withdrawal Status.",
    pushNotification: "N/A",
    mail: true,
    sms: false
  }
]

const tabs = [
  { id: "admin", label: "ECS" },
  { id: "restaurant", label: "Restaurant" },
  { id: "customers", label: "Customers" },
  { id: "deliveryman", label: "Deliveryman" }
]

function ToggleSwitch({ enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center w-11 h-6 rounded-full border transition-all ${
        enabled
          ? "bg-primary border-primary justify-end"
          : "bg-slate-200 border-slate-300 justify-start"
      }`}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
    </button>
  )
}

export default function NotificationChannels() {
  const [activeTab, setActiveTab] = useState("admin")
  const [searchQuery, setSearchQuery] = useState("")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    topics: true,
    pushNotification: true,
    mail: true,
    sms: true,
  })
  
  const getNotificationsForTab = (tab) => {
    switch(tab) {
      case "admin":
        return adminNotifications
      case "restaurant":
        return restaurantNotifications
      case "customers":
        return customerNotifications
      case "deliveryman":
        return deliverymanNotifications
      default:
        return adminNotifications
    }
  }

  const [notifications, setNotifications] = useState(() => getNotificationsForTab("admin"))

  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) {
      return notifications
    }
    
    const query = searchQuery.toLowerCase().trim()
    return notifications.filter(notif =>
      notif.topic.toLowerCase().includes(query) ||
      notif.description.toLowerCase().includes(query)
    )
  }, [notifications, searchQuery])

  // Update notifications when tab changes
  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setNotifications(getNotificationsForTab(tabId))
    setSearchQuery("") // Reset search when changing tabs
  }

  const handleMailToggle = (id) => {
    setNotifications(prev => prev.map(notif => 
      notif.id === id ? { ...notif, mail: !notif.mail } : notif
    ))
  }

  const handleSMSToggle = (id) => {
    setNotifications(prev => prev.map(notif => 
      notif.id === id ? { ...notif, sms: !notif.sms } : notif
    ))
  }

  const handleExport = (format) => {
    if (filteredNotifications.length === 0) {
      alert("No data to export")
      return
    }
    const tabName = activeTab.charAt(0).toUpperCase() + activeTab.slice(1)
    const filename = `notifications_${activeTab}`
    switch (format) {
      case "csv": exportNotificationsToCSV(filteredNotifications, filename); break
      case "excel": exportNotificationsToExcel(filteredNotifications, filename); break
      case "pdf": exportNotificationsToPDF(filteredNotifications, filename); break
      case "json": exportNotificationsToJSON(filteredNotifications, filename); break
    }
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      topics: true,
      pushNotification: true,
      mail: true,
      sms: true,
    })
  }

  const columnsConfig = {
    si: "Serial Number",
    topics: "Topics",
    pushNotification: "Push Notification",
    mail: "Mail",
    sms: "SMS",
  }

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-6xl">
        {/* Page Title */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Bell className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Notification Channels Setup</h1>
          </div>
          <p className="text-xs text-slate-600 ml-9">
            From here you setup who can see what types of notification from StackFood
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search and Actions Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1 min-w-[250px]">
              <input
                type="text"
                placeholder="Search by topic or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-2 py-1.5 w-full text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-4 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1 transition-all">
                  <Download className="w-3.5 h-3.5" />
                  <span className="font-bold">Export</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer">
                  <FileText className="w-4 h-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export as Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer">
                  <FileText className="w-4 h-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("json")} className="cursor-pointer">
                  <Code className="w-4 h-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Notifications</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                {filteredNotifications.length}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {visibleColumns.si && (
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>SI</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.topics && (
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Topics</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.pushNotification && (
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Push Notification</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.mail && (
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>Mail</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                  {visibleColumns.sms && (
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        <span>SMS</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                      </div>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredNotifications.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center">
                      <p className="text-xs text-slate-500">No notifications found</p>
                    </td>
                  </tr>
                ) : (
                  filteredNotifications.map((notification, index) => (
                    <tr key={notification.id} className="hover:bg-slate-50 transition-colors">
                      {visibleColumns.si && (
                        <td className="px-3 py-3">
                          <span className="text-xs text-slate-700">{index + 1}</span>
                        </td>
                      )}
                      {visibleColumns.topics && (
                        <td className="px-3 py-3">
                          <div>
                            <p className="text-xs font-medium text-slate-900 mb-1">
                              {notification.topic}
                            </p>
                            <p className="text-[10px] text-slate-600">
                              {notification.description}
                            </p>
                          </div>
                        </td>
                      )}
                      {visibleColumns.pushNotification && (
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="px-2 py-1 text-[10px] font-medium bg-[#f7f3fc] text-primary rounded hover:bg-[#f0e7f9] transition-colors"
                          >
                            {notification.pushNotification}
                          </button>
                        </td>
                      )}
                      {visibleColumns.mail && (
                        <td className="px-3 py-3">
                          <ToggleSwitch
                            enabled={notification.mail}
                            onToggle={() => handleMailToggle(notification.id)}
                          />
                        </td>
                      )}
                      {visibleColumns.sms && (
                        <td className="px-3 py-3">
                          {notification.sms !== false ? (
                            <ToggleSwitch
                              enabled={notification.sms}
                              onToggle={() => handleSMSToggle(notification.id)}
                            />
                          ) : (
                            <button
                              type="button"
                              className="px-2 py-1 text-[10px] font-medium bg-[#f7f3fc] text-primary rounded hover:bg-[#f0e7f9] transition-colors"
                            >
                              N/A
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Table Settings
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Columns className="w-4 h-4" />
                Visible Columns
              </h3>
              <div className="space-y-2">
                {Object.entries(columnsConfig).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumns[key]}
                      onChange={() => toggleColumn(key)}
                      className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-700">{label}</span>
                    {visibleColumns[key] && (
                      <Check className="w-4 h-4 text-emerald-600 ml-auto" />
                    )}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={resetColumns}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[#6412c6] text-white hover:bg-[#550fa8] transition-all shadow-md"
              >
                Apply
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
