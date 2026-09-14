// CSS-only TextAnimate - no framer-motion
import { ElementType, memo, useEffect, useRef, useState } from "react"
import { cn } from "@food/utils/utils"

type AnimationType = "text" | "word" | "character" | "line"
type AnimationVariant =
  | "fadeIn"
  | "blurIn"
  | "blurInUp"
  | "blurInDown"
  | "slideUp"
  | "slideDown"
  | "slideLeft"
  | "slideRight"
  | "scaleUp"
  | "scaleDown"

interface TextAnimateProps {
  children: string
  className?: string
  segmentClassName?: string
  delay?: number
  duration?: number
  as?: ElementType
  by?: AnimationType
  startOnView?: boolean
  once?: boolean
  animation?: AnimationVariant
  accessible?: boolean
}

const staggerTimings: Record<AnimationType, number> = {
  text: 0.06,
  word: 0.05,
  character: 0.03,
  line: 0.06,
}

const getAnimationClass = (animation: AnimationVariant): string => {
  const classes: Record<AnimationVariant, string> = {
  }
  return classes[animation] || classes.fadeIn
}

const TextAnimateBase = ({
  children,
  delay = 0,
  duration = 0.3,
  className,
  segmentClassName,
  as: Component = "p",
  startOnView = true,
  once = false,
  by = "word",
  animation = "fadeIn",
  accessible = true,
  ...props
}: TextAnimateProps) => {
  const ref = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(!startOnView)

  useEffect(() => {
    if (!startOnView) {
      setIsVisible(true)
      return
    }

    const element = ref.current
    if (!element) return

    const checkVisibility = () => {
      const rect = element.getBoundingClientRect()
      const windowHeight = window.innerHeight || document.documentElement.clientHeight
      const isInView = rect.top < windowHeight && rect.bottom > 0

      if (isInView) {
        setIsVisible(true)
        if (once) {
          window.removeEventListener('scroll', handleScroll)
        }
      }
    }

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

    checkVisibility()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [startOnView, once])

  let segments: string[] = []
  switch (by) {
    case "word":
      segments = children.split(/(\s+)/)
      break
    case "character":
      segments = children.split("")
      break
    case "line":
      segments = children.split("\n")
      break
    case "text":
    default:
      segments = [children]
      break
  }

  const animationClass = getAnimationClass(animation)
  const staggerDelay = duration / segments.length

  return (
    <Component
      ref={ref}
      className={cn("whitespace-pre-wrap", className)}
      aria-label={accessible ? children : undefined}
      {...props}
    >
      {accessible && <span className="sr-only">{children}</span>}
      {segments.map((segment, i) => (
        <span
          key={`${by}-${segment}-${i}`}
          className={cn(
            by === "line" ? "block" : "inline-block whitespace-pre",
            segmentClassName,
            isVisible ? animationClass : "opacity-0"
          )}
          style={{
            animationDelay: isVisible ? `${delay + i * staggerDelay}s` : '0s',
            animationFillMode: 'both'
          }}
          aria-hidden={accessible ? true : undefined}
        >
          {segment}
        </span>
      ))}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes blurIn {
          from { opacity: 0; filter: blur(10px); }
          to { opacity: 1; filter: blur(0px); }
        }
        @keyframes blurInUp {
          from { opacity: 0; filter: blur(10px); transform: translateY(20px); }
          to { opacity: 1; filter: blur(0px); transform: translateY(0); }
        }
        @keyframes blurInDown {
          from { opacity: 0; filter: blur(10px); transform: translateY(-20px); }
          to { opacity: 1; filter: blur(0px); transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideLeft {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes scaleDown {
          from { opacity: 0; transform: scale(1.5); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </Component>
  )
}

export const TextAnimate = memo(TextAnimateBase)
