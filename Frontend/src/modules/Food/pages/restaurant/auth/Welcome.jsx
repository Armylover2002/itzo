import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@food/components/ui/button"
import loginBanner1 from "@food/assets/restaurant/loginbanner1.png"
import loginBanner2 from "@food/assets/restaurant/loginbanner2.png"
import loginBanner3 from "@food/assets/restaurant/loginbanner3.png"
import loginBanner4 from "@food/assets/restaurant/loginbanner4.png"
import { useCompanyName } from "@food/hooks/useCompanyName"
import RestaurantAuthFooter from "@food/components/restaurant/RestaurantAuthFooter"

// Carousel data with images and taglines
const carouselData = [
  {
    id: 1,
    image: loginBanner2,
    tagline: "Get powerful insights and analytics to grow your restaurant business"
  },
  {
    id: 2,
    image: loginBanner1,
    tagline: "Manage all your orders with ease and streamline your operations"
  },
  {
    id: 3,
    image: loginBanner3,
    tagline: "Reach more customers, expand your reach, and boost your sales"
  },
  {
    id: 4,
    image: loginBanner4,
    tagline: "Track your performance in real-time and make data-driven decisions"
  }
]

export default function RestaurantWelcome() {
  const navigate = useNavigate()
  const companyName = useCompanyName() || "Appzeto"
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0) // 1 for next, -1 for previous
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)
  const carouselRef = useRef(null)

  // Minimum swipe distance (in pixels)
  const minSwipeDistance = 50

  // Handle touch start
  const onTouchStart = (e) => {
    const touch = e.targetTouches[0]
    setTouchEnd(null)
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY
    })
  }

  // Handle touch move
  const onTouchMove = (e) => {
    const touch = e.targetTouches[0]
    setTouchEnd({
      x: touch.clientX,
      y: touch.clientY
    })
  }

  // Handle touch end and determine swipe direction
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return

    const deltaX = Math.abs(touchStart.x - touchEnd.x)
    const deltaY = Math.abs(touchStart.y - touchEnd.y)
    const distanceY = touchStart.y - touchEnd.y

    // Only process if vertical movement is significantly greater than horizontal (strict vertical swipe)
    // Require vertical movement to be at least 1.5x horizontal movement
    const isVerticalSwipe = deltaY > deltaX * 1.5 && deltaY > minSwipeDistance
    const isHorizontalSwipe = deltaX > deltaY * 1.5

    // Ignore horizontal swipes completely
    if (isHorizontalSwipe) {
      setTouchStart(null)
      setTouchEnd(null)
      return
    }

    // Only process vertical swipes
    if (isVerticalSwipe) {
      const isUpSwipe = distanceY > 0
      const isDownSwipe = distanceY < 0

      if (isUpSwipe && currentIndex < carouselData.length - 1) {
        setDirection(1) // Next slide
        setCurrentIndex((prev) => prev + 1)
      } else if (isDownSwipe && currentIndex > 0) {
        setDirection(-1) // Previous slide
        setCurrentIndex((prev) => prev - 1)
      }
    }

    // Reset touch values
    setTouchStart(null)
    setTouchEnd(null)
  }

  // Handle mouse events for desktop testing
  const [mouseStart, setMouseStart] = useState(null)
  const [mouseEnd, setMouseEnd] = useState(null)

  const onMouseDown = (e) => {
    setMouseEnd(null)
    setMouseStart({
      x: e.clientX,
      y: e.clientY
    })
  }

  const onMouseMove = (e) => {
    if (mouseStart !== null) {
      setMouseEnd({
        x: e.clientX,
        y: e.clientY
      })
    }
  }

  const onMouseUp = () => {
    if (!mouseStart || !mouseEnd) return

    const deltaX = Math.abs(mouseStart.x - mouseEnd.x)
    const deltaY = Math.abs(mouseStart.y - mouseEnd.y)
    const distanceY = mouseStart.y - mouseEnd.y

    // Only process if vertical movement is significantly greater than horizontal (strict vertical swipe)
    // Require vertical movement to be at least 1.5x horizontal movement
    const isVerticalSwipe = deltaY > deltaX * 1.5 && deltaY > minSwipeDistance
    const isHorizontalSwipe = deltaX > deltaY * 1.5

    // Ignore horizontal swipes completely
    if (isHorizontalSwipe) {
      setMouseStart(null)
      setMouseEnd(null)
      return
    }

    // Only process vertical swipes
    if (isVerticalSwipe) {
      const isUpSwipe = distanceY > 0
      const isDownSwipe = distanceY < 0

      if (isUpSwipe && currentIndex < carouselData.length - 1) {
        setDirection(1) // Next slide
        setCurrentIndex((prev) => prev + 1)
      } else if (isDownSwipe && currentIndex > 0) {
        setDirection(-1) // Previous slide
        setCurrentIndex((prev) => prev - 1)
      }
    }

    setMouseStart(null)
    setMouseEnd(null)
  }


  const handleLogin = () => {
    navigate("/food/restaurant/login")
  }

  const handlePartner = () => {
    navigate("/food/restaurant/signup")
  }

  // Auto-advance carousel every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setDirection(1) // Always go forward
      setCurrentIndex((prev) => (prev + 1) % carouselData.length)
    }, 5000) // 5 seconds

    return () => clearInterval(interval)
  }, [carouselData.length])

  return (
    <div className="h-screen w-full flex flex-col bg-black overflow-hidden">
      {/* Carousel Section - 70% height */}
      <div
        ref={carouselRef}
        className="relative flex-1 overflow-hidden select-none"
        style={{ height: "70vh" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          {carouselData.map((item, index) => {
            if (index !== currentIndex) return null

            return (
              <motion.div
                key={`${item.id}-${currentIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.5,
                  ease: "easeInOut"
                }}
                className="absolute inset-0"
              >
                {/* Background Image */}
                <div className="relative w-full h-full">
                  <img
                    src={item.image}
                    alt={`Carousel ${item.id}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/80" />

                  {/* Text Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 pb-16">
                    {/* Appzeto Brand */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2, duration: 0.5 }}
                      className="mb-3"
                    >
                      <h1
                        className="text-3xl italic md:text-4xl tracking-wide font-extrabold text-white"
                        style={{
                          WebkitTextStroke: "0.5px white",
                          textStroke: "0.5px white"
                        }}
                      >
                        {companyName.toLowerCase()}
                      </h1>

                      <div className="w-12 h-[0.1px] bg-white mt-0 mb-3" />
                      {/* <p className="text-sm md:text-base text-white/90 font-medium">
                        restaurant partner
                      </p> */}
                    </motion.div>

                    {/* Tagline */}
                    <motion.h2
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.5 }}
                      className="text-2xl md:text-2xl lg:text-4xl font-bold text-white leading-tight"
                    >
                      {item.tagline}
                    </motion.h2>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

        {/* Carousel Indicators - Left aligned */}
        <div className="absolute align-center flex justify-center items-center bottom-4 left-6 flex gap-2 z-10">
          {carouselData.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setDirection(index > currentIndex ? 1 : -1)
                setCurrentIndex(index)
              }}
              className={`transition-all duration-300 rounded-full ${index === currentIndex
                  ? "w-2.5 h-2.5 bg-white"
                  : "w-1.5 h-1.5 bg-white/50"
                }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Bottom Section - 30% height */}
      <div
        className="bg-black px-6 py-6 md:py-8 flex flex-col justify-center gap-4"
        style={{ height: "30vh", minHeight: "240px" }}
      >
        {/* Login Button */}
        <Button
          onClick={handleLogin}
          className="w-full bg-[#FF0000] hover:bg-[#E64D02] text-white font-bold py-6 md:py-7 text-base md:text-lg rounded-lg transition-colors shadow-lg"
        >
          Login
        </Button>

        {/* Partner Button */}
        {/* <Button
          onClick={handlePartner}
          variant="outline"
          className="w-full border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-bold py-6 md:py-7 text-base md:text-lg rounded-lg transition-all shadow-lg bg-transparent"
        >
          Partner with Appzeto
        </Button> */}

        <RestaurantAuthFooter className="mt-2" variant="dark" />
      </div>
    </div>
  )
}
