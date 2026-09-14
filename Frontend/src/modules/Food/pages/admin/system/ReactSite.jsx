import { useState } from "react"
import { X, Monitor } from "lucide-react"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function ReactSite() {
  const [reactLicenseCode, setReactLicenseCode] = useState("")
  const [reactDomain, setReactDomain] = useState("")
  const [showWarning, setShowWarning] = useState(true)

  const handleSave = (e) => {
    e.preventDefault()
    debugLog("Saving React Site:", { reactLicenseCode, reactDomain })
    alert("React Site settings saved successfully!")
  }

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-5xl">
        {/* Page Title */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-slate-600" />
            <h1 className="text-lg font-bold text-slate-900">React Site Setup</h1>
          </div>
        </div>

        {/* Warning Banner */}
        {showWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start justify-between gap-3">
            <p className="text-xs text-slate-700 flex-1">
              Please check if your domain is register or not at 6amTech Store .{" "}
              <a href="#" className="text-blue-600 hover:underline">
                Click here
              </a>{" "}
              To login in Store.
            </p>
            <button
              type="button"
              onClick={() => setShowWarning(false)}
              className="p-1 hover:bg-amber-100 rounded transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        )}

        {/* Form Section */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  React License Code
                </label>
                <input
                  type="text"
                  value={reactLicenseCode}
                  onChange={(e) => setReactLicenseCode(e.target.value)}
                  placeholder="React license code"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  React Domain
                </label>
                <input
                  type="text"
                  value={reactDomain}
                  onChange={(e) => setReactDomain(e.target.value)}
                  placeholder="React Domain"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

