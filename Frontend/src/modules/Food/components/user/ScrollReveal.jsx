// // CSS-only ScrollReveal - no IntersectionObserver, no framer-motion
// import { useRef, useEffect, useState } from "react"

// export default function ScrollReveal({ children, delay = 0, className = "", threshold = 0.2 }) {
//   const ref = useRef(null)
//   const [isVisible, setIsVisible] = useState(false)

//   useEffect(() => {
//     const element = ref.current
//     if (!element) return

//     // Simple intersection check using getBoundingClientRect
//     const checkVisibility = () => {
//       const rect = element.getBoundingClientRect()
//       const windowHeight = window.innerHeight || document.documentElement.clientHeight
//       const thresholdPx = windowHeight * threshold
      
//       const isInView = rect.top < windowHeight - thresholdPx && rect.bottom > thresholdPx
      
//       if (isInView && !isVisible) {
//         setIsVisible(true)
//       }
//     }

//     // Check on mount and scroll
//     checkVisibility()
    
//     // Throttled scroll listener
//     let ticking = false
//     const handleScroll = () => {
//       if (!ticking) {
//         window.requestAnimationFrame(() => {
//           checkVisibility()
//           ticking = false
//         })
//         ticking = true
//       }
//     }

//     window.addEventListener('scroll', handleScroll, { passive: true })
    
//     return () => {
//       window.removeEventListener('scroll', handleScroll)
//     }
//   }, [isVisible, threshold])

//   return (
//     <div
//       ref={ref}
//       className={`scroll-reveal ${isVisible ? 'scroll-reveal-visible' : ''} ${className}`}
//       style={{
//         animationDelay: `${delay}s`,
//         opacity: isVisible ? 1 : 0,
//         transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
//       }}
//     >
//       {children}
//     </div>
//   )
// }



export default function ScrollReveal({ children, className = "" }) {
  return <div className={className}>{children}</div>
}
