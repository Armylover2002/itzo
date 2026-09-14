import { useState } from "react"
import { Upload, X, RotateCcw, Plus, Save, Info } from "lucide-react"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function ReactRegistration() {
  const [activeTab, setActiveTab] = useState("hero-section")
  const [heroImage, setHeroImage] = useState(null)
  const [heroImagePreview, setHeroImagePreview] = useState(null)
  
  // Steeper state
  const [steeperSteps, setSteeperSteps] = useState([
    { id: 1, title: "Step 1", description: "" },
    { id: 2, title: "Step 2", description: "" },
    { id: 3, title: "Step 3", description: "" },
  ])
  
  // Opportunities state
  const [opportunities, setOpportunities] = useState([
    { id: 1, title: "", description: "", icon: null },
    { id: 2, title: "", description: "", icon: null },
  ])
  
  // FAQ state
  const [faqs, setFaqs] = useState([
    { id: 1, question: "", answer: "" },
    { id: 2, question: "", answer: "" },
  ])

  const tabs = [
    { id: "hero-section", label: "Hero Section" },
    { id: "steeper", label: "Steeper" },
    { id: "opportunities", label: "Opportunities" },
    { id: "faq", label: "FAQ" }
  ]

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setHeroImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setHeroImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setHeroImage(null)
    setHeroImagePreview(null)
  }

  const handleReset = () => {
    setHeroImage(null)
    setHeroImagePreview(null)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    debugLog("Form submitted:", { heroImage, activeTab })
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">React Registration Page</h1>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-6">
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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

        {/* Hero Section Content */}
        {activeTab === "hero-section" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Hero Section Image</h2>
            
            {/* Image Upload Area */}
            <div className="mb-4">
              {heroImagePreview ? (
                <div className="relative border-2 border-slate-200 rounded-lg p-4 bg-slate-50">
                  <img
                    src={heroImagePreview}
                    alt="Hero section preview"
                    className="w-full h-auto rounded-lg max-h-96 object-contain mx-auto"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-500 transition-colors bg-slate-50">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 text-slate-400 mb-3" />
                    <p className="text-sm font-medium text-slate-700 mb-1">Upload Image</p>
                    <p className="text-xs text-slate-500">JPG, JPEG, PNG Less Than 5MB (1200 x 750 px)</p>
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* File Requirements */}
            <div className="text-xs text-slate-500 mb-6">
              <p>JPG, JPEG, PNG Less Than 5MB (1200 x 750 px)</p>
            </div>
          </div>
        )}

        {/* Steeper Section */}
        {activeTab === "steeper" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Steeper Section</h2>
            <p className="text-sm text-slate-600 mb-6">
              Configure step-by-step registration process display.
            </p>
            
            <div className="space-y-6">
              {steeperSteps.map((step, index) => (
                <div key={step.id} className="border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Step {step.id}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        Step Title
                        <Info className="w-3 h-3 text-slate-400" />
                      </label>
                      <input
                        type="text"
                        value={step.title}
                        onChange={(e) => {
                          const updated = [...steeperSteps]
                          updated[index].title = e.target.value
                          setSteeperSteps(updated)
                        }}
                        placeholder={`Enter step ${step.id} title`}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        Step Description
                        <Info className="w-3 h-3 text-slate-400" />
                      </label>
                      <textarea
                        rows={3}
                        value={step.description}
                        onChange={(e) => {
                          const updated = [...steeperSteps]
                          updated[index].description = e.target.value
                          setSteeperSteps(updated)
                        }}
                        placeholder={`Enter step ${step.id} description`}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Opportunities Section */}
        {activeTab === "opportunities" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Opportunities Section</h2>
            <p className="text-sm text-slate-600 mb-6">
              Configure available opportunities for registration.
            </p>
            
            <div className="space-y-6">
              {opportunities.map((opp, index) => (
                <div key={opp.id} className="border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">Opportunity {opp.id}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        Opportunity Title
                        <Info className="w-3 h-3 text-slate-400" />
                      </label>
                      <input
                        type="text"
                        value={opp.title}
                        onChange={(e) => {
                          const updated = [...opportunities]
                          updated[index].title = e.target.value
                          setOpportunities(updated)
                        }}
                        placeholder="Enter opportunity title"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        Opportunity Description
                        <Info className="w-3 h-3 text-slate-400" />
                      </label>
                      <textarea
                        rows={3}
                        value={opp.description}
                        onChange={(e) => {
                          const updated = [...opportunities]
                          updated[index].description = e.target.value
                          setOpportunities(updated)
                        }}
                        placeholder="Enter opportunity description"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                        Opportunity Icon
                      </label>
                      <div className="relative inline-block">
                        {opp.icon ? (
                          <div className="relative">
                            <img
                              src={opp.icon}
                              alt="Icon"
                              className="w-24 h-24 object-cover rounded-lg border border-slate-300"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...opportunities]
                                updated[index].icon = null
                                setOpportunities(updated)
                              }}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="cursor-pointer">
                            <div className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center hover:border-blue-500 transition-colors">
                              <Upload className="w-6 h-6 text-slate-400" />
                            </div>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files[0]
                                if (file) {
                                  const reader = new FileReader()
                                  reader.onloadend = () => {
                                    const updated = [...opportunities]
                                    updated[index].icon = reader.result
                                    setOpportunities(updated)
                                  }
                                  reader.readAsDataURL(file)
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setOpportunities([...opportunities, { id: opportunities.length + 1, title: "", description: "", icon: null }])
                }}
                className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add New Opportunity
              </button>
            </div>
          </div>
        )}

        {/* FAQ Section */}
        {activeTab === "faq" && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">FAQ Section</h2>
            <p className="text-sm text-slate-600 mb-6">
              Configure frequently asked questions for registration.
            </p>
            
            <div className="space-y-6">
              {faqs.map((faq, index) => (
                <div key={faq.id} className="border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4">FAQ {faq.id}</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        Question
                        <Info className="w-3 h-3 text-slate-400" />
                      </label>
                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => {
                          const updated = [...faqs]
                          updated[index].question = e.target.value
                          setFaqs(updated)
                        }}
                        placeholder="Enter question"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        Answer
                        <Info className="w-3 h-3 text-slate-400" />
                      </label>
                      <textarea
                        rows={4}
                        value={faq.answer}
                        onChange={(e) => {
                          const updated = [...faqs]
                          updated[index].answer = e.target.value
                          setFaqs(updated)
                        }}
                        placeholder="Enter answer"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setFaqs([...faqs, { id: faqs.length + 1, question: "", answer: "" }])
                }}
                className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add New FAQ
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={handleReset}
            className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

