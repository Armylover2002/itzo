import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import useRestaurantBackNavigation from "@food/hooks/useRestaurantBackNavigation"
import Lenis from "lenis"
import { ArrowLeft } from "lucide-react"
import BottomNavbar from "@food/components/restaurant/BottomNavbar"
import MenuOverlay from "@food/components/restaurant/MenuOverlay"

export default function RestaurantCategoriesPage() {
  const navigate = useNavigate()
  const goBack = useRestaurantBackNavigation()
  const [showMenu, setShowMenu] = useState(false)
  const [failedImages, setFailedImages] = useState(new Set())

  // Food Categories with images
  const categories = [
    { id: 1, name: "American", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop&crop=center" },
    { id: 2, name: "Bengali", image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop&crop=center" },
    { id: 3, name: "Caribbean", image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop&crop=center" },
    { id: 4, name: "Chinese", image: "https://images.unsplash.com/photo-1563379091339-03246963d96a?w=400&h=400&fit=crop&crop=center" },
    { id: 5, name: "Italian", image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop&crop=center" },
    { id: 6, name: "Mexican", image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop&crop=center" },
    { id: 7, name: "Indian", image: "https://images.unsplash.com/photo-1563379091339-03246963d96a?w=400&h=400&fit=crop&crop=center" },
    { id: 8, name: "Thai", image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop&crop=center" },
    { id: 9, name: "Japanese", image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop&crop=center" },
    { id: 10, name: "French", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop&crop=center" },
    { id: 11, name: "Mediterranean", image: "https://images.unsplash.com/photo-1563379091339-03246963d96a?w=400&h=400&fit=crop&crop=center" },
    { id: 12, name: "Korean", image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop&crop=center" },
    { id: 13, name: "Vietnamese", image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=400&fit=crop&crop=center" },
    { id: 14, name: "Turkish", image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=400&fit=crop&crop=center" },
    { id: 15, name: "Greek", image: "https://images.unsplash.com/photo-1563379091339-03246963d96a?w=400&h=400&fit=crop&crop=center" },
    { id: 16, name: "Spanish", image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop&crop=center" },
  ]

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    })

    function raf(time) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    return () => {
      lenis.destroy()
    }
  }, [])

  const handleCategoryClick = (categoryName) => {
    navigate(`/restaurant/food/all?category=${categoryName}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={goBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </motion.button>
          <h1 className="text-lg md:text-xl font-semibold text-gray-900">Food Categories</h1>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6"
        >
          {categories.map((category, index) => (
            <motion.button
              key={category.id}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: index * 0.05,
                type: "spring",
                stiffness: 200,
                damping: 20
              }}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleCategoryClick(category.name)}
              className="flex flex-col items-center gap-3 group"
            >
              {/* Circular Image */}
              <motion.div
                whileHover={{ rotate: 5 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden shadow-md group-hover:shadow-lg transition-shadow bg-gray-200"
              >
                {failedImages.has(category.id) ? (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#ff8100] to-[#ff9500] text-white font-bold text-lg md:text-xl">
                    {category.name.charAt(0)}
                  </div>
                ) : (
                  <img
                    src={category.image}
                    alt={category.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                    onError={() => {
                      setFailedImages(prev => new Set([...prev, category.id]))
                    }}
                  />
                )}
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#ff8100]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </motion.div>

              {/* Category Name */}
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 + 0.2, duration: 0.3 }}
                className="text-xs md:text-sm font-medium text-gray-700 group-hover:text-[#ff8100] transition-colors text-center"
              >
                {category.name}
              </motion.span>
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <BottomNavbar onMenuClick={() => setShowMenu(true)} />
      
      {/* Menu Overlay */}
      <MenuOverlay showMenu={showMenu} setShowMenu={setShowMenu} />
    </div>
  )
}

