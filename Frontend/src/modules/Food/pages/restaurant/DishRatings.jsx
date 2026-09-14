import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import { ArrowLeft } from "lucide-react"

export default function DishRatings() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={goBack}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Dish Ratings</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-500">Ratings will appear here when customers review dishes.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-sm text-gray-600">
            You haven&apos;t received any dish rating yet
          </p>
        </div>
      </div>
    </div>
  )
}
