/**
 * Centroid calculation weighted by the area of sub-regions. For polygons defined by latitude and longitude, this often involves approximating areas and ensuring that smaller regions (like islands) do not overly influence the result.
 * @param coordinates
 * @returns
 */
export function calculateGeographicCentroid(coordinates): [number, number] {
  const EARTH_RADIUS = 6371; // Radius of the Earth in kilometers

  // Helper function to calculate the signed area of a polygon
  function calculatePolygonArea(polygon) {
    let area = 0;
    for (let i = 0; i < polygon.length - 1; i++) {
      const [lon1, lat1] = polygon[i];
      const [lon2, lat2] = polygon[i + 1];
      area +=
        (lon2 - lon1) * (Math.sin(toRadians(lat1)) + Math.sin(toRadians(lat2)));
    }
    return Math.abs((area * EARTH_RADIUS * EARTH_RADIUS) / 2);
  }

  // Helper function to calculate the centroid of a single polygon
  function calculatePolygonCentroid(polygon): [number, number] {
    let cx = 0,
      cy = 0,
      cz = 0;
    polygon.forEach(([lon, lat]) => {
      const latRad = toRadians(lat);
      const lonRad = toRadians(lon);
      cx += Math.cos(latRad) * Math.cos(lonRad);
      cy += Math.cos(latRad) * Math.sin(lonRad);
      cz += Math.sin(latRad);
    });
    const totalPoints = polygon.length;
    cx /= totalPoints;
    cy /= totalPoints;
    cz /= totalPoints;

    const lon = toDegrees(Math.atan2(cy, cx));
    const hyp = Math.sqrt(cx * cx + cy * cy);
    const lat = toDegrees(Math.atan2(cz, hyp));
    return [lon, lat];
  }

  // Converts degrees to radians
  function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  // Converts radians to degrees
  function toDegrees(radians) {
    return (radians * 180) / Math.PI;
  }

  // Check if input is a multipolygon or a polygon
  if (Array.isArray(coordinates[0][0][0])) {
    // Input is a MultiPolygon
    let totalArea = 0;
    let weightedCentroid = [0, 0];

    coordinates.forEach((polygon) => {
      const area = calculatePolygonArea(polygon[0]);
      const [cx, cy] = calculatePolygonCentroid(polygon[0]);
      totalArea += area;
      weightedCentroid[0] += cx * area;
      weightedCentroid[1] += cy * area;
    });

    return [weightedCentroid[0] / totalArea, weightedCentroid[1] / totalArea];
  } else {
    // Input is a Polygon
    return calculatePolygonCentroid(coordinates[0]);
  }
}
