/**
 * Live Tracking Polyline Utility
 * 
 * Provides functions for:
 * - Decoding Google Maps encoded polylines
 * - Finding nearest point on polyline
 * - Trimming polyline based on rider position
 * - Calculating distances and bearings
 * - Smooth marker animation
 */

/**
 * Decode Google Maps encoded polyline string to array of LatLng points
 * @param {string} encoded - Encoded polyline string from Google Directions API
 * @returns {Array<{lat: number, lng: number}>} Array of coordinate objects
 */
export function decodePolyline(encoded) {
  if (!encoded) return [];
  
  const poly = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlat = ((result & 1) !== 0) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;
    
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    
    const dlng = ((result & 1) !== 0) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    poly.push({
      lat: lat * 1e-5,
      lng: lng * 1e-5
    });
  }

  return poly;
}

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const toFinitePoint = (point) => {
  if (!point) return null;
  const lat = Number(point.lat ?? point.latitude);
  const lng = Number(point.lng ?? point.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { ...point, lat, lng } : null;
};

const getSqDist = (p1, p2) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
};

const getSqSegDist = (point, start, end) => {
  let x = start.x;
  let y = start.y;
  let dx = end.x - x;
  let dy = end.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((point.x - x) * dx + (point.y - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = end.x;
      y = end.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = point.x - x;
  dy = point.y - y;
  return dx * dx + dy * dy;
};

const simplifyRadialDist = (points, sqTolerance) => {
  let prevPoint = points[0];
  const newPoints = [prevPoint];
  let point = prevPoint;

  for (let i = 1; i < points.length; i++) {
    point = points[i];
    if (getSqDist(point, prevPoint) > sqTolerance) {
      newPoints.push(point);
      prevPoint = point;
    }
  }

  if (prevPoint !== point) newPoints.push(point);
  return newPoints;
};

const simplifyDPStep = (points, first, last, sqTolerance, simplified) => {
  let maxSqDist = sqTolerance;
  let index = -1;

  for (let i = first + 1; i < last; i++) {
    const sqDist = getSqSegDist(points[i], points[first], points[last]);
    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }

  if (index > -1) {
    if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
    simplified.push(points[index]);
    if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
  }
};

const simplifyDouglasPeucker = (points, sqTolerance) => {
  const last = points.length - 1;
  const simplified = [points[0]];
  simplifyDPStep(points, 0, last, sqTolerance, simplified);
  simplified.push(points[last]);
  return simplified;
};

/**
 * simplify-js style route reduction, but projected to meters before simplifying.
 * This keeps tolerance consistent in India, Europe, or anywhere else on the map.
 * @param {Array<{lat: number, lng: number}>} polyline
 * @param {{toleranceMeters?: number, highestQuality?: boolean}} options
 * @returns {Array<{lat: number, lng: number}>}
 */
export function simplifyLivePolyline(polyline, options = {}) {
  if (!Array.isArray(polyline) || polyline.length <= 2) {
    return Array.isArray(polyline) ? polyline : [];
  }

  const normalized = polyline.map(toFinitePoint).filter(Boolean);
  if (normalized.length <= 2) return normalized;

  const toleranceMeters = Math.max(0.5, Number(options.toleranceMeters) || 4);
  const avgLat = normalized.reduce((sum, point) => sum + point.lat, 0) / normalized.length;
  const lngScale = 111320 * Math.cos((avgLat * Math.PI) / 180);
  const latScale = 110540;
  const projected = normalized.map((point, index) => ({
    x: point.lng * lngScale,
    y: point.lat * latScale,
    index,
  }));

  const sqTolerance = toleranceMeters * toleranceMeters;
  const coarse = options.highestQuality
    ? projected
    : simplifyRadialDist(projected, sqTolerance);
  const simplified = simplifyDouglasPeucker(coarse, sqTolerance);

  return simplified.map((point) => normalized[point.index]);
}

/**
 * Calculate distance from a point to a line segment
 * @param {Object} point - {lat, lng}
 * @param {Object} lineStart - {lat, lng}
 * @param {Object} lineEnd - {lat, lng}
 * @returns {number} Distance in meters
 */
export function distanceToLineSegment(point, lineStart, lineEnd) {
  const A = point.lat - lineStart.lat;
  const B = point.lng - lineStart.lng;
  const C = lineEnd.lat - lineStart.lat;
  const D = lineEnd.lng - lineStart.lng;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = lineStart.lat;
    yy = lineStart.lng;
  } else if (param > 1) {
    xx = lineEnd.lat;
    yy = lineEnd.lng;
  } else {
    xx = lineStart.lat + param * C;
    yy = lineStart.lng + param * D;
  }

  // Convert to meters using Haversine
  return calculateDistance(point.lat, point.lng, xx, yy);
}

/**
 * Find the nearest point on polyline to the rider's current position
 * Returns the index of the segment and the projected point
 * @param {Array<{lat: number, lng: number}>} polyline - Array of polyline points
 * @param {Object} riderPosition - {lat, lng} Current rider position
 * @returns {Object} {segmentIndex, nearestPoint, distance} - Segment index, nearest point, and distance
 */
export function findNearestPointOnPolyline(polyline, riderPosition) {
  if (!polyline || polyline.length < 2) {
    return {
      segmentIndex: 0,
      nearestPoint: riderPosition,
      distance: Infinity,
      segmentProgress: 0,
      distanceAlongRoute: 0,
      totalDistance: 0,
      remainingDistance: 0
    };
  }

  let minDistance = Infinity;
  let nearestSegmentIndex = 0;
  let nearestPoint = polyline[0];
  let nearestSegmentProgress = 0;
  const cumulativeDistances = [0];

  for (let i = 0; i < polyline.length - 1; i++) {
    const start = polyline[i];
    const end = polyline[i + 1];
    const segmentDistance = calculateDistance(start.lat, start.lng, end.lat, end.lng);
    cumulativeDistances[i + 1] = cumulativeDistances[i] + segmentDistance;
  }

  // Check each segment of the polyline
  for (let i = 0; i < polyline.length - 1; i++) {
    const segmentStart = polyline[i];
    const segmentEnd = polyline[i + 1];
    
    const distance = distanceToLineSegment(riderPosition, segmentStart, segmentEnd);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestSegmentIndex = i;
      
      // Calculate the actual nearest point on this segment
      const A = riderPosition.lat - segmentStart.lat;
      const B = riderPosition.lng - segmentStart.lng;
      const C = segmentEnd.lat - segmentStart.lat;
      const D = segmentEnd.lng - segmentStart.lng;
      
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = 0;
      
      if (lenSq !== 0) {
        param = Math.max(0, Math.min(1, dot / lenSq));
      }
      nearestSegmentProgress = param;
      
      nearestPoint = {
        lat: segmentStart.lat + param * C,
        lng: segmentStart.lng + param * D
      };
    }
  }

  const totalDistance = cumulativeDistances[cumulativeDistances.length - 1] || 0;
  const segmentStartDistance = cumulativeDistances[nearestSegmentIndex] || 0;
  const segmentEndDistance = cumulativeDistances[nearestSegmentIndex + 1] || segmentStartDistance;
  const segmentDistance = Math.max(0, segmentEndDistance - segmentStartDistance);
  const distanceAlongRoute = segmentStartDistance + (segmentDistance * nearestSegmentProgress);

  return {
    segmentIndex: nearestSegmentIndex,
    nearestPoint,
    distance: minDistance,
    segmentProgress: nearestSegmentProgress,
    distanceAlongRoute,
    totalDistance,
    remainingDistance: Math.max(0, totalDistance - distanceAlongRoute)
  };
}

