import { useState, useMemo } from "react"
import { Monitor, Info, Check, Copy, Edit, ExternalLink, Settings, ArrowUpDown, Columns } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const panelLoginUrls = [
  {
    id: 1,
    panelName: "ECS Panel",
    loginUrl: "https://admin.stackfood.com/login",
    status: "active"
  },
  {
    id: 2,
    panelName: "Restaurant Panel",
    loginUrl: "https://restaurant.stackfood.com/login",
    status: "active"
  },
  {
    id: 3,
    panelName: "Deliveryman Panel",
    loginUrl: "https://delivery.stackfood.com/login",
    status: "active"
  },
  {
    id: 4,
    panelName: "Customer Panel",
    loginUrl: "https://app.stackfood.com/login",
    status: "active"
  }
]

export default function LoginSetup() {
  const [activeTab, setActiveTab] = useState("customer-login")
  const [loginOptions, setLoginOptions] = useState({
    manualLogin: true,
    otpLogin: true,
    socialMediaLogin: true
  })
  const [socialMedia, setSocialMedia] = useState({
    google: true,
    facebook: false,
    apple: false
  })
  const [verification, setVerification] = useState({
    emailVerification: true,
    phoneVerification: true
  })
  const [panelUrls, setPanelUrls] = useState(panelLoginUrls)
  const [editingId, setEditingId] = useState(null)
  const [editUrl, setEditUrl] = useState("")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    panelName: true,
    loginUrl: true,
    status: true,
    actions: true,
  })

  const handleLoginOptionChange = (option) => {
    setLoginOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }))
  }

  const handleSocialMediaChange = (platform) => {
    setSocialMedia(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }))
  }

  const handleVerificationChange = (type) => {
    setVerification(prev => ({
      ...prev,
      [type]: !prev[type]
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (activeTab === "customer-login") {
      debugLog("Form submitted:", { loginOptions, socialMedia, verification })
    } else {
      debugLog("Panel URLs submitted:", panelUrls)
    }
    alert("Settings saved successfully!")
  }

  const handleReset = () => {
    if (activeTab === "customer-login") {
      setLoginOptions({
        manualLogin: true,
        otpLogin: true,
        socialMediaLogin: true
      })
      setSocialMedia({
        google: true,
        facebook: false,
        apple: false
      })
      setVerification({
        emailVerification: true,
        phoneVerification: true
      })
    } else {
      setPanelUrls(panelLoginUrls)
      setEditingId(null)
      setEditUrl("")
    }
  }

  const handleCopyUrl = (url) => {
    navigator.clipboard.writeText(url)
    alert("URL copied to clipboard!")
  }

  const handleEditUrl = (id, currentUrl) => {
    setEditingId(id)
    setEditUrl(currentUrl)
  }

  const handleSaveUrl = (id) => {
    setPanelUrls(prev => prev.map(panel => 
      panel.id === id ? { ...panel, loginUrl: editUrl } : panel
    ))
    setEditingId(null)
    setEditUrl("")
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditUrl("")
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      panelName: true,
      loginUrl: true,
      status: true,
      actions: true,
    })
  }

  const columnsConfig = {
    si: "Serial Number",
    panelName: "Panel Name",
    loginUrl: "Login Page URL",
    status: "Status",
    actions: "Actions",
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#9359d7] to-[#550fa8] flex items-center justify-center">
              <Monitor className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Login Setup</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("customer-login")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "customer-login"
                  ? "bg-[#6412c6] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Customer Login
            </button>
            <button
              onClick={() => setActiveTab("panel-login")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "panel-login"
                  ? "bg-[#6412c6] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Panel login page Url
            </button>
          </div>
        </div>

        {/* Customer Login Content */}
        {activeTab === "customer-login" && (
          <div className="space-y-6">
            {/* Setup Login Option */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <p className="text-sm text-slate-600 mb-4">
                The option you select customer will have the option to login
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { key: "manualLogin", label: "Manual Login", icon: "??" },
                  { key: "otpLogin", label: "OTP Login", icon: "??" },
                  { key: "socialMediaLogin", label: "Social Media Login", icon: "??" }
                ].map((option) => (
                  <div
                    key={option.key}
                    onClick={() => handleLoginOptionChange(option.key)}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      loginOptions[option.key]
                        ? "border-[#6412c6] bg-[#f7f3fc]"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{option.icon}</span>
                        <span className="text-sm font-semibold text-slate-700">{option.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleLoginOptionChange(option.key)
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#6412c6] focus:ring-offset-2 ${
                            loginOptions[option.key] ? "bg-[#6412c6]" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              loginOptions[option.key] ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                        <Info className="w-4 h-4 text-slate-400 cursor-help" title="Toggle this option" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Social Media Login Setup */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <p className="text-sm text-slate-600 mb-4">
                <a href="#" className="text-[#6412c6] hover:text-[#550fa8] hover:underline">
                  Connect 3rd party login system from here
                </a>
              </p>
              
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Choose social media</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { key: "google", label: "Google", icon: "??", color: "blue" },
                    { key: "facebook", label: "Facebook", icon: "??", color: "blue" },
                    { key: "apple", label: "Apple", icon: "?", color: "black" }
                  ].map((platform) => (
                    <div
                      key={platform.key}
                      onClick={() => handleSocialMediaChange(platform.key)}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        socialMedia[platform.key]
                          ? "border-[#6412c6] bg-[#f7f3fc]"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{platform.icon}</span>
                          <span className="text-sm font-semibold text-slate-700">{platform.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSocialMediaChange(platform.key)
                            }}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#6412c6] focus:ring-offset-2 ${
                              socialMedia[platform.key] ? "bg-[#6412c6]" : "bg-slate-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                socialMedia[platform.key] ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                          <Info className="w-4 h-4 text-slate-400 cursor-help" title="Toggle this option" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Verification */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <p className="text-sm text-slate-600 mb-4">
                The option you select from below will need to verify by customer from customer app/website.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "emailVerification", label: "Email Verification", icon: "??" },
                  { key: "phoneVerification", label: "Phone Number Verification", icon: "??" }
                ].map((verify) => (
                  <div
                    key={verify.key}
                    onClick={() => handleVerificationChange(verify.key)}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                      verification[verify.key]
                        ? "border-[#6412c6] bg-[#f7f3fc]"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{verify.icon}</span>
                        <span className="text-sm font-semibold text-slate-700">{verify.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleVerificationChange(verify.key)
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#6412c6] focus:ring-offset-2 ${
                            verification[verify.key] ? "bg-[#6412c6]" : "bg-slate-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              verification[verify.key] ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                        <Info className="w-4 h-4 text-slate-400 cursor-help" title="Toggle this option" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Panel Login Content */}
        {activeTab === "panel-login" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Manage login page URLs for different panels. You can edit and copy the URLs as needed.
              </p>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {visibleColumns.si && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>SI</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.panelName && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Panel Name</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.loginUrl && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Login Page URL</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>Status</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.actions && (
                      <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {panelUrls.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center text-slate-500">
                        No panels found
                      </td>
                    </tr>
                  ) : (
                    panelUrls.map((panel, index) => (
                      <tr key={panel.id} className="hover:bg-slate-50 transition-colors">
                        {visibleColumns.si && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-700">{index + 1}</span>
                          </td>
                        )}
                        {visibleColumns.panelName && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-900">{panel.panelName}</span>
                          </td>
                        )}
                        {visibleColumns.loginUrl && (
                          <td className="px-6 py-4">
                            {editingId === panel.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editUrl}
                                  onChange={(e) => setEditUrl(e.target.value)}
                                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6412c6] focus:border-[#6412c6]"
                                  placeholder="Enter login URL"
                                />
                                <button
                                  onClick={() => handleSaveUrl(panel.id)}
                                  className="px-3 py-2 text-sm bg-[#6412c6] text-white rounded-lg hover:bg-[#550fa8] transition-colors"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="px-3 py-2 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-600 break-all">{panel.loginUrl}</span>
                                <a
                                  href={panel.loginUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#6412c6] hover:text-[#550fa8]"
                                  title="Open in new tab"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            )}
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                              {panel.status}
                            </span>
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              {editingId !== panel.id && (
                                <>
                                  <button
                                    onClick={() => handleEditUrl(panel.id, panel.loginUrl)}
                                    className="p-1.5 rounded text-[#6412c6] hover:bg-[#f7f3fc] transition-colors"
                                    title="Edit URL"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleCopyUrl(panel.loginUrl)}
                                    className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors"
                                    title="Copy URL"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-[#6412c6] text-white rounded-lg hover:bg-[#550fa8] transition-colors font-medium"
          >
            Submit
          </button>
        </div>
      </div>

      {/* Settings Dialog */}
      {activeTab === "panel-login" && (
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Table Settings
              </DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
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
                        className="w-4 h-4 text-[#6412c6] border-slate-300 rounded focus:ring-[#6412c6]"
                      />
                      <span className="text-sm text-slate-700">{label}</span>
                      {visibleColumns[key] && (
                        <Check className="w-4 h-4 text-[#6412c6] ml-auto" />
                      )}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  onClick={resetColumns}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Reset
                </button>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[#6412c6] text-white hover:bg-[#550fa8] transition-all shadow-md"
                >
                  Apply
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

