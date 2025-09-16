/**
 * Calculate the distance between two points on Earth using the Haversine formula
 * @param coord1 First coordinate [longitude, latitude]
 * @param coord2 Second coordinate [longitude, latitude]
 * @returns Distance in miles
 */
export function calculateDistance(coord1: [number, number], coord2: [number, number]): number {
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  
  const R = 3958.8; // Earth radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convert degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a point is within a specified distance of any point on a line
 * @param point Coordinate [longitude, latitude]
 * @param line Array of coordinates representing a line
 * @param maxDistance Maximum distance in miles
 * @returns Boolean indicating if point is within maxDistance of the line
 */
export function isPointNearLine(point: [number, number], line: [number, number][], maxDistance: number): boolean {
  // Check distance to each segment of the line
  for (let i = 0; i < line.length - 1; i++) {
    const segmentStart = line[i];
    const segmentEnd = line[i + 1];
    
    const distance = distanceToLineSegment(point, segmentStart, segmentEnd);
    if (distance <= maxDistance) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate the shortest distance from a point to a line segment
 * @param point The point [longitude, latitude]
 * @param lineStart Start of line segment [longitude, latitude]
 * @param lineEnd End of line segment [longitude, latitude]
 * @returns Distance in miles
 */
function distanceToLineSegment(point: [number, number], lineStart: [number, number], lineEnd: [number, number]): number {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  if (len_sq !== 0) //in case of 0 length line
      param = dot / len_sq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  return calculateDistance(point, [xx, yy]);
}