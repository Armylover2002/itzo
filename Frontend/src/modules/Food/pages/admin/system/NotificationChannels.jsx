import { useEffect, useMemo, useState } from "react"
import { Bell, Search, Download, ChevronDown, Settings, FileText, FileSpreadsheet, Code, Check, Columns, ArrowUpDown, Loader2, Save } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@food/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { exportNotificationsToCSV, exportNotificationsToExcel, exportNotificationsToPDF, exportNotificationsToJSON } from "@food/components/admin/notifications/notificationsExportUtils"
import { adminAPI } from "@food/api"

const tabs = [
  { id: "admin", label: "Admin" },
  { id: "restaurant", label: "Restaurant" },
  { id: "customers", label: "Customers" },
  { id: "deliveryman", label: "Deliveryman" }
]

function ToggleSwitch({ enabled, onToggle, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${enabled ? "bg-blue-600" : "bg-slate-200"}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  )
}

const mapApiTopics = (topics = []) =>
  (Array.isArray(topics) ? topics : []).map((item, index) => ({
    id: item.key || item.id || index + 1,
    key: item.key || String(item.id || index + 1),
    topic: item.topic || item.title || "Topic",
    description: item.description || "",
    pushNotification: item.pushAvailable === false || item.push === "N/A" ? "N/A" : Boolean(item.channels?.push ?? item.push),
    mail: item.mailAvailable === false || item.mail === "N/A" ? "N/A" : Boolean(item.channels?.mail ?? item.mail),
    sms: item.smsAvailable === false || item.sms === "N/A" ? "N/A" : Boolean(item.channels?.sms ?? item.sms),
    inApp: Boolean(item.channels?.inApp ?? item.inApp ?? true),
    pushAvailable: item.pushAvailable !== false && item.push !== "N/A",
    mailAvailable: item.mailAvailable !== false && item.mail !== "N/A",
    smsAvailable: item.smsAvailable !== false && item.sms !== "N/A",
  }))

