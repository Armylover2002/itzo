import { useState } from "react"
import { Plus, Trash2, Settings, ChevronDown } from "lucide-react"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


const defaultFields = [
  "Restaurant Name", "Restaurant Logo", "Owner Last Name",
  "Vat/Tax", "Cuisine", "Phone Number",
  "Delivery Address", "Zone", "Email",
  "Min Delivery Time", "Latitude & Longitude", "Password",
  "Max Delivery Time", "Map Location",
  "Restaurant Cover", "Owner First Name"
]

const fieldTypes = ["Text", "Date", "File Upload", "Number", "Email", "Phone"]

export default function JoinUsPageSetup() {
  const [activeTab, setActiveTab] = useState("restaurant")
  const [customFields, setCustomFields] = useState([
    {
      id: 1,
      type: "Text",
      title: "Enter Your Tin Number",
      placeholder: "Enter TIN",
      isRequired: true,
      uploadMultiple: false,
      fileFormats: { jpg: true, pdf: true, docs: true }
    },
    {
      id: 2,
      type: "Date",
      title: "Date",
      placeholder: "Enter Date",
      isRequired: true,
      uploadMultiple: false,
      fileFormats: { jpg: false, pdf: false, docs: false }
    },
    {
      id: 3,
      type: "File Upload",
      title: "License Document",
      placeholder: "",
      isRequired: true,
      uploadMultiple: false,
      fileFormats: { jpg: true, pdf: true, docs: true }
    }
  ])

  const handleAddField = () => {
    const newField = {
      id: Date.now(),
      type: "Text",
      title: "",
      placeholder: "",
      isRequired: false,
      uploadMultiple: false,
      fileFormats: { jpg: false, pdf: false, docs: false }
    }
    setCustomFields([...customFields, newField])
  }

  const handleDeleteField = (id) => {
    setCustomFields(customFields.filter(field => field.id !== id))
  }

  const handleFieldChange = (id, key, value) => {
    setCustomFields(customFields.map(field =>
      field.id === id ? { ...field, [key]: value } : field
    ))
  }

  const handleFileFormatChange = (id, format) => {
    setCustomFields(customFields.map(field =>
      field.id === id
        ? { ...field, fileFormats: { ...field.fileFormats, [format]: !field.fileFormats[format] } }
        : field
    ))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    debugLog("Form submitted:", { activeTab, customFields })
    alert("Join Request Form Setup saved successfully!")
  }

  const handleReset = () => {
    setCustomFields([
      {
        id: 1,
        type: "Text",
        title: "Enter Your Tin Number",
        placeholder: "Enter TIN",
        isRequired: true,
        uploadMultiple: false,
        fileFormats: { jpg: true, pdf: true, docs: true }
      },
      {
        id: 2,
        type: "Date",
        title: "Date",
        placeholder: "Enter Date",
        isRequired: true,
        uploadMultiple: false,
        fileFormats: { jpg: false, pdf: false, docs: false }
      },
      {
        id: 3,
        type: "File Upload",
        title: "License Document",
        placeholder: "",
        isRequired: true,
        uploadMultiple: false,
        fileFormats: { jpg: true, pdf: true, docs: true }
      }
    ])
  }

  return (
    <div className="p-2 lg:p-3 bg-slate-50 min-h-screen">
      <div className="w-full mx-auto max-w-7xl">
        {/* Page Title */}
        <div className="mb-3">
          <h1 className="text-lg font-bold text-slate-900">New Join Request Form Setup</h1>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-2 mb-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("restaurant")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors border-b-2 ${
                activeTab === "restaurant"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              Restaurant Registration Form
            </button>
            <button
              onClick={() => setActiveTab("deliveryman")}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors border-b-2 ${
                activeTab === "deliveryman"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              DeliveryMan Registration Form
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Default Input Fields */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-3 relative">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Default Input Fields</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {defaultFields.map((field, index) => (
                <div
                  key={index}
                  className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <span className="text-xs text-slate-700">{field}</span>
                </div>
              ))}
            </div>
            <Settings className="absolute top-4 right-4 w-4 h-4 text-slate-400" />
          </div>

          {/* Custom Input Fields */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Custom Input Fields</h2>
              <button
                type="button"
                onClick={handleAddField}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Field</span>
              </button>
            </div>

            <div className="space-y-4">
              {customFields.map((field) => (
                <div
                  key={field.id}
                  className="p-4 border border-slate-200 rounded-lg bg-slate-50"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    {/* Type Dropdown */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Type
                      </label>
                      <div className="relative">
                        <select
                          value={field.type}
                          onChange={(e) => handleFieldChange(field.id, "type", e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                        >
                          {fieldTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    {/* Input Field Title */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Input Field Title
                      </label>
                      <input
                        type="text"
                        value={field.title}
                        onChange={(e) => handleFieldChange(field.id, "title", e.target.value)}
                        placeholder="Enter field title"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Place Holder */}
                    {field.type !== "File Upload" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Place Holder
                        </label>
                        <input
                          type="text"
                          value={field.placeholder}
                          onChange={(e) => handleFieldChange(field.id, "placeholder", e.target.value)}
                          placeholder="Enter placeholder"
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* File Upload Specific Options */}
                  {field.type === "File Upload" && (
                    <div className="space-y-3 mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={field.uploadMultiple}
                          onChange={(e) => handleFieldChange(field.id, "uploadMultiple", e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                        />
                        <label className="text-xs text-slate-700">Upload Multiple Files</label>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          File Format
                        </label>
                        <div className="flex flex-wrap gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={field.fileFormats.jpg}
                              onChange={() => handleFileFormatChange(field.id, "jpg")}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                            />
                            <label className="text-xs text-slate-700">JPG JPEG or PNG</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={field.fileFormats.pdf}
                              onChange={() => handleFileFormatChange(field.id, "pdf")}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                            />
                            <label className="text-xs text-slate-700">PDF</label>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={field.fileFormats.docs}
                              onChange={() => handleFileFormatChange(field.id, "docs")}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                            />
                            <label className="text-xs text-slate-700">DOCS</label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Is Required and Delete */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.isRequired}
                        onChange={(e) => handleFieldChange(field.id, "isRequired", e.target.checked)}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <label className="text-xs text-slate-700">Is Required ?</label>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteField(field.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

