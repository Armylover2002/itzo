import * as React from "react"
import { useEffect, useId, useRef, useState, useMemo } from "react"
import { cn } from "@food/utils/utils"

/**
 *  DotPattern Component Props
 *
 * @param {number} [width=16] - The horizontal spacing between dots
 * @param {number} [height=16] - The vertical spacing between dots
 * @param {number} [x=0] - The x-offset of the entire pattern
 * @param {number} [y=0] - The y-offset of the entire pattern
 * @param {number} [cx=1] - The x-offset of individual dots
 * @param {number} [cy=1] - The y-offset of individual dots
 * @param {number} [cr=1] - The radius of each dot
 * @param {string} [className] - Additional CSS classes to apply to the SVG container
 * @param {boolean} [glow=false] - Whether dots should have a glowing animation effect
 */
interface DotPatternProps extends React.SVGProps<SVGSVGElement> {
  width?: number
  height?: number
  x?: number
  y?: number
  cx?: number
  cy?: number
  cr?: number
  className?: string
  glow?: boolean
  [key: string]: unknown
}

/**
 * DotPattern Component
 *
 * The pattern automatically adjusts to fill its container and can optionally display glowing dots.
 *
 * @component
 *
 * @see DotPatternProps for the props interface.
 *
 * @example
 * // Basic usage
 * <DotPattern />
 *
 * // With glowing effect and custom spacing
 * <DotPattern
 *   width={20}
 *   height={20}
 *   glow={true}
 *   className="opacity-50"
 * />
 *
 * @notes
 * - The component is client-side only ("use client")
 * - Automatically responds to container size changes
 * - Dots color can be controlled via the text color utility classes
 */

export function DotPattern({
  width = 16,
  height = 16,
  x = 0,
  y = 0,
  cx = 1,
  cy = 1,
  cr = 1,
  className,
  glow = false,
  ...props
}: DotPatternProps) {
  const id = useId()
  const containerRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  const dots = useMemo(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return []
    
    const rows = Math.ceil(dimensions.height / height)
    const cols = Math.ceil(dimensions.width / width)
    const dotsArray: Array<{ x: number; y: number; delay: number; duration: number }> = []

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        dotsArray.push({
          x: x + j * width + cx,
          y: y + i * height + cy,
          delay: glow ? Math.random() * 2 : 0,
          duration: glow ? 1 + Math.random() * 2 : 0,
        })
      }
    }

    return dotsArray
  }, [dimensions, width, height, x, y, cx, cy, glow])

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-current",
        className
      )}
      {...props}
    >
      <defs>
        {glow && (
          <style>
            {`
              .dot-glow {
                animation: dotPulse ${dots[0]?.duration || 2}s ease-in-out infinite;
                animation-delay: ${dots[0]?.delay || 0}s;
              }
              @keyframes dotPulse {
                0%, 100% {
                  opacity: 0.3;
                  r: ${cr};
                }
                50% {
                  opacity: 1;
                  r: ${cr * 1.5};
                }
              }
            `}
          </style>
        )}
      </defs>
      <pattern
        id={`dot-pattern-${id}`}
        width={width}
        height={height}
        patternUnits="userSpaceOnUse"
        patternContentUnits="userSpaceOnUse"
        x={x}
        y={y}
      >
        {dots.map((dot, index) => (
          <circle
            key={`${dot.x}-${dot.y}-${index}`}
            cx={dot.x}
            cy={dot.y}
            r={cr}
            className={glow ? "dot-glow" : ""}
            style={glow ? {
              animationDelay: `${dot.delay}s`,
              animationDuration: `${dot.duration}s`
            } : {}}
          />
        ))}
      </pattern>
      <rect width="100%" height="100%" fill={`url(#dot-pattern-${id})`} />
    </svg>
  )
}