export default function NotificationChannels() {
  const [activeTab, setActiveTab] = useState("admin")
  const [searchQuery, setSearchQuery] = useState("")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")
  const [error, setError] = useState("")
  const [dirty, setDirty] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    topics: true,
    pushNotification: true,
    mail: true,
    sms: true,
  })
  const [notifications, setNotifications] = useState([])

  const loadChannels = async (role = activeTab) => {
    try {
      setLoading(true)
      setError("")
      setSaveMessage("")
      const response = await adminAPI.getNotificationChannels({ role })
      const payload = response?.data?.data || {}
      const topics = payload?.topics || payload?.roles?.find((item) => item.role === role)?.topics || []
      setNotifications(mapApiTopics(topics))
      setDirty(false)
    } catch (err) {
      setNotifications([])
      setError(err?.response?.data?.message || err?.message || "Failed to load notification channels")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadChannels(activeTab)
  }, [activeTab])

  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) return notifications
    const query = searchQuery.toLowerCase().trim()
    return notifications.filter(
      (notif) =>
        notif.topic.toLowerCase().includes(query) ||
        notif.description.toLowerCase().includes(query)
    )
  }, [notifications, searchQuery])

  const handleTabChange = (tabId) => {
    if (dirty && !window.confirm("You have unsaved changes. Switch tab anyway?")) return
    setActiveTab(tabId)
    setSearchQuery("")
  }

  const handleMailToggle = (key) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.key === key && notif.mailAvailable
          ? { ...notif, mail: !notif.mail }
          : notif
      )
    )
    setDirty(true)
    setSaveMessage("")
  }

  const handleSMSToggle = (key) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.key === key && notif.smsAvailable
          ? { ...notif, sms: !notif.sms }
          : notif
      )
    )
    setDirty(true)
    setSaveMessage("")
  }

  const handlePushToggle = (key) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.key === key && notif.pushAvailable
          ? { ...notif, pushNotification: !notif.pushNotification }
          : notif
      )
    )
    setDirty(true)
    setSaveMessage("")
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError("")
      setSaveMessage("")
      await adminAPI.updateNotificationChannels(
        activeTab,
        notifications.map((item) => ({
          key: item.key,
          channels: {
            push: item.pushAvailable ? Boolean(item.pushNotification) : false,
            mail: item.mailAvailable ? Boolean(item.mail) : false,
            sms: item.smsAvailable ? Boolean(item.sms) : false,
            inApp: Boolean(item.inApp),
          },
        }))
      )
      setDirty(false)
      setSaveMessage("Channel preferences saved. Broadcast Push / In-App delivery will respect these settings.")
      await loadChannels(activeTab)
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to save notification channels")
    } finally {
      setSaving(false)
    }
  }

  const handleExport = (format) => {
    if (filteredNotifications.length === 0) {
      alert("No data to export")
      return
    }
    const filename = `notifications_${activeTab}`
    const exportRows = filteredNotifications.map((item) => ({
      ...item,
      pushNotification: item.pushAvailable ? (item.pushNotification ? "On" : "Off") : "N/A",
      mail: item.mailAvailable ? Boolean(item.mail) : false,
      sms: item.smsAvailable ? Boolean(item.sms) : false,
    }))
    switch (format) {
      case "csv": exportNotificationsToCSV(exportRows, filename); break
      case "excel": exportNotificationsToExcel(exportRows, filename); break
      case "pdf": exportNotificationsToPDF(exportRows, filename); break
      case "json": exportNotificationsToJSON(exportRows, filename); break
    }
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns((prev) => ({ ...prev, [columnKey]: !prev[columnKey] }))
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
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
              <Bell className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Notification Channels Setup</h1>
          </div>
          <p className="text-xs text-slate-600 ml-9">
            Configure which channels are used for each notification topic. Push and In-App settings are enforced on admin broadcasts.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1 min-w-[250px]">
              <input
                type="text"
                placeholder="Search by topic or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-2 py-1.5 w-full text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          {saveMessage ? <p className="mt-2 text-xs text-emerald-600">{saveMessage}</p> : null}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">Notifications</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                {filteredNotifications.length}
              </span>
              {dirty ? (
                <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
                  Unsaved changes
                </span>
              ) : null}
            </div>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-10 text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading channel settings...
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {visibleColumns.si && (
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>SI</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.topics && (
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Topics</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.pushNotification && (
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        Push Notification
                      </th>
                    )}
                    {visibleColumns.mail && (
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        Mail
                      </th>
                    )}
                    {visibleColumns.sms && (
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        SMS
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredNotifications.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="px-6 py-8 text-center">
                        <p className="text-xs text-slate-500">No notifications found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredNotifications.map((notification, index) => (
                      <tr key={notification.key} className="hover:bg-slate-50 transition-colors">
                        {visibleColumns.si && (
                          <td className="px-3 py-3">
                            <span className="text-xs text-slate-700">{index + 1}</span>
                          </td>
                        )}
                        {visibleColumns.topics && (
                          <td className="px-3 py-3">
                            <div>
                              <p className="text-xs font-medium text-slate-900 mb-1">{notification.topic}</p>
                              <p className="text-[10px] text-slate-600">{notification.description}</p>
                            </div>
                          </td>
                        )}
                        {visibleColumns.pushNotification && (
                          <td className="px-3 py-3">
                            {notification.pushAvailable ? (
                              <ToggleSwitch
                                enabled={Boolean(notification.pushNotification)}
                                onToggle={() => handlePushToggle(notification.key)}
                              />
                            ) : (
                              <span className="px-2 py-1 text-[10px] font-medium bg-blue-50 text-blue-600 rounded">
                                N/A
                              </span>
                            )}
                          </td>
                        )}
                        {visibleColumns.mail && (
                          <td className="px-3 py-3">
                            {notification.mailAvailable ? (
                              <ToggleSwitch
                                enabled={Boolean(notification.mail)}
                                onToggle={() => handleMailToggle(notification.key)}
                              />
                            ) : (
                              <span className="px-2 py-1 text-[10px] font-medium bg-blue-50 text-blue-600 rounded">
                                N/A
                              </span>
                            )}
                          </td>
                        )}
                        {visibleColumns.sms && (
                          <td className="px-3 py-3">
                            {notification.smsAvailable ? (
                              <ToggleSwitch
                                enabled={Boolean(notification.sms)}
                                onToggle={() => handleSMSToggle(notification.key)}
                              />
                            ) : (
                              <span className="px-2 py-1 text-[10px] font-medium bg-blue-50 text-blue-600 rounded">
                                N/A
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

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
                    {visibleColumns[key] && <Check className="w-4 h-4 text-emerald-600 ml-auto" />}
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
                className="px-4 py-2 text-xs font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-md"
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
