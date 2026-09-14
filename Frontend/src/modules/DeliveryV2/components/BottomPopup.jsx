import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronDown } from "lucide-react"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


/**
 * BottomPopup Component
 * A reusable animated bottom popup that can be dismissed by swiping down
 * 
 * @param {boolean} isOpen - Controls popup visibility
 * @param {function} onClose - Callback when popup is closed
 * @param {ReactNode} children - Content to display in popup
 * @param {string} title - Optional title for the popup
 * @param {boolean} showCloseButton - Show close button (default: true)
 * @param {boolean} closeOnBackdropClick - Close when backdrop is clicked (default: true)
 * @param {string} maxHeight - Maximum height of popup (default: "90vh")
 * @param {boolean} showHandle - Show drag handle (default: true)
 * @param {boolean} disableSwipeToClose - Disable swipe-to-close functionality (default: false)
 * @param {boolean} showBackdrop - Show backdrop overlay (default: true)
 * @param {boolean} backdropBlocksInteraction - Whether backdrop blocks pointer events (default: true)
 */
export default function BottomPopup({
  isOpen,
  onClose,
  children,
  title,
  showCloseButton = true,
  closeOnBackdropClick = true,
  maxHeight = "90vh",
  showHandle = true,
  disableSwipeToClose = false,
  collapsedContent = null, // Content to show when collapsed (e.g., Reached pickup button)
  showBackdrop = true, // Show backdrop overlay
  backdropBlocksInteraction = true, // Whether backdrop blocks pointer events
  closeOnHandleClick = true // Default to true to prevent accidental collapse
}) {
  const popupRef = useRef(null)
  const handleRef = useRef(null)
  const swipeStartY = useRef(0)
  const isSwiping = useRef(false)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Reset drag state when popup closes
  useEffect(() => {
    if (!isOpen) {
      setDragY(0)
      setIsDragging(false)
      isSwiping.current = false
      setIsCollapsed(false)
    }
  }, [isOpen])

  // Handle collapse toggle
  const handleCollapseToggle = (e) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    setIsCollapsed(prev => {
      const newState = !prev
      debugLog('?? Collapse toggle:', prev, '->', newState)
      return newState
    })
  }

  // Handle touch start for swipe detection
  const handleTouchStart = (e) => {
    if (disableSwipeToClose) return
    const target = e.target
    const isHandle = handleRef.current?.contains(target)

    // If clicking on handle, don't start swipe - handle will toggle collapse
    if (isHandle) {
      return
    }

    // Check if touch is in handle area or top portion of popup
    const rect = popupRef.current?.getBoundingClientRect()
    if (!rect) return

    const touchY = e.touches[0].clientY
    const handleArea = rect.top + 80 // Top 80px is swipeable area

    // Allow swipe if touching top area (but not handle)
    if (touchY <= handleArea) {
      e.stopPropagation()
      swipeStartY.current = touchY
      isSwiping.current = true
      setIsDragging(true)
    }
  }

  // Handle touch move for swipe
  const handleTouchMove = (e) => {
    if (disableSwipeToClose) return
    if (!isSwiping.current || !isOpen) return

    const currentY = e.touches[0].clientY
    const deltaY = currentY - swipeStartY.current

    // Only allow downward swipe (positive deltaY)
    // Don't call preventDefault - CSS touch-action: none handles scrolling prevention
    if (deltaY > 0) {
      // e.preventDefault() // Removed to avoid passive listener error - CSS touch-action handles it
      e.stopPropagation()
      setDragY(deltaY)
    }
  }

  // Handle touch end - determine if should close
  const handleTouchEnd = (e) => {
    if (disableSwipeToClose) {
      isSwiping.current = false
      setIsDragging(false)
      return
    }
    if (!isSwiping.current) {
      isSwiping.current = false
      setIsDragging(false)
      return
    }

    e.stopPropagation()

    const deltaY = swipeStartY.current - e.changedTouches[0].clientY
    const threshold = 70 // Minimum swipe distance to close

    // If swiped down enough, close the popup
    if (deltaY < -threshold) {
      handleClose()
    } else {
      // Reset position with animation
      setDragY(0)
      setIsDragging(false)
    }

    isSwiping.current = false
    swipeStartY.current = 0
  }

  // Handle hardware/browser back button to close popup
  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ popup: true }, "");
      const handlePopState = () => handleClose();
      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
        if (window.history.state?.popup) window.history.back();
      };
    }
  }, [isOpen]);

  // Handle mouse events for desktop drag support
  const handleMouseDown = (e) => {
    // Don't allow swipe if disabled
    if (disableSwipeToClose) return

    const target = e.target
    const isHandle = handleRef.current?.contains(target)

    // If clicking on handle, don't start swipe - handle will toggle collapse
    if (isHandle) {
      e.stopPropagation()
      return
    }

    const rect = popupRef.current?.getBoundingClientRect()
    if (!rect) return

    const mouseY = e.clientY
    const handleArea = rect.top + 80

    if (mouseY <= handleArea) {
      e.preventDefault()
      e.stopPropagation()
      swipeStartY.current = mouseY
      isSwiping.current = true
      setIsDragging(true)
    }
  }

  const handleMouseMove = (e) => {
    // Don't allow swipe if disabled
    if (disableSwipeToClose || !isSwiping.current || !isOpen) return

    const currentY = e.clientY
    const deltaY = currentY - swipeStartY.current

    if (deltaY > 0) {
      // e.preventDefault() // Not needed for mouse events, but keeping for consistency
      setDragY(deltaY)
    }
  }

  const handleMouseUp = (e) => {
    // Don't allow swipe if disabled
    if (disableSwipeToClose || !isSwiping.current) {
      isSwiping.current = false
      setIsDragging(false)
      return
    }

    const deltaY = swipeStartY.current - e.clientY
    const threshold = 100

    if (deltaY < -threshold) {
      handleClose()
    } else {
      setDragY(0)
      setIsDragging(false)
    }

    isSwiping.current = false
    swipeStartY.current = 0
  }

  // Prevent body scroll when popup is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Handle backdrop click - close only when clicking the backdrop itself
  const handleBackdropClick = (e) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      handleClose()
    }
  }

  // Prevent clicks inside popup from closing it
  const handlePopupClick = (e) => {
    // Don't stop propagation if clicking on handle - let handle handle its own click
    if (handleRef.current && handleRef.current.contains(e.target)) {
      return
    }
    e.stopPropagation()
  }

  // Close handler
  const handleClose = () => {
    setDragY(0)
    setIsDragging(false)
    isSwiping.current = false
    if (onClose) {
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          {showBackdrop && backdropBlocksInteraction && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleBackdropClick}
              className="fixed inset-0 bg-black/50 z-[100]"
            />
          )}

          {/* Popup */}
          <motion.div
            ref={popupRef}
            initial={{ y: "100%" }}
            animate={{
              y: isDragging ? dragY : 0,
              transition: isDragging ? { duration: 0 } : {
                type: "spring",
                damping: 30,
                stiffness: 300
              }
            }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={(e) => {
              // Don't stop propagation if clicking on handle
              if (handleRef.current && handleRef.current.contains(e.target)) {
                return
              }
              handlePopupClick(e)
            }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[110] overflow-hidden flex flex-col"
            style={{
              maxHeight: isCollapsed ? "120px" : maxHeight,
              touchAction: disableSwipeToClose ? 'auto' : 'none'
            }}
          >
            {/* Top Drag Handle Bar - Always visible for dragging */}
            {showHandle && (
              <button
                ref={handleRef}
                type="button"
                className="flex flex-col items-center pt-3 pb-2 cursor-pointer select-none bg-white sticky top-0 z-10 w-full border-0 outline-none p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  if (closeOnHandleClick) {
                    handleClose()
                  } else {
                    handleCollapseToggle(e)
                  }
                }}
                onTouchStart={(e) => {
                  // Store touch start for click detection
                  e.stopPropagation()
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  if (closeOnHandleClick) {
                    handleClose()
                  } else {
                    handleCollapseToggle(e)
                  }
                }}
                onMouseDown={(e) => {
                  // Prevent drag when clicking handle
                  e.stopPropagation()
                }}
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                  pointerEvents: 'auto',
                  userSelect: 'none',
                  background: 'transparent'
                }}
              >
                <div
                  className="w-12 h-1.5 bg-gray-300 rounded-full pointer-events-none"
                />
              </button>
            )}

            {/* Header */}
            {(title || showCloseButton) && (
              <div className={`flex items-center justify-between px-4 pb-3 border-b border-gray-100 ${!showHandle ? 'pt-5' : ''}`}>
                {title && (
                  <h3 className="text-lg font-semibold text-gray-900">
                    {title}
                  </h3>
                )}
                {showCloseButton && (
                  <button
                    onClick={handleClose}
                    className="ml-auto p-2 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-6 h-6 text-gray-600" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            {!isCollapsed ? (
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {children}
              </div>
            ) : (
              <div className="px-4 py-4 pb-6">
                {collapsedContent}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

