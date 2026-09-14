// CSS-only ShimmerCard - no framer-motion, no infinite animations
import { useState } from "react"

export default function ShimmerCard({ children, className = "", delay = 0 }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden ${className}`}
      style={{
        opacity: 1,
        transform: 'scale(1)',
      }}
    >
      {/* Simple shimmer effect using CSS */}
      {isHovered && (
        <div
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255, 193, 7, 0.1), transparent)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s ease-in-out infinite',
          }}
        />
      )}
      {children}
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  )
}