/**
 * Trim polyline to remove points behind the rider
 * Keeps only the forward route from the nearest point onwards
 * @param {Array<{lat: number, lng: number}>} polyline - Full polyline points
 * @param {Object} nearestPoint - {lat, lng} Nearest point on polyline to rider
 * @param {number} segmentIndex - Index of the segment containing nearest point
 * @returns {Array<{lat: number, lng: number}>} Trimmed polyline starting from nearest point
 */
export function trimPolylineBehindRider(polyline, nearestPoint, segmentIndex) {
  if (!polyline || polyline.length < 2) {
    return polyline || [];
  }

  // Start from the nearest point
  const trimmedPolyline = [nearestPoint];
  
  // Add all points after the segment containing the nearest point
  for (let i = segmentIndex + 1; i < polyline.length; i++) {
    trimmedPolyline.push(polyline[i]);
  }

  return trimmedPolyline;
}

/**
 * Trim polyline from an absolute distance traveled along the route.
 * Useful for forward-only progress clamping so route never grows backward due to GPS noise.
 * @param {Array<{lat: number, lng: number}>} polyline - Full polyline points
 * @param {number} distanceAlongRouteMeters - Distance covered from route start in meters
 * @returns {{
 *   trimmedPolyline: Array<{lat: number, lng: number}>,
 *   nearestPoint: {lat: number, lng: number} | null,
 *   segmentIndex: number,
 *   totalDistance: number,
 *   distanceAlongRoute: number,
 *   progress: number,
 *   remainingDistance: number
 * }}
 */
