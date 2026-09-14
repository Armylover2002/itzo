import { useState } from "react"
import { Info } from "lucide-react"
import mobileImage1 from "@food/assets/Transaction-report-icons/mobile_image1.png"
import mobileImage2 from "@food/assets/Transaction-report-icons/mobile_image2.png"

export default function ThemeSettings() {
  const [selectedTheme, setSelectedTheme] = useState("theme1")

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Change Theme For User App</h1>
            <Info className="w-5 h-5 text-slate-400" />
          </div>
        </div>

        {/* Mobile Screens Comparison */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Mobile Screen - Theme 1 */}
            <div className="flex flex-col items-center">
              <div 
                className="relative cursor-pointer border-4 border-slate-300 rounded-[2.5rem] bg-white shadow-xl overflow-hidden"
                style={{ width: "280px", height: "600px" }}
                onClick={() => setSelectedTheme("theme1")}
              >
                <img 
                  src={mobileImage1} 
                  alt="Theme 1" 
                  className="w-full h-full object-contain"
                />
              </div>
              {selectedTheme === "theme1" && (
                <div className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                  Selected
                </div>
              )}
            </div>

            {/* Right Mobile Screen - Theme 2 */}
            <div className="flex flex-col items-center">
              <div 
                className="relative cursor-pointer border-4 border-slate-300 rounded-[2.5rem] bg-white shadow-xl overflow-hidden"
                style={{ width: "280px", height: "600px" }}
                onClick={() => setSelectedTheme("theme2")}
              >
                <img 
                  src={mobileImage2} 
                  alt="Theme 2" 
                  className="w-full h-full object-contain"
                />
              </div>
              {selectedTheme === "theme2" && (
                <div className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                  Selected
                </div>
              )}
            </div>
          </div>

          {/* Apply Button */}
          <div className="flex justify-end mt-6">
            <button className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
