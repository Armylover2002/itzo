// CSS-only AnimatedBorder - no framer-motion
export default function AnimatedBorder({ children, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <div
        style={{
          background: "linear-gradient(45deg, #fbbf24, #f97316, #fbbf24)",
          backgroundSize: "200% 200%",
        }}
      />
      <div className="absolute inset-[2px] bg-white dark:bg-gray-900 rounded-3xl" />
      <div className="relative z-10">{children}</div>
      <style>{`
        @keyframes borderGradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
          animation: borderGradient 3s linear infinite;
        }
      `}</style>
    </div>
  )
}