export function trimPolylineFromDistanceAlongRoute(polyline, distanceAlongRouteMeters) {
  if (!Array.isArray(polyline) || polyline.length < 2) {
    return {
      trimmedPolyline: Array.isArray(polyline) ? polyline : [],
      nearestPoint: polyline?.[0] || null,
      segmentIndex: 0,
      totalDistance: 0,
      distanceAlongRoute: 0,
      progress: 0,
      remainingDistance: 0
    };
  }

  const targetDistanceRaw = Number(distanceAlongRouteMeters);
  const segmentDistances = [];
  let totalDistance = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const start = polyline[i];
    const end = polyline[i + 1];
    const segmentDistance = calculateDistance(start.lat, start.lng, end.lat, end.lng);
    segmentDistances.push(segmentDistance);
    totalDistance += segmentDistance;
  }

  const targetDistance = Math.max(0, Math.min(
    Number.isFinite(targetDistanceRaw) ? targetDistanceRaw : 0,
    totalDistance
  ));

  if (targetDistance <= 0) {
    return {
      trimmedPolyline: polyline,
      nearestPoint: polyline[0],
      segmentIndex: 0,
      totalDistance,
      distanceAlongRoute: 0,
      progress: 0,
      remainingDistance: totalDistance
    };
  }

  let traversed = 0;
  for (let i = 0; i < segmentDistances.length; i++) {
    const segmentDistance = segmentDistances[i];
    const nextTraversed = traversed + segmentDistance;

    if (targetDistance <= nextTraversed || i === segmentDistances.length - 1) {
      const start = polyline[i];
      const end = polyline[i + 1];
      const segmentProgress = segmentDistance > 0
        ? Math.max(0, Math.min(1, (targetDistance - traversed) / segmentDistance))
        : 0;
      const nearestPoint = {
        lat: start.lat + ((end.lat - start.lat) * segmentProgress),
        lng: start.lng + ((end.lng - start.lng) * segmentProgress)
      };

      return {
        trimmedPolyline: [nearestPoint, ...polyline.slice(i + 1)],
        nearestPoint,
        segmentIndex: i,
        totalDistance,
        distanceAlongRoute: targetDistance,
        progress: totalDistance > 0 ? targetDistance / totalDistance : 0,
        remainingDistance: Math.max(0, totalDistance - targetDistance)
      };
    }

    traversed = nextTraversed;
  }

  const lastPoint = polyline[polyline.length - 1];
  return {
    trimmedPolyline: [lastPoint],
    nearestPoint: lastPoint,
    segmentIndex: polyline.length - 2,
    totalDistance,
    distanceAlongRoute: totalDistance,
    progress: 1,
    remainingDistance: 0
  };
}

