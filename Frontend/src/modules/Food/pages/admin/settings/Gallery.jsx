import { useState, useRef } from "react"
import { Folder, Plus, ArrowLeft, HardDrive, Upload, File, Image, X, Search, MoreVertical, Download, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { Input } from "@food/components/ui/input"

export default function Gallery() {
  const [currentPath, setCurrentPath] = useState("")
  const [selectedFiles, setSelectedFiles] = useState([])
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const fileInputRef = useRef(null)
  const folderInputRef = useRef(null)

  // File system structure
  const [fileSystem, setFileSystem] = useState({
    "Profile": { type: "folder", items: [] },
    "React_head": { type: "folder", items: [] },
    "About_us_i": { type: "folder", items: [] },
    "React_prom": { type: "folder", items: [] },
    "Reviewer_i": { type: "folder", items: [] },
    "React_gall": { type: "folder", items: [] },
    "React_down": { type: "folder", items: [] },
    "Product": { type: "folder", items: [] },
    "Payment_mo": { type: "folder", items: [] },
    "Advertisem": { type: "folder", items: [] },
    "React_land": { type: "folder", items: [] },
    "Header_ima": { type: "folder", items: [] },
    "Delivery-M": { type: "folder", items: [] },
    "Vendor": { type: "folder", items: [] },
    "Cuisine": { type: "folder", items: [] },
    "Opportunit": { type: "folder", items: [] },
    "Admin": { type: "folder", items: [] },
    "Landing": { type: "folder", items: [] },
    "React_rest": { type: "folder", items: [] },
    "Restaurant": { type: "folder", items: [] },
    "Page_meta_": { type: "folder", items: [] },
    "Campaign": { type: "folder", items: [] },
    "React_serv": { type: "folder", items: [] },
    "Category": { type: "folder", items: [] },
    "Hero_image": { type: "folder", items: [] },
    "Conversati": { type: "folder", items: [] },
    "Meta_image": { type: "folder", items: [] },
    "Business": { type: "folder", items: [] },
    "Notificati": { type: "folder", items: [] },
    "Meta_data_": { type: "folder", items: [] },
    "React_deli": { type: "folder", items: [] },
    "Why_choose": { type: "folder", items: [] },
    "Email_temp": { type: "folder", items: [] },
    "Banner": { type: "folder", items: [] },
    "Available_": { type: "folder", items: [] },
    "React_step": { type: "folder", items: [] },
    "Feature_im": { type: "folder", items: [] },
    "Step_image": { type: "folder", items: [] },
    "Earn_money": { type: "folder", items: [] },
    "React_meta": { type: "folder", items: [] }
  })

  const folders = Object.keys(fileSystem)

  const filteredFolders = folders.filter(folder => 
    folder.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleFolderClick = (folderName) => {
    setCurrentPath(folderName)
  }

  const handleBack = () => {
    setCurrentPath("")
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    setSelectedFiles(files)
    setIsUploadDialogOpen(true)
  }

  const handleUpload = () => {
    if (selectedFiles.length === 0) {
      alert("Please select files to upload")
      return
    }

    const targetFolder = currentPath || "root"
    const newFiles = selectedFiles.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    }))

    setFileSystem(prev => ({
      ...prev,
      [targetFolder]: {
        ...prev[targetFolder],
        items: [...(prev[targetFolder]?.items || []), ...newFiles]
      }
    }))

    alert(`${selectedFiles.length} file(s) uploaded successfully!`)
    setSelectedFiles([])
    setIsUploadDialogOpen(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      alert("Please enter a folder name")
      return
    }

    const folderName = newFolderName.trim()
    if (fileSystem[folderName]) {
      alert("Folder already exists")
      return
    }

    setFileSystem(prev => ({
      ...prev,
      [folderName]: { type: "folder", items: [] }
    }))

    setNewFolderName("")
    setIsFolderDialogOpen(false)
    alert(`Folder "${folderName}" created successfully!`)
  }

  const handleDeleteFolder = (folderName) => {
    if (confirm(`Are you sure you want to delete "${folderName}"?`)) {
      setFileSystem(prev => {
        const newSystem = { ...prev }
        delete newSystem[folderName]
        return newSystem
      })
      if (currentPath === folderName) {
        setCurrentPath("")
      }
    }
  }

  const currentFolderItems = currentPath ? (fileSystem[currentPath]?.items || []) : []

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
              <Folder className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">File Manager</h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <button className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                Local storage
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-700">Public</span>
                <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 rounded-full text-xs font-medium">
                  {folders.length}
                </span>
              </div>
              {currentPath && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span>/</span>
                  <span className="font-medium">{currentPath}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {currentPath && (
                <button 
                  onClick={handleBack}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}
              <button 
                onClick={() => setIsFolderDialogOpen(true)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Folder className="w-4 h-4" />
                New Folder
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add New
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 text-sm border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Folder/File Grid */}
          {currentPath ? (
            <div>
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-700">Files in {currentPath}</h3>
              </div>
              {currentFolderItems.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <File className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm">No files in this folder</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                  {currentFolderItems.map((file, index) => (
                    <div
                      key={index}
                      className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity group relative"
                    >
                      <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                        {file.type?.startsWith("image/") ? (
                          <Image className="w-8 h-8 text-blue-600" />
                        ) : (
                          <File className="w-8 h-8 text-blue-600" />
                        )}
                      </div>
                      <span className="text-xs text-slate-700 text-center max-w-full truncate">
                        {file.name}
                      </span>
                      <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            // Handle file delete
                          }}
                          className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
              {filteredFolders.map((folder, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity group relative"
                  onClick={() => handleFolderClick(folder)}
                >
                  <div className="w-16 h-16 bg-yellow-100 rounded-lg flex items-center justify-center mb-2">
                    <Folder className="w-8 h-8 text-yellow-600" />
                  </div>
                  <span className="text-xs text-slate-700 text-center max-w-full truncate">
                    {folder}
                  </span>
                  <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteFolder(folder)
                      }}
                      className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-2">
                {selectedFiles.length} file(s) selected:
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="text-xs text-slate-700 bg-slate-50 p-2 rounded">
                    {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsUploadDialogOpen(false)
                  setSelectedFiles([])
                }}
                className="px-4 py-2 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Upload
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleCreateFolder()
                }
              }}
              className="w-full"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsFolderDialogOpen(false)
                  setNewFolderName("")
                }}
                className="px-4 py-2 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Create
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
