import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

const WHITE_THRESHOLD = 232

const isNearWhite = (data, i) => {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  const a = data[i + 3]
  return a > 8 && r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD
}

const removeEdgeWhite = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width
        const height = img.naturalHeight || img.height
        if (!width || !height) {
          resolve(src)
          return
        }

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, width, height)

        const imageData = ctx.getImageData(0, 0, width, height)
        const { data } = imageData
        const visited = new Uint8Array(width * height)
        const stack = []

        const enqueue = (x, y) => {
          if (x < 0 || y < 0 || x >= width || y >= height) return
          const idx = y * width + x
          if (visited[idx]) return
          visited[idx] = 1
          if (isNearWhite(data, idx * 4)) stack.push(idx)
        }

        for (let x = 0; x < width; x += 1) {
          enqueue(x, 0)
          enqueue(x, height - 1)
        }
        for (let y = 0; y < height; y += 1) {
          enqueue(0, y)
          enqueue(width - 1, y)
        }

        while (stack.length) {
          const idx = stack.pop()
          data[idx * 4 + 3] = 0
          const x = idx % width
          const y = (idx / width) | 0
          enqueue(x + 1, y)
          enqueue(x - 1, y)
          enqueue(x, y + 1)
          enqueue(x, y - 1)
        }

        let minX = width
        let minY = height
        let maxX = -1
        let maxY = -1
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (data[(y * width + x) * 4 + 3] < 12) continue
            if (x < minX) minX = x
            if (y < minY) minY = y
            if (x > maxX) maxX = x
            if (y > maxY) maxY = y
          }
        }

        ctx.putImageData(imageData, 0, 0)

        // Average color of the logo's own (non-transparent) pixels — used as the
        // circle's background so it reads as "the logo's color", not a blank white disc.
        let rSum = 0, gSum = 0, bSum = 0, count = 0
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 12) continue
          rSum += data[i]
          gSum += data[i + 1]
          bSum += data[i + 2]
          count += 1
        }
        const avgColor = count
          ? `rgb(${Math.round(rSum / count)}, ${Math.round(gSum / count)}, ${Math.round(bSum / count)})`
          : null

        if (maxX >= minX && maxY >= minY) {
          const cropW = maxX - minX + 1
          const cropH = maxY - minY + 1
          const cropped = document.createElement("canvas")
          cropped.width = cropW
          cropped.height = cropH
          cropped.getContext("2d").drawImage(canvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH)
          resolve({ dataUrl: cropped.toDataURL("image/png"), avgColor })
          return
        }

        resolve({ dataUrl: canvas.toDataURL("image/png"), avgColor })
      } catch (error) {
        reject(error)
      }
    }
    img.onerror = () => reject(new Error("logo-load-failed"))
    img.src = src
  })

export default function AuthCircleLogo({
  src,
  alt = "Logo",
  fallbackText = "B",
  className = "",
  accentClassName = "bg-primary-orange",
}) {
  const [logoSrc, setLogoSrc] = useState(src || "")
  const [bgColor, setBgColor] = useState(null)

  useEffect(() => {
    if (!src) {
      setLogoSrc("")
      setBgColor(null)
      return undefined
    }

    setLogoSrc(src)

    let cancelled = false
    removeEdgeWhite(src)
      .then(({ dataUrl, avgColor }) => {
        if (cancelled) return
        setLogoSrc(dataUrl)
        setBgColor(avgColor)
      })
      .catch(() => {
        if (cancelled) return
        setLogoSrc(src)
        setBgColor(null)
      })

    return () => {
      cancelled = true
    }
  }, [src])

  const hasImage = Boolean(logoSrc || src)
  // Background follows the logo's own average color instead of a fixed white/accent disc.
  const effectiveBg = hasImage ? (bgColor ? null : "bg-white") : (accentClassName || "bg-primary-orange")

  return (
    <div
      className={cn(
        "relative isolate flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-2xl",
        effectiveBg,
        className,
      )}
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      {hasImage ? (
        <img
          src={logoSrc || src}
          alt={alt}
          className="max-h-[88%] max-w-[88%] w-auto h-auto object-contain select-none pointer-events-none"
        />
      ) : (
        <span className="text-2xl font-black italic text-white">
          {String(fallbackText || "B").charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )
}