/**
 * Build the visible route for a live-tracking map.
 * When the rider is on-route, only show the remaining route ahead.
 * When the rider goes off-route, prepend the current rider location so the wrong-way
 * stretch becomes visible until they rejoin the planned path.
 * @param {Array<{lat: number, lng: number}>} polyline
 * @param {{lat: number, lng: number}} riderPosition
 * @param {{offRouteThresholdMeters?: number}} options
 * @returns {{
 *   visiblePolyline: Array<{lat: number, lng: number}>,
 *   snappedPoint: {lat: number, lng: number} | null,
 *   isOffRoute: boolean,
 *   progress: number,
 *   distanceFromRoute: number,
 *   remainingDistance: number
 * }}
 */
export function buildVisibleRouteFromRiderPosition(polyline, riderPosition, options = {}) {
  if (!Array.isArray(polyline) || polyline.length < 2 || !riderPosition) {
    return {
      visiblePolyline: Array.isArray(polyline) ? polyline : [],
      snappedPoint: null,
      isOffRoute: false,
      progress: 0,
      distanceAlongRoute: 0,
      distanceFromRoute: Infinity,
      remainingDistance: 0
    };
  }

  const offRouteThresholdMeters = Number(options.offRouteThresholdMeters) || 35;
  const nearest = findNearestPointOnPolyline(polyline, riderPosition);

  if (!nearest?.nearestPoint || !Number.isInteger(nearest.segmentIndex)) {
    return {
      visiblePolyline: polyline,
      snappedPoint: null,
      isOffRoute: false,
      progress: 0,
      distanceAlongRoute: 0,
      distanceFromRoute: Infinity,
      remainingDistance: 0
    };
  }

  const trimmedPolyline = trimPolylineBehindRider(polyline, nearest.nearestPoint, nearest.segmentIndex);
  const isOffRoute = nearest.distance > offRouteThresholdMeters;
  const progress = nearest.totalDistance > 0
    ? Math.max(0, Math.min(1, nearest.distanceAlongRoute / nearest.totalDistance))
    : 0;

  const visiblePolyline = isOffRoute
    ? [riderPosition, ...trimmedPolyline]
    : trimmedPolyline;

  return {
    visiblePolyline,
    snappedPoint: nearest.nearestPoint,
    isOffRoute,
    progress,
    distanceAlongRoute: nearest.distanceAlongRoute,
    distanceFromRoute: nearest.distance,
    remainingDistance: nearest.remainingDistance
  };
}

/**
 * Calculate bearing/heading between two points
 * @param {number} lat1 - Starting latitude
 * @param {number} lng1 - Starting longitude
 * @param {number} lat2 - Ending latitude
 * @param {number} lng2 - Ending longitude
 * @returns {number} Bearing in degrees (0-360)
 */
export function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360; // Normalize to 0-360
  
  return bearing;
}

export function normalizeBearing(bearing, fallback = 0) {
  const numeric = Number(bearing);
  const fallbackNumeric = Number(fallback);
  const base = Number.isFinite(numeric)
    ? numeric
    : (Number.isFinite(fallbackNumeric) ? fallbackNumeric : 0);
  return ((base % 360) + 360) % 360;
}

export function interpolateBearing(startBearing, endBearing, progress) {
  const start = normalizeBearing(startBearing);
  const end = normalizeBearing(endBearing);
  let diff = end - start;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return normalizeBearing(start + diff * Math.max(0, Math.min(1, Number(progress) || 0)));
}

/**
 * Derive the rider marker heading from the forward route segment nearest to the rider.
 * Falls back to the supplied GPS heading when the route is too short.
 */
export function getRouteHeading(polyline, riderPosition, fallbackHeading = 0) {
  if (!Array.isArray(polyline) || polyline.length < 2 || !riderPosition) {
    return normalizeBearing(fallbackHeading);
  }

  const nearest = findNearestPointOnPolyline(polyline, riderPosition);
  const start = nearest?.nearestPoint || toFinitePoint(riderPosition);
  let end = polyline[Math.min((nearest?.segmentIndex || 0) + 1, polyline.length - 1)];

  if (start && end && calculateDistance(start.lat, start.lng, end.lat, end.lng) < 2) {
    end = polyline[Math.min((nearest?.segmentIndex || 0) + 2, polyline.length - 1)];
  }

  if (!start || !end) return normalizeBearing(fallbackHeading);
  return calculateBearing(start.lat, start.lng, end.lat, end.lng);
}

