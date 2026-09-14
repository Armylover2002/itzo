import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Play, Pause, IndianRupee } from "lucide-react"
import BottomPopup from "@delivery/components/BottomPopup"
import { useCompanyName } from "@food/hooks/useCompanyName"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


export default function DeliveryWelcome() {
  const companyName = useCompanyName()
  const navigate = useNavigate()
  const [showPopup, setShowPopup] = useState(true)
  const [isPlaying, setIsPlaying] = useState(true)
  const [audioTime, setAudioTime] = useState("00:00")
  const audioRef = useRef(null)

  // Get user name from localStorage
  const getUserName = () => {
    try {
      const userData = localStorage.getItem("delivery_user")
      if (userData) {
        const user = JSON.parse(userData)
        return user.name || "Delivery Partner"
      }
    } catch (error) {
      debugError("Error getting user name:", error)
    }
    return "Delivery Partner"
  }

  const userName = getUserName()

  // Simulate audio playback
  useEffect(() => {
    if (isPlaying) {
      // Simulate audio time progression
      let time = 0
      const interval = setInterval(() => {
        time += 1
        const minutes = Math.floor(time / 60)
        const seconds = time % 60
        setAudioTime(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
        
        // Stop after 10 seconds (simulating audio length)
        if (time >= 10) {
          setIsPlaying(false)
          clearInterval(interval)
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [isPlaying])

  const handleProceed = () => {
    setShowPopup(false)
  }


  const toggleAudio = () => {
    setIsPlaying(!isPlaying)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 relative z-10">
        {/* Welcome Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-20"
        >
          
          <h1 className="text-lg font-semibold text-gray-900">
            Hi {userName},
          </h1>
          <h2 className="text-lg font-semibold text-gray-900">
            Welcome to {companyName} Delivery
          </h2>
        </motion.div>

        {/* Unlock Prompt */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center mb-4"
        >
          <p className="text-xl font-extrabold text-gray-900 mb-2">
            Complete 1 order to unlock
          </p>
          <p className="text-4xl font-bold text-gray-900 mb-2">
            ₹100
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Valid till 10 December 2025</span>
          </div>
        </motion.div>

        {/* Reward Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="w-full max-w-sm bg-black rounded-3xl p-6 mb-8 relative overflow-hidden"
        >
     
          {/* Money Illustration - Stack of Currency Notes */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-24 h-24 bg-green-600 rounded-lg flex items-center justify-center relative overflow-visible">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-green-700 rounded-lg"></div>
                {/* Stack of money notes with band */}
                <div className="relative z-10">
                  {/* Band/Tie around notes */}
                  {/* <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-3 bg-amber-300 rounded-full z-30"></div> */}
                  
                  {/* Note 1 - Back (left) */}
                  <div className="w-10 h-14 bg-green-400 rounded-sm transform -rotate-12 absolute -left-2 top-1/2 -translate-y-1/2 z-0 shadow-md"></div>
                  
                  {/* Note 2 - Middle */}
                  <div className="w-10 h-14 bg-green-300 rounded-sm transform rotate-0 relative z-10 shadow-lg"></div>
                  
                  {/* Note 3 - Front (right) */}
                  <div className="w-10 h-14 bg-green-200 rounded-sm transform rotate-12 absolute -right-2 top-1/2 -translate-y-1/2 z-20 shadow-xl flex items-center justify-center">
                    <IndianRupee className="w-5 h-5 text-green-800" strokeWidth={3} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Reward Amount */}
          <div className="text-center mb-2">
            <div className="flex items-center justify-center gap-2">
              <span className="text-5xl font-bold text-white">₹100</span>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm text-white/80 mt-2">
              Joining cash added to pocket
            </p>
          </div>

          {/* Start Earning Button */}
           <button
             onClick={() => {
               // Navigate directly to delivery home page (map with hotspots)
               navigate("/food/delivery", { replace: true })
             }}
             className="w-full bg-[#00B761] hover:bg-[#00A055] text-white font-bold py-4 rounded-lg mt-4 flex items-center justify-center gap-2 transition-colors"
           >
            <span>Start earning</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </motion.div>
      </div>

      {/* Audio Player */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-20">
        <div className="flex items-center gap-4 max-w-2xl mx-auto">
          <button
            onClick={toggleAudio}
            className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center hover:bg-gray-800 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>
          
          {/* Waveform */}
          <div className="flex-1 flex items-center gap-1 h-8">
            {[...Array(30)].map((_, i) => {
              // Use a seeded random-like pattern for each bar
              const seed = i * 0.1
              const baseHeight = 20
              const maxHeight = 80
              
              // Create varying heights using sine waves with different frequencies
              const height1 = baseHeight + (Math.sin(seed) * 0.5 + 0.5) * (maxHeight - baseHeight)
              const height2 = baseHeight + (Math.sin(seed + 1) * 0.5 + 0.5) * (maxHeight - baseHeight)
              const height3 = baseHeight + (Math.sin(seed + 2) * 0.5 + 0.5) * (maxHeight - baseHeight)
              const height4 = baseHeight + (Math.sin(seed + 3) * 0.5 + 0.5) * (maxHeight - baseHeight)
              
              return (
                <motion.div
                  key={i}
                  className="w-1 bg-gray-400 rounded-full"
                  animate={isPlaying ? {
                    height: [
                      `${height1}%`,
                      `${height2}%`,
                      `${height3}%`,
                      `${height4}%`,
                      `${height1}%`,
                    ],
                  } : {
                    height: `${baseHeight}%`,
                  }}
                  transition={{
                    duration: 0.5 + (i % 3) * 0.2,
                    repeat: isPlaying ? Infinity : 0,
                    repeatDelay: 0,
                    delay: i * 0.05,
                    ease: "easeInOut",
                  }}
                />
              )
            })}
          </div>

          {/* Time */}
          <span className="text-sm text-gray-600 font-mono min-w-[50px]">
            {audioTime}
          </span>

        </div>
      </div>

      {/* Profile Active Popup */}
      <BottomPopup
        isOpen={showPopup}
        onClose={() => setShowPopup(false)}
        showCloseButton={false}
        closeOnBackdropClick={false}
        maxHeight="70vh"
        showHandle={false}
      >
        <div className="flex flex-col items-center py-6 relative overflow-hidden">
          {/* Confetti Animation inside popup */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-sm"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-5%`,
                  backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)],
                }}
                initial={{
                  y: -50,
                  opacity: 1,
                  rotate: 0,
                }}
                animate={{
                  y: 600,
                  opacity: 0,
                  rotate: 360,
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  delay: Math.random() * 1,
                  repeat: Infinity,
                  ease: "linear",
                }}
              />
            ))}
          </div>

          {/* Animated Checkmark Circle */}
          <div className="relative mb-6 z-10">
            {/* Outer ring animation */}
            <motion.div
              className="absolute inset-0 w-32 h-32 rounded-full border-4 border-green-500"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 0 }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
            
            {/* Main circle with checkmark */}
            <motion.div
              className="w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-2xl relative overflow-hidden"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 15,
              }}
            >
              {/* Confetti inside circle */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: ['#fbbf24', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6'][Math.floor(Math.random() * 6)],
                    top: '50%',
                    left: '50%',
                  }}
                  initial={{
                    x: 0,
                    y: 0,
                    scale: 0,
                    opacity: 1,
                  }}
                  animate={{
                    x: Math.cos((i * 45) * Math.PI / 180) * 60,
                    y: Math.sin((i * 45) * Math.PI / 180) * 60,
                    scale: [0, 1, 0],
                    opacity: [1, 1, 0],
                  }}
                  transition={{
                    duration: 1,
                    delay: 0.3,
                    ease: "easeOut",
                  }}
                />
              ))}

              {/* Checkmark */}
              <motion.svg
                className="w-16 h-16 text-white relative z-10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  duration: 0.6,
                  delay: 0.2,
                  ease: "easeOut",
                }}
              >
                <motion.path
                  d="M5 12l5 5L19 7"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{
                    duration: 0.5,
                    delay: 0.3,
                    ease: "easeOut",
                  }}
                />
              </motion.svg>
            </motion.div>

            {/* Sparkles around circle */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                style={{
                  top: '50%',
                  left: '50%',
                }}
                initial={{
                  x: 0,
                  y: 0,
                  scale: 0,
                  opacity: 0,
                }}
                animate={{
                  x: Math.cos((i * 60) * Math.PI / 180) * 80,
                  y: Math.sin((i * 60) * Math.PI / 180) * 80,
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 0.8,
                  delay: 0.4 + i * 0.1,
                  ease: "easeOut",
                }}
              />
            ))}
          </div>

          {/* Profile Active Text */}
          <motion.h2
            className="text-2xl font-bold text-gray-900 mb-6 z-10 relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            Profile active
          </motion.h2>

          {/* Delivery Bag Card */}
          <motion.div
            className="w-full bg-gray-50 rounded-xl p-4 mb-6 flex items-center gap-4 z-10 relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            {/* Bag Image Placeholder */}
            <div className="w-20 h-20 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            
            {/* Bag Info */}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                {companyName} delivery bag
              </h3>
              <p className="text-sm text-gray-600">
                Your bag will be shipped after your second day of order deliveries
              </p>
            </div>
          </motion.div>

          {/* Proceed Button */}
          <motion.button
            onClick={handleProceed}
            className="w-full bg-black text-white font-bold py-4 rounded-lg hover:bg-gray-800 transition-colors z-10 relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.5 }}
          >
            Proceed
          </motion.button>
        </div>
      </BottomPopup>
    </div>
  )
}


