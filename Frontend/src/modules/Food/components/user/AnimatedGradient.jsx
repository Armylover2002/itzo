// CSS-only AnimatedGradient - no framer-motion
export default function AnimatedGradient({ children, className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <div
        style={{
          backgroundSize: "200% 200%",
        }}
      />
      <div className="relative z-10">{children}</div>
      <style>{`
        @keyframes gradientMove {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
          animation: gradientMove 5s linear infinite;
        }
      `}</style>
    </div>
  )
}