/**
 * Interpolate between two positions for smooth animation
 * @param {Object} start - {lat, lng} Starting position
 * @param {Object} end - {lat, lng} Ending position
 * @param {number} progress - Progress from 0 to 1
 * @returns {Object} {lat, lng} Interpolated position
 */
export function interpolatePosition(start, end, progress) {
  return {
    lat: start.lat + (end.lat - start.lat) * progress,
    lng: start.lng + (end.lng - start.lng) * progress
  };
}

/**
 * Extract and decode polyline from Google Directions API result
 * @param {Object} directionsResult - Google Maps DirectionsResult object
 * @returns {Array<{lat: number, lng: number}>} Decoded polyline points
 */
export function extractPolylineFromDirections(directionsResult) {
  if (!directionsResult || !directionsResult.routes || directionsResult.routes.length === 0) {
    return [];
  }

  const route = directionsResult.routes[0];
  const polylinePoints = [];

  // Method 1: Use overview_polyline if available (encoded string)
  if (route.overview_polyline && route.overview_polyline.points) {
    return decodePolyline(route.overview_polyline.points);
  }

  // Method 2: Extract from route legs and steps
  if (route.legs && route.legs.length > 0) {
    route.legs.forEach(leg => {
      if (leg.steps && leg.steps.length > 0) {
        leg.steps.forEach(step => {
          if (step.polyline && step.polyline.points) {
            const decoded = decodePolyline(step.polyline.points);
            polylinePoints.push(...decoded);
          }
        });
      }
    });
  }

  // Method 3: Use overview_path if available (already decoded)
  if (route.overview_path && route.overview_path.length > 0) {
    return route.overview_path.map(point => ({
      lat: point.lat(),
      lng: point.lng()
    }));
  }

  return polylinePoints;
}

/**
 * Smooth animation helper using requestAnimationFrame
 * @param {Object} startPos - {lat, lng} Starting position
 * @param {Object} endPos - {lat, lng} Ending position
 * @param {number} duration - Animation duration in milliseconds
 * @param {Function} onUpdate - Callback called with interpolated position
 * @returns {Function} Cancel function
 */
export function animateMarker(startPos, endPos, duration, onUpdate) {
  let startTime = null;
  let animationFrameId = null;

  const animate = (currentTime) => {
    if (!startTime) startTime = currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function for smooth animation (ease-out)
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    const interpolated = interpolatePosition(startPos, endPos, easedProgress);
    onUpdate(interpolated);

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    }
  };

  animationFrameId = requestAnimationFrame(animate);

  return () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}

/**
 * Animate bearing smoothly between two angles
 * @param {number} startBearing - Starting angle
 * @param {number} endBearing - Ending angle
 * @param {number} duration - Animation duration in milliseconds
 * @param {Function} onUpdate - Callback called with interpolated bearing
 * @returns {Function} Cancel function
 */
export function animateBearingSmoothly(startBearing, endBearing, duration, onUpdate) {
  // Normalize angles to avoid 0/360 flip issues
  let start = startBearing % 360;
  let end = endBearing % 360;
  
  // Find shortest path between angles
  let diff = end - start;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  
  let startTime = null;
  let animationFrameId = null;

  const animate = (currentTime) => {
    if (!startTime) startTime = currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function for smooth rotation
    const easedProgress = 1 - Math.pow(1 - progress, 2); // Quad Ease Out
    
    const currentBearing = (start + diff * easedProgress + 360) % 360;
    onUpdate(currentBearing);

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    }
  };

  animationFrameId = requestAnimationFrame(animate);

  return () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}

