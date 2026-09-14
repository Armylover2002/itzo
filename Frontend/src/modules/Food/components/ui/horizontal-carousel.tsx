"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { cn } from "@food/utils/utils"

interface HorizontalCarouselProps {
  children: React.ReactNode
  className?: string
  containerClassName?: string
  showControls?: boolean
  controlsPosition?: "top-right" | "top-left" | "bottom-center" | "top-center"
  header?: React.ReactNode
}

export function HorizontalCarousel({
  children,
  className,
  containerClassName,
  showControls = true,
  controlsPosition = "top-right",
  header,
}: HorizontalCarouselProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const touchStartX = React.useRef(0)
  const touchStartY = React.useRef(0)

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 400
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  // Prevent vertical scroll only when scrolling horizontally
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      const deltaX = Math.abs(e.deltaX)
      const deltaY = Math.abs(e.deltaY)
      
      // Only prevent vertical scroll if horizontal scroll is significantly greater
      // and there's actual horizontal scroll space available
      if (deltaX > deltaY && deltaX > 10) {
        const canScrollLeft = scrollLeft > 0
        const canScrollRight = scrollLeft < scrollWidth - clientWidth - 1
        
        // Only prevent if we can actually scroll horizontally
        if (canScrollLeft || canScrollRight) {
          e.preventDefault()
          e.stopPropagation()
          scrollRef.current.scrollLeft += e.deltaX
          return
        }
      }
      
      // Allow vertical scrolling to pass through if not horizontal scrolling
    }
  }

  // Prevent vertical scroll on touch devices only when scrolling horizontally
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return

    const touchCurrentX = e.touches[0].clientX
    const touchCurrentY = e.touches[0].clientY
    const diffX = Math.abs(touchCurrentX - touchStartX.current)
    const diffY = Math.abs(touchCurrentY - touchStartY.current)

    // Only prevent vertical scroll if horizontal movement is significantly greater
    // and there's actual horizontal scroll space
    if (diffX > diffY && diffX > 10) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      const canScrollLeft = scrollLeft > 0
      const canScrollRight = scrollLeft < scrollWidth - clientWidth - 1

      // Only prevent if we can actually scroll horizontally
      if (canScrollLeft || canScrollRight) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
    }
    
    // Allow vertical scrolling to pass through if not horizontal scrolling
  }

  const controlsClass = {
    "top-right": "absolute top-0 right-0 flex items-center gap-2",
    "top-left": "absolute top-0 left-0 flex items-center gap-2",
    "bottom-center": "absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-2",
    "top-center": "absolute top-0 left-1/2 -translate-x-1/2 flex items-center gap-2",
  }[controlsPosition]

  return (
    <div className={cn("relative", className)}>
      {(header || showControls) && (
        <div className="flex items-center justify-between mb-4">
          {header && <div className="flex items-center gap-3">{header}</div>}
          {showControls && (
            <div className={cn("flex items-center gap-2", controlsPosition === "top-left" && "ml-auto")}>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 bg-white/90 backdrop-blur-sm shadow-lg hover:bg-white rounded-full border border-gray-200"
                onClick={() => scroll("left")}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 bg-white/90 backdrop-blur-sm shadow-lg hover:bg-white rounded-full border border-gray-200"
                onClick={() => scroll("right")}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      )}
      <div
        ref={scrollRef}
        className={cn(
          "flex gap-5 overflow-x-auto overflow-y-visible scrollbar-hide scroll-smooth px-1 sm:px-2 py-4 sm:py-6",
          containerClassName
        )}
        style={{ 
          scrollbarWidth: "none", 
          msOverflowStyle: "none",
          touchAction: "pan-x pan-y pinch-zoom",
          overflowY: "hidden",
          height: "min-content"
        }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {children}
      </div>
    </div>
  )
}

