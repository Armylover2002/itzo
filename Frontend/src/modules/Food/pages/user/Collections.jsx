import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Share2, UtensilsCrossed, Store, X } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Input } from "@food/components/ui/input"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"

// Import banner
import collectionsBanner from "@food/assets/collectionspagebanner.png"

// Gradient colors for collection cards
const gradientColors = [
  "bg-gradient-to-br from-red-400 to-red-600",
  "bg-gradient-to-br from-[#FE5502] to-[#C83C00]",
  "bg-gradient-to-br from-purple-500 to-pink-600",
  "bg-gradient-to-br from-red-500 to-rose-600",
  "bg-gradient-to-br from-rose-400 to-red-500",
  "bg-gradient-to-br from-pink-500 to-red-600",
  "bg-gradient-to-br from-pink-400 to-rose-600",
  "bg-gradient-to-br from-red-400 to-[#FE5502]",
]

export default function Collections() {
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const [activeTab, setActiveTab] = useState("delivery")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")

  // Delivery collections
  const [deliveryCollections, setDeliveryCollections] = useState([
    { id: "bookmarks", name: "Bookmarks", dishes: 0, restaurants: 0, isDefault: true }
  ])

  // Dining collections
  const [diningCollections, setDiningCollections] = useState([
    { id: "bookmarks", name: "Bookmarks", dishes: 0, restaurants: 0, isDefault: true }
  ])

  const currentCollections = activeTab === "delivery" ? deliveryCollections : diningCollections
  const setCurrentCollections = activeTab === "delivery" ? setDeliveryCollections : setDiningCollections

  const handleCreateCollection = () => {
    if (newCollectionName.trim()) {
      const newCollection = {
        id: `collection-${Date.now()}`,
        name: newCollectionName.trim(),
        dishes: 0,
        restaurants: 0,
        isDefault: false
      }
      setCurrentCollections(prev => [...prev, newCollection])
      setNewCollectionName("")
      setIsCreateDialogOpen(false)
    }
  }

  const getGradientColor = (index) => {
    return gradientColors[index % gradientColors.length]
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      {/* Back Button */}
      <button
        onClick={goBack}
        className="fixed top-4 left-4 z-20 w-10 h-10 bg-gray-800/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-gray-800/80 transition-colors"
      >
        <ArrowLeft className="h-5 w-5 text-white" />
      </button>

      {/* Banner Section - Clean without dark overlay */}
      <div className="relative w-full overflow-hidden min-h-[25vh] md:min-h-[30vh] bg-gradient-to-b from-amber-50 to-white">
        <div className="absolute inset-0 z-0">
          <img
            src={collectionsBanner}
            alt="Your Collections"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 bg-white dark:bg-[#1a1a1a] z-10 border-b dark:border-gray-800">
        <div className="flex">
          <button
            onClick={() => setActiveTab("delivery")}
            className={`flex-1 py-4 text-center font-semibold transition-colors relative ${activeTab === "delivery" ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"
              }`}
          >
            Delivery
            {activeTab === "delivery" && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-1 bg-[#FE5502] rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("dining")}
            className={`flex-1 py-4 text-center font-semibold transition-colors relative ${activeTab === "dining" ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"
              }`}
          >
            Dining
            {activeTab === "dining" && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-1 bg-[#FE5502] rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 md:px-8 lg:px-10 py-6 md:py-8 lg:py-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5 lg:gap-6">
            {/* Collection Cards */}
            {currentCollections.map((collection, index) => (
              <Link
                key={collection.id}
                to={collection.isDefault ? "/user/profile/favorites" : `/user/collections/${collection.id}`}
                className="block"
              >
                <div className={`${getGradientColor(index)} rounded-2xl p-4 h-48 relative overflow-hidden group`}>
                  {/* Share Button */}
                  <button
                    className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors z-10"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                  >
                    <Share2 className="h-5 w-5" />
                  </button>

                  {/* Center Illustration - Two overlapping cards */}
                  <div className="absolute inset-0 flex items-center justify-center pb-10">
                    <div className="relative w-32 h-24">
                      {/* Left card - Food */}
                      <div className="absolute left-0 top-2 w-14 h-11 bg-white rounded-lg shadow-lg transform -rotate-12 overflow-hidden">
                        <div className="w-full h-full bg-gray-50 flex items-center justify-center p-1">
                          <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center">
                            <UtensilsCrossed className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        {/* Red flag */}
                        <div className="absolute -top-1 right-2 w-2.5 h-3.5 bg-red-500" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)' }} />
                      </div>

                      {/* Right card - Restaurant */}
                      <div className="absolute right-0 top-0 w-14 h-11 bg-white rounded-lg shadow-lg transform rotate-12 overflow-hidden">
                        <div className="w-full h-full bg-gray-50 flex items-center justify-center p-1">
                          <Store className="h-6 w-6 text-red-500" />
                        </div>
                        {/* Striped awning */}
                        <div className="absolute -top-0.5 left-0 right-0 h-2 bg-gradient-to-r from-red-400 via-white to-red-400"
                          style={{ backgroundSize: '8px 100%', backgroundImage: 'repeating-linear-gradient(90deg, #f87171 0px, #f87171 4px, white 4px, white 8px)' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Collection Info */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-white font-bold text-lg mb-1">{collection.name}</h3>
                    <p className="text-white/80 text-sm">
                      {collection.dishes} dish | {collection.restaurants} restaurant
                    </p>
                  </div>
                </div>
              </Link>
            ))}

            {/* Create New Collection Card */}
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-white dark:bg-[#1a1a1a] border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-4 h-48 flex flex-col items-center justify-center gap-3 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-[#FE5502]/20 flex items-center justify-center border-2 border-[#FE5502]/30 dark:border-[#FE5502]/40">
                <Plus className="h-6 w-6 text-[#FE5502] dark:text-[#FE5502]" />
              </div>
              <div className="text-center">
                <p className="text-gray-700 dark:text-gray-300 font-semibold">Create a new</p>
                <p className="text-gray-700 dark:text-gray-300 font-semibold">Collection</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Custom Create Collection Modal */}
      {isCreateDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setIsCreateDialogOpen(false)
              setNewCollectionName("")
            }}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl w-[90%] max-w-sm mx-4 overflow-hidden animate-[slideUp_0.3s_ease-out]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Create New Collection</h2>
              <button
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  setNewCollectionName("")
                }}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
              >
                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">Give your collection a unique name</p>
              <Input
                placeholder="e.g., Weekend Favorites"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCollectionName.trim()) {
                    handleCreateCollection()
                  }
                }}
                className="w-full h-12 text-base border-2 border-gray-200 dark:border-gray-700 focus:border-[#FE5502] dark:focus:border-[#FE5502] rounded-xl bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                autoFocus
              />

              {/* Preview */}
              {newCollectionName.trim() && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Preview</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{newCollectionName.trim()}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-4 bg-gray-50 dark:bg-gray-800">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  setNewCollectionName("")
                }}
                className="flex-1 h-11 rounded-xl font-semibold border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateCollection}
                disabled={!newCollectionName.trim()}
                className="flex-1 h-11 bg-[#FE5502] hover:bg-[#C83C00] text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Collection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
