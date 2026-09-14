// CSS-only StaggerContainer - no framer-motion
import { useEffect, useRef, useState } from "react"

export default function StaggerContainer({ children, className = "" }) {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const checkVisibility = () => {
      const rect = element.getBoundingClientRect()
      const windowHeight = window.innerHeight || document.documentElement.clientHeight
      const isInView = rect.top < windowHeight && rect.bottom > 0

      if (isInView && !isVisible) {
        setIsVisible(true)
      }
    }

    checkVisibility()
    
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          checkVisibility()
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isVisible])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
      }}
    >
      {isVisible && children}
    </div>
  )
}

export const StaggerItem = ({ children, className = "", index = 0 }) => {
  return (
    <div
      className={className}
      style={{
        opacity: 0,
        transform: 'translateY(20px)',
        animation: `staggerFadeIn 0.3s ease-out ${index * 0.1}s both`
      }}
    >
      {children}
      <style>{`
        @keyframes staggerFadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
