import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { optimizeCloudinaryUrl } from '../../../shared/utils/cloudinaryUtils'
import { resolveImageFallbacks } from '../../quickCommerce/user/utils/image'

/**
 * OptimizedImage Component
 * 
 * Features:
 * - Lazy loading with Intersection Observer
 * - Responsive srcset for different screen sizes
 * - WebP/AVIF format support with fallback
 * - Blur placeholder (LQIP) for smooth loading
 * - Preloading for critical images
 * - Proper decoding and fetchpriority
 * - Error handling with fallback
 */
const OptimizedImage = React.memo(({
  src,
  alt,
  className = '',
  priority = false, // For above-the-fold images
  sizes = '100vw',
  objectFit = 'cover',
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  onError,
  backendOrigin = "",
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [srcIndex, setSrcIndex] = useState(0)
  const [isInView, setIsInView] = useState(priority) // Start visible if priority
  const imgRef = useRef(null)
  const observerRef = useRef(null)

  // Reset state when src changes
  useEffect(() => {
    setIsLoaded(false)
    setHasError(false)
    setSrcIndex(0)
  }, [src])

  // Check if image URL supports optimization (external URLs)
  const supportsOptimization = (imageSrc) => {
    if (!imageSrc || typeof imageSrc !== 'string' || imageSrc === '') return false
    if (imageSrc.startsWith('data:') || imageSrc.startsWith('/')) return false
    // Check if it's an external URL (http/https)
    return /^https?:\/\//.test(imageSrc)
  }

  const appendImageParams = (imageSrc, params) => {
    try {
      const url = new URL(imageSrc)
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value))
      })
      if (imageSrc.includes('/uploads/')) {
        url.searchParams.set('cb', '2');
      }
      return url.toString()
    } catch {
      return imageSrc
    }
  }

  const resolveUrl = (url) => {
    if (!url || typeof url !== 'string') return ""
    if (/^(https?:|\/\/|data:|blob:)/i.test(url.trim())) return url
    // Only prepend backendOrigin if it's an uploaded file from backend
    if (url.startsWith('/uploads/')) {
        return backendOrigin ? `${backendOrigin.replace(/\/$/, "")}${url}` : url
    }
    return url
  }

  const fallbacks = useMemo(() => resolveImageFallbacks(src), [src])
  const resolvedSrc = useMemo(() => {
    if (!fallbacks || fallbacks.length === 0) return resolveUrl(src)
    return resolveUrl(fallbacks[srcIndex < fallbacks.length ? srcIndex : fallbacks.length - 1])
  }, [fallbacks, srcIndex, backendOrigin, src])

  // Generate responsive srcset
  const srcSet = useMemo(() => {
    if (!supportsOptimization(resolvedSrc)) return undefined
    const sizesArr = [400, 600, 800, 1200, 1600]
    
    return sizesArr
      .map(size => `${appendImageParams(resolvedSrc, { w: size, q: 80 })} ${size}w`)
      .join(', ')
  }, [resolvedSrc])

  // Generate WebP srcset
  const webPSrcSet = useMemo(() => {
    if (!supportsOptimization(resolvedSrc)) return undefined
    const sizesArr = [400, 600, 800, 1200, 1600]

    return sizesArr
      .map(size => `${appendImageParams(resolvedSrc, { w: size, q: 80, format: 'webp' })} ${size}w`)
      .join(', ')
  }, [resolvedSrc])

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return

    if (!imgRef.current) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true)
            if (observerRef.current && imgRef.current) {
              observerRef.current.unobserve(imgRef.current)
            }
          }
        })
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01
      }
    )

    observerRef.current.observe(imgRef.current)

    return () => {
      if (observerRef.current && imgRef.current) {
        observerRef.current.unobserve(imgRef.current)
      }
    }
  }, [priority, isInView])

  const handleLoad = (e) => {
    setIsLoaded(true)
    if (onLoad) onLoad(e)
  }

  const handleError = (e) => {
    if (fallbacks && srcIndex < fallbacks.length - 1) {
      setSrcIndex(prev => prev + 1)
      setIsLoaded(false)
    } else {
      setHasError(true)
      if (onError) onError(e)
    }
  }

  // Default blur placeholder (tiny gray square)
  const defaultBlurDataURL = blurDataURL || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2U1ZTdlYiIvPjwvc3ZnPg=='

  // Don't render if src is empty or null
  if (!src || src === '') {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <span className="text-xs text-gray-400 dark:text-gray-600">Image unavailable</span>
        </div>
      </div>
    )
  }

  const imageSrc = hasError ? '/itzo-quick-logo.png' : resolvedSrc

  return (
    <div className={`relative overflow-hidden ${className}`} ref={imgRef}>
      {/* Blur Placeholder */}
      {placeholder === 'blur' && !isLoaded && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 1 }}
          animate={{ opacity: isLoaded ? 0 : 1 }}
          transition={{ duration: 0.3 }}
          style={{
            backgroundImage: `url(${defaultBlurDataURL})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
          }}
        />
      )}

      {/* Loading Skeleton */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 animate-pulse" />
      )}

      {/* Actual Image */}
      {isInView && (
        <picture className="absolute inset-0 w-full h-full">
          {/* WebP source for modern browsers */}
          {webPSrcSet && (
            <source
              srcSet={webPSrcSet}
              sizes={sizes}
              type="image/webp"
            />
          )}

          {/* Fallback to original format */}
          <motion.img
            src={imageSrc}
            srcSet={srcSet}
            sizes={supportsOptimization(imageSrc) ? sizes : undefined}
            alt={alt}
            className={`w-full h-full ${objectFit === 'cover' ? 'object-cover' : objectFit === 'contain' ? 'object-contain' : ''} ${priority || isLoaded ? 'opacity-100' : 'opacity-0'} ${!priority && 'transition-opacity duration-300'}`}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={handleLoad}
            onError={handleError}
            {...props}
          />
        </picture>
      )}

      {/* Removed separate Error State since we fall back to ITZO logo */}
    </div>
  )
})

export default OptimizedImage
