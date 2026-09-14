import { useState } from "react"
import { ChevronDown, Settings } from "lucide-react"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const addons = [
  {
    id: 1,
    title: "Restaurant app",
    description: "With this app your vendor will mange their business through mobile app",
    enabled: true,
    hasSettings: true
  },
  {
    id: 2,
    title: "Deliveryman app",
    description: "With this app your all your deliveryman will mange their orders through mobile app",
    enabled: false,
    hasSettings: false
  },
  {
    id: 3,
    title: "React user website",
    description: "With this react website your customers will experience your system in a more attractive and seamless way",
    enabled: false,
    hasSettings: false
  }
]

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

export default function AddonActivation() {
  const [addonStates, setAddonStates] = useState(
    addons.reduce((acc, addon) => {
      acc[addon.id] = addon.enabled
      return acc
    }, {})
  )

  const handleToggle = (id) => {
    setAddonStates(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const handleView = (id) => {
    debugLog("View addon:", id)
  }

  const handleSettings = (id) => {
    debugLog("Settings for addon:", id)
  }

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-5xl">
        {/* Page Title */}
        <div className="mb-4">
          <h1 className="text-lg font-bold text-slate-900">Add on activation</h1>
        </div>

        {/* Addon Cards */}
        <div className="space-y-3">
          {addons.map((addon) => (
            <div
              key={addon.id}
              className="bg-white rounded-lg shadow-sm border border-slate-200 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Title and Description */}
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-slate-900 mb-1">
                    {addon.title}
                  </h2>
                  <p className="text-xs text-slate-600">
                    {addon.description}
                  </p>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-3">
                  {/* View Dropdown */}
                  <button
                    type="button"
                    onClick={() => handleView(addon.id)}
                    className="flex items-center gap-1 text-xs text-slate-700 hover:text-slate-900"
                  >
                    <span>View</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {/* Toggle Switch */}
                  <ToggleSwitch
                    enabled={addonStates[addon.id]}
                    onToggle={() => handleToggle(addon.id)}
                  />

                  {/* Settings Icon (only for Restaurant app) */}
                  {addon.hasSettings && (
                    <button
                      type="button"
                      onClick={() => handleSettings(addon.id)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

