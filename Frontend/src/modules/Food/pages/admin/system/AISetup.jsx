import { useState } from "react"
import { Bot, Settings, Info, Store } from "lucide-react"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


function ToggleSwitch({ enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
        enabled ? "bg-blue-600" : "bg-slate-200"
      }`}
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

export default function AISetup() {
  const [activeTab, setActiveTab] = useState("ai-configuration")
  const [isEnabled, setIsEnabled] = useState(true)
  const [apiKey, setApiKey] = useState("")
  const [organization, setOrganization] = useState("")
  const [sectionWiseLimit, setSectionWiseLimit] = useState("60")
  const [imageUploadLimit, setImageUploadLimit] = useState("20")

  const handleReset = () => {
    setApiKey("")
    setOrganization("")
  }

  const handleAIConfigSave = (e) => {
    e.preventDefault()
    debugLog("Saving AI Configuration:", { apiKey, organization, isEnabled })
    alert("AI Configuration saved successfully!")
  }

  const handleAISettingsReset = () => {
    setSectionWiseLimit("60")
    setImageUploadLimit("20")
  }

  const handleAISettingsSave = (e) => {
    e.preventDefault()
    debugLog("Saving AI Settings:", { sectionWiseLimit, imageUploadLimit })
    alert("AI Settings saved successfully!")
  }

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-5xl">
        {/* Page Title */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">OpenAI Configuration</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("ai-configuration")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "ai-configuration"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              AI Configuration
            </button>
            <button
              onClick={() => setActiveTab("ai-settings")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "ai-settings"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              AI Settings
            </button>
          </div>
        </div>

        {/* AI Configuration Content */}
        {activeTab === "ai-configuration" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-600" />
                <h2 className="text-sm font-semibold text-slate-900">OpenAI Configuration</h2>
              </div>
              <a
                href="#"
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                How it Works
                <Info className="w-3 h-3" />
              </a>
            </div>

            <form onSubmit={handleAIConfigSave}>
              {/* Toggle Switch */}
              <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-lg">
                <span className="text-xs font-medium text-slate-700">Turn OFF</span>
                <ToggleSwitch
                  enabled={isEnabled}
                  onToggle={() => setIsEnabled(!isEnabled)}
                />
              </div>

              {/* API Key Input */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  OpenAI API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Ex: sk-proj-K0LhsdcbHJ......."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Organization Input */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  OpenAI Organization
                </label>
                <input
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Ex: org-xxxxxxxxxxxx"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        )}

        {/* AI Settings Content */}
        {activeTab === "ai-settings" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <form onSubmit={handleAISettingsSave}>
              {/* Restaurant Limits Section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Store className="w-4 h-4 text-slate-600" />
                  <h2 className="text-sm font-semibold text-slate-900">Restaurant Limits On Using AI</h2>
                </div>

                {/* Section Wise Data Generation */}
                <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-600 mb-3">
                    Set how many times AI can generate data for each element of the restaurant panel or app.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Section Wise Data Generation Limit
                    </label>
                    <input
                      type="number"
                      value={sectionWiseLimit}
                      onChange={(e) => setSectionWiseLimit(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Image Based Data Generation */}
                <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-600 mb-3">
                    Set how many times AI can generate data from an image upload.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Image Upload Generation Limit
                    </label>
                    <input
                      type="number"
                      value={imageUploadLimit}
                      onChange={(e) => setImageUploadLimit(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleAISettingsReset}
                  className="px-4 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Information
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

