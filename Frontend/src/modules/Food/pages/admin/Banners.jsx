import { useState, useMemo, useEffect } from "react"
import { Search, Download, ChevronDown, Plus, Edit, Trash2, Upload, Image as ImageIcon, Info, Loader2 } from "lucide-react"
import api from "@food/api"
import { emptyBanners } from "@food/utils/adminFallbackData"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

// Using placeholders for banner images
const bannerImage1 = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop"
const bannerImage2 = "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=400&fit=crop"
const bannerImage3 = "https://images.unsplash.com/photo-1556910096-6f5e72db6803?w=800&h=400&fit=crop"
const bannerImage4 = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop"
const bannerImage5 = "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=400&fit=crop"
const bannerImage6 = "https://images.unsplash.com/photo-1556910096-6f5e72db6803?w=800&h=400&fit=crop"

const bannerImages = {
  1: bannerImage1,
  2: bannerImage2,
  3: bannerImage3,
  4: bannerImage4,
  5: bannerImage5,
  6: bannerImage6,
}

export default function Banners() {
  const [activeLanguage, setActiveLanguage] = useState("default")
  const [searchQuery, setSearchQuery] = useState("")
  const [bannerType, setBannerType] = useState("all")
  const [banners, setBanners] = useState(emptyBanners)
  const [formData, setFormData] = useState({
    title: "",
    zone: "",
    bannerType: "Restaurant wise",
    restaurant: "",
  })



  const languageTabs = [
    { key: "default", label: "Default" },
    { key: "en", label: "English(EN)" },
    { key: "bn", label: "Bengali - বাংলা(BN)" },
    { key: "ar", label: "Arabic - العربية (AR)" },
    { key: "es", label: "Spanish - espa�ol(ES)" },
  ]

  const filteredBanners = useMemo(() => {
    let result = [...banners]

    if (bannerType !== "all") {
      if (bannerType === "Restaurant wise") {
        result = result.filter(banner => banner.bannerType === "Restaurant wise")
      } else if (bannerType === "Zone wise") {
        result = result.filter(banner => banner.bannerType === "Zone wise")
      }
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(banner =>
        banner.title.toLowerCase().includes(query)
      )
    }

    return result
  }, [banners, searchQuery, bannerType])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    debugLog("Form submitted:", formData)
    alert("Banner added successfully!")
  }

  const handleReset = () => {
    setFormData({
      title: "",
      zone: "",
      bannerType: "Restaurant wise",
      restaurant: "",
    })
  }

  const handleToggleStatus = (sl) => {
    setBanners(banners.map(banner =>
      banner.sl === sl ? { ...banner, status: !banner.status } : banner
    ))
  }

  const handleDelete = (sl) => {
    if (window.confirm("Are you sure you want to delete this banner?")) {
      setBanners(banners.filter(banner => banner.sl !== sl))
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Add New Banner Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Plus className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-slate-900">Add New Banner</h1>
          </div>

          {/* Language Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
            {languageTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveLanguage(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeLanguage === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Banner Title ({activeLanguage === "default" ? "Default" : languageTabs.find(t => t.key === activeLanguage)?.label}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="New banner"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Zone <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.zone}
                  onChange={(e) => handleInputChange("zone", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                >
                  <option value="">---Select---</option>
                  <option value="asia">Asia</option>
                  <option value="europe">Europe</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Banner Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.bannerType}
                  onChange={(e) => handleInputChange("bannerType", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                >
                  <option value="Restaurant wise">Restaurant wise</option>
                  <option value="Zone wise">Zone wise</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Restaurant <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.restaurant}
                  onChange={(e) => handleInputChange("restaurant", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                >
                  <option value="">Select</option>
                  <option value="cafe-monarch">Caf� Monarch</option>
                  <option value="hungry-puppets">Hungry Puppets</option>
                </select>
              </div>
            </div>

            {/* Banner Image Upload */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Banner Image <span className="text-red-500">*</span>
              </label>
              <p className="text-sm text-slate-600 mb-3">Upload your image here</p>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer">
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-primary mb-1">Click to upload</p>
                <p className="text-xs text-slate-500 mb-2">Or drag and drop</p>
                <p className="text-xs text-slate-500">Supported format : JPG, JPEG, PNG, Gif image size : Max 2 MB (2:1)</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-all shadow-md"
              >
                Submit
              </button>
            </div>
          </form>
        </div>

        {/* Banner List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Banner List</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredBanners.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={bannerType}
                onChange={(e) => setBannerType(e.target.value)}
                className="px-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="all">All Banner</option>
                <option value="Restaurant wise">Restaurant wise</option>
                <option value="Zone wise">Zone wise</option>
              </select>

              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <input
                  type="text"
                  placeholder="Ex: Search by title ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">SI</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Banner Info</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Zone</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Banner Type</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredBanners.map((banner) => (
                  <tr key={banner.sl} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-700">{banner.sl}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                          <img
                            src={bannerImages[banner.sl] || bannerImage1}
                            alt={banner.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = bannerImage1
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-900">{banner.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700">{banner.zone}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700">{banner.bannerType}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(banner.sl)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${banner.status ? "bg-primary" : "bg-slate-300"
                          }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${banner.status ? "translate-x-6" : "translate-x-1"
                            }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          className="p-1.5 rounded text-primary hover:bg-[#f7f3fc] transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(banner.sl)}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>



    </div>
  )
}

