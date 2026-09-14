/**
 * Rapido/Zomato-Style Route-Based Marker Animation
 * 
 * Core Principle: Marker moves on polyline, not GPS
 */

/**
 * Interpolate between two points smoothly
 * @param {Object} start - {lat, lng}
 * @param {Object} end - {lat, lng}
 * @param {number} progress - 0 to 1
 * @returns {Object} Interpolated {lat, lng}
 */
export function interpolatePoint(start, end, progress) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  
  return {
    lat: start.lat + (end.lat - start.lat) * clampedProgress,
    lng: start.lng + (end.lng - start.lng) * clampedProgress
  };
}

/**
 * Calculate bearing between two points
 * @param {Object} from - {lat, lng}
 * @param {Object} to - {lat, lng}
 * @returns {number} Bearing in degrees (0-360)
 */
export function calculateBearing(from, to) {
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  const dLng = (to.lng - from.lng) * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - 
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Smooth rotation (prevent sudden angle changes)
 * @param {number} currentBearing - Current bearing (0-360)
 * @param {number} targetBearing - Target bearing (0-360)
 * @param {number} smoothingFactor - 0 to 1 (higher = smoother)
 * @returns {number} Smoothed bearing
 */
export function smoothRotation(currentBearing, targetBearing, smoothingFactor = 0.3) {
  // Handle 360/0 wrap-around
  let diff = targetBearing - currentBearing;
  
  if (diff > 180) {
    diff -= 360;
  } else if (diff < -180) {
    diff += 360;
  }
  
  const smoothed = currentBearing + diff * smoothingFactor;
  return (smoothed + 360) % 360;
}

/**
 * Animate marker smoothly along route polyline
 * @param {Object} marker - Google Maps Marker instance
 * @param {Object} currentPos - Current position {lat, lng}
 * @param {Object} targetPos - Target position {lat, lng}
 * @param {number} duration - Animation duration in ms (default 1200ms)
 * @param {Function} onComplete - Callback when animation completes
 */
export function animateMarkerSmoothly(marker, currentPos, targetPos, duration = 1200, onComplete) {
  if (!marker || !currentPos || !targetPos) return;
  
  const startTime = Date.now();
  const startLat = currentPos.lat;
  const startLng = currentPos.lng;
  const deltaLat = targetPos.lat - startLat;
  const deltaLng = targetPos.lng - startLng;
  
  // Easing function (ease-out for natural deceleration)
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(1, elapsed / duration);
    const easedProgress = easeOutCubic(progress);
    
    const currentLat = startLat + deltaLat * easedProgress;
    const currentLng = startLng + deltaLng * easedProgress;
    
    // Update marker position
    marker.setPosition({ lat: currentLat, lng: currentLng });
    
    // Calculate and update bearing (rotation). Standard google.maps.Marker has no getRotation/setRotation; use _rotation fallback.
    const getRotation = () =>
      (typeof marker.getRotation === 'function' ? marker.getRotation() : marker._rotation) || 0;
    const setRotation = (deg) => {
      if (typeof marker.setRotation === 'function') marker.setRotation(deg);
      else marker._rotation = deg;
    };

    if (progress < 1) {
      const prevPos = progress > 0.1 
        ? { lat: startLat + deltaLat * easeOutCubic(Math.max(0, progress - 0.1)), 
            lng: startLng + deltaLng * easeOutCubic(Math.max(0, progress - 0.1)) }
        : currentPos;
      
      const bearing = calculateBearing(prevPos, { lat: currentLat, lng: currentLng });
      const currentRotation = getRotation();
      const smoothedBearing = smoothRotation(currentRotation, bearing, 0.4);
      setRotation(smoothedBearing);
      
      requestAnimationFrame(animate);
    } else {
      // Animation complete
      marker.setPosition(targetPos);
      const finalBearing = calculateBearing(currentPos, targetPos);
      setRotation(finalBearing);
      
      if (onComplete) onComplete();
    }
  };
  
  animate();
}

/**
 * Find nearest point on polyline
 * @param {Object} location - {lat, lng}
 * @param {Array} polylinePoints - Array of {lat, lng}
 * @returns {Object} {point: {lat, lng}, index: number}
 */
export function findNearestPointOnPolyline(location, polylinePoints) {
  if (!polylinePoints || polylinePoints.length === 0) return null;
  
  let minDistance = Infinity;
  let nearestIndex = 0;
  let nearestPoint = polylinePoints[0];
  
  for (let i = 0; i < polylinePoints.length; i++) {
    const distance = calculateDistance(location, polylinePoints[i]);
    if (distance < minDistance) {
      minDistance = distance;
      nearestIndex = i;
      nearestPoint = polylinePoints[i];
    }
  }
  
  return {
    point: nearestPoint,
    index: nearestIndex,
    distance: minDistance
  };
}

/**
 * Calculate distance between two points (Haversine)
 * @param {Object} point1 - {lat, lng}
 * @param {Object} point2 - {lat, lng}
 * @returns {number} Distance in meters
 */
