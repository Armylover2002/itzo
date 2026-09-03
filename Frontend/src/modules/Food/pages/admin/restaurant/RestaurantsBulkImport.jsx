import { useState } from "react"
import { FileSpreadsheet, Download, Upload, FileCheck, ArrowRight, FileX, RefreshCw } from "lucide-react"

export default function RestaurantsBulkImport() {
  const [selectedFile, setSelectedFile] = useState(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleImport = () => {
    if (selectedFile) {
      // Handle import logic here
      alert(`Importing ${selectedFile.name}...`)
    } else {
      alert("Please select a file to import")
    }
  }

  const handleReset = () => {
    setSelectedFile(null)
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bulk Import</h1>
            <p className="text-sm text-slate-500 mt-1">
              Import restaurants in bulk using Excel files
            </p>
          </div>
        </div>
      </div>

      {/* Step 1 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-start gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-lg">
                1
              </div>
              <h2 className="text-xl font-bold text-slate-900">Download The Excel File</h2>
            </div>
            <div className="space-y-2 text-sm text-slate-600 ml-14">
              <p>• Download the format file and fill it with proper data.</p>
              <p>• You can download the example file to understand how the data must be filled.</p>
              <p>• Have to upload excel file.</p>
            </div>
          </div>
          <div className="p-6 bg-emerald-50 rounded-lg">
            <FileSpreadsheet className="w-16 h-16 text-emerald-600" />
          </div>
        </div>
      </div>

      {/* Step 2 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-start gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg">
                2
              </div>
              <h2 className="text-xl font-bold text-slate-900">Match Spread Sheet Data According To Instruction</h2>
            </div>
            <div className="space-y-2 text-sm text-slate-600 ml-14 mb-6">
              <p>• Fill up the data according to the format</p>
              <p>• By default status will be 1 please input the right ids</p>
              <p>• Make sure to provide valid zone and cuisine IDs</p>
              <p>• Restaurant owner information must be complete and accurate</p>
              <p>• Address and contact details are mandatory fields</p>
            </div>
            <div className="ml-14">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Download Spreadsheet Template</h3>
              <div className="flex gap-3">
                <button className="px-4 py-2 text-sm font-medium rounded-lg border border-primary text-primary bg-white hover:bg-primary/5 transition-all flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  With Current Data
                </button>
                <button className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Without Any Data
                </button>
              </div>
            </div>
          </div>
          <div className="p-6 bg-[#f7f3fc] rounded-lg">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-12 h-12 text-primary" />
              <ArrowRight className="w-8 h-8 text-primary" />
              <FileCheck className="w-12 h-12 text-primary" />
            </div>
          </div>
        </div>
      </div>

      {/* Step 3 */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-start gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#6412c6] text-white flex items-center justify-center font-bold text-lg">
                3
              </div>
              <h2 className="text-xl font-bold text-slate-900">Validate Data And Complete Import</h2>
            </div>
            <div className="space-y-2 text-sm text-slate-600 ml-14">
              <p>• In the Excel file upload section first select the upload option.</p>
              <p>• Upload your file in .xls .xlsx format.</p>
              <p>• Finally click the upload button.</p>
              <p>• You can upload your restaurant images in restaurant folder from gallery and copy image's path.</p>
            </div>
          </div>
          <div className="p-6 bg-[#f7f3fc] rounded-lg">
            <Upload className="w-16 h-16 text-[#550fa8]" />
          </div>
        </div>
      </div>

      {/* Excel File Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Excel File Upload</h2>
        
        {/* File Upload Area */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Import items file:
          </label>
          <div className="relative">
            <input
              type="file"
              id="file-upload"
              accept=".xls,.xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 hover:border-emerald-500 transition-all"
            >
              {selectedFile ? (
                <div className="flex flex-col items-center gap-3">
                  <FileCheck className="w-12 h-12 text-emerald-600" />
                  <p className="text-sm font-medium text-emerald-600">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500">Click to change file</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-emerald-50 rounded-lg">
                    <FileSpreadsheet className="w-12 h-12 text-emerald-600" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="w-6 h-6 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">
                      Must be Excel files using our Excel template above
                    </p>
                    <p className="text-xs text-slate-500">Click to browse or drag and drop</p>
                  </div>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleReset}
            className="px-6 py-2.5 text-sm font-medium rounded-lg bg-slate-600 text-white hover:bg-slate-700 transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleImport}
            className="px-6 py-2.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary transition-all flex items-center gap-2 shadow-md"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
        </div>
      </div>
    </div>
  )
}
