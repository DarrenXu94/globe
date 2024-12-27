import { calculateGeographicCentroid } from "./calculate";
import { Visited } from "./types";

export function generateCoordinates(data, allVisited: Visited) {
  const coords = [] as { country: string; coordinates: [number, number] }[];

  allVisited.visited.forEach((visited) => {
    const findCountry = data.features.find(
      (feature) => feature.properties.name === visited.country
    );

    coords.push({
      country: visited.country,
      coordinates: calculateGeographicCentroid(
        findCountry.geometry.coordinates
      ),
    });
  });

  return coords;
}