function calculateDistance(point1, point2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get next point on polyline based on progress
 * @param {Array} polylinePoints - Array of {lat, lng}
 * @param {number} progress - 0 to 1
 * @returns {Object} {currentPoint: {lat, lng}, nextPoint: {lat, lng}, currentIndex: number}
 */
export function getPointOnPolylineByProgress(polylinePoints, progress) {
  if (!polylinePoints || polylinePoints.length === 0) return null;
  
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const totalPoints = polylinePoints.length;
  const targetIndex = Math.floor(clampedProgress * (totalPoints - 1));
  const nextIndex = Math.min(targetIndex + 1, totalPoints - 1);
  
  return {
    currentPoint: polylinePoints[targetIndex],
    nextPoint: polylinePoints[nextIndex],
    currentIndex: targetIndex,
    nextIndex: nextIndex
  };
}

/**
 * Handle GPS loss - estimate position based on last known speed and direction
 * @param {Object} lastKnownPos - {lat, lng, speed, bearing, timestamp}
 * @param {Array} polylinePoints - Route polyline points
 * @returns {Object} Estimated position {lat, lng}
 */
export function estimatePositionOnRoute(lastKnownPos, polylinePoints) {
  if (!lastKnownPos || !polylinePoints) return null;
  
  const timeSinceUpdate = (Date.now() - lastKnownPos.timestamp) / 1000; // seconds
  const speed = lastKnownPos.speed || 20; // km/h, default 20
  const speedMps = speed / 3.6; // Convert to m/s
  const estimatedDistance = speedMps * timeSinceUpdate; // meters
  
  // Find nearest point on polyline
  const nearest = findNearestPointOnPolyline(lastKnownPos, polylinePoints);
  if (!nearest) return lastKnownPos;
  
  // Move forward on polyline by estimated distance
  let remainingDistance = estimatedDistance;
  let currentIndex = nearest.index;
  
  while (remainingDistance > 0 && currentIndex < polylinePoints.length - 1) {
    const currentPoint = polylinePoints[currentIndex];
    const nextPoint = polylinePoints[currentIndex + 1];
    const segmentDistance = calculateDistance(currentPoint, nextPoint);
    
    if (segmentDistance <= remainingDistance) {
      remainingDistance -= segmentDistance;
      currentIndex++;
    } else {
      // Interpolate within this segment
      const progress = remainingDistance / segmentDistance;
      return interpolatePoint(currentPoint, nextPoint, progress);
    }
  }
  
  // Reached end of route
  return polylinePoints[polylinePoints.length - 1];
}

/**
 * Main animation controller for route-based marker movement
 */
export class RouteBasedAnimationController {
  constructor(marker, polylinePoints) {
    this.marker = marker;
    this.polylinePoints = polylinePoints;
    this.currentIndex = 0;
    this.animationFrameId = null;
    this.lastUpdateTime = Date.now();
    this.lastKnownPosition = null;
    this.isAnimating = false;
    this.lastProgress = 0; // Track last progress to prevent backward movement
  }
  
  /**
   * Update marker position based on route progress
   * @param {number} progress - 0 to 1
   * @param {number} bearing - Bearing in degrees
   */
  updatePosition(progress, bearing) {
    if (!this.polylinePoints || this.polylinePoints.length === 0) return;
    
    const pointInfo = getPointOnPolylineByProgress(this.polylinePoints, progress);
    if (!pointInfo) return;
    
    // Cancel any ongoing animation
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    const targetPos = pointInfo.nextPoint;
    const currentPos = this.marker.getPosition();
    
    if (currentPos) {
      const currentLatLng = {
        lat: currentPos.lat(),
        lng: currentPos.lng()
      };
      
      // Animate smoothly to target
      this.isAnimating = true;
      animateMarkerSmoothly(
        this.marker,
        currentLatLng,
        targetPos,
        1200, // 1.2 seconds
        () => {
          this.isAnimating = false;
        }
      );
    } else {
      // First time - set position directly
      this.marker.setPosition(targetPos);
      if (bearing !== undefined) {
        if (typeof this.marker.setRotation === 'function') this.marker.setRotation(bearing);
        else this.marker._rotation = bearing;
      }
    }
    
    this.currentIndex = pointInfo.currentIndex;
    this.lastProgress = progress; // Store progress to prevent backward movement
    this.lastUpdateTime = Date.now();
    this.lastKnownPosition = {
      ...targetPos,
      speed: 20,
      bearing: bearing || 0,
      timestamp: Date.now()
    };
  }
  
  /**
   * Handle GPS loss - continue animation based on estimated position
   */
  handleGPSLoss() {
    if (!this.lastKnownPosition || !this.polylinePoints) return;
    
    const estimatedPos = estimatePositionOnRoute(this.lastKnownPosition, this.polylinePoints);
    if (estimatedPos) {
      const currentPos = this.marker.getPosition();
      if (currentPos) {
        const currentLatLng = {
          lat: currentPos.lat(),
          lng: currentPos.lng()
        };
        
        // Slow down animation (50% speed) when GPS is lost
        animateMarkerSmoothly(
          this.marker,
          currentLatLng,
          estimatedPos,
          2000, // Slower animation
          () => {
            this.isAnimating = false;
          }
        );
      }
    }
  }
  
  /**
   * Update polyline points (when route changes)
   * @param {Array} newPolylinePoints - New polyline points
   */
  updatePolyline(newPolylinePoints) {
    this.polylinePoints = newPolylinePoints;
    this.currentIndex = 0;
  }
  
  /**
   * Cleanup
   */
  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.marker = null;
    this.polylinePoints = null;
  }
}
