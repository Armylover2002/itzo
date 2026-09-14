// CSS-only AnimatedPage - no GSAP dependency
import { useEffect, useRef } from "react"

export default function AnimatedPage({ children, className = "", style = {} }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Keep entrance animation lightweight and remove transform afterwards.
    // Persistent transform breaks descendants that use position: fixed.
    container.style.opacity = '0'
    container.style.transition = 'opacity 220ms ease, transform 220ms ease'
    container.style.transform = 'translateY(20px)'

    // Trigger animation on next frame
    requestAnimationFrame(() => {
      container.style.opacity = '1'
      container.style.transform = 'translateY(0)'
    })

    const cleanupTimer = window.setTimeout(() => {
      container.style.transform = ''
      container.style.transition = ''
    }, 260)

    return () => {
      window.clearTimeout(cleanupTimer)
    }
  }, [])

  return (
    <div ref={containerRef} className={`${className}  md:pb-0`} style={style}>
      {children}
    </div>
  )
}
