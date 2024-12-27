import * as d3 from "d3";
import { Visited } from "./types";
import { calculateGeographicCentroid } from "./calculate";

import { generateCoordinates } from "./generateCoordinates";

(async () => {
  const res = await fetch("/world.json");
  const data = await res.json();

  const visited = await fetch("/visited.json");
  const visitedData = (await visited.json()) as Visited;

  let width = d3.select("#map").node().getBoundingClientRect().width;
  let height = window.document.documentElement.clientHeight - 5;
  const sensitivity = 75;

  const maxScale = 300; // Define a maximum scale

  let isDragging = false;

  const transitionDuration = 2000;

  const coordinates = generateCoordinates(data, visitedData);

  const geojson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Sphere",
        },
      },
    ],
  };

  let projection = d3
    .geoOrthographic()
    .fitSize([width - 20, height - 20], geojson)
    .center([0, 0])
    .rotate([0, -30])
    .translate([width / 2, height / 2]);

  // Enforce maximum scale
  if (projection.scale() > maxScale) {
    projection.scale(maxScale);
  }

  const initialScale = projection.scale();
  let path = d3.geoPath().projection(projection);

  let svg = d3
    .select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  let globe = svg
    .append("circle")
    .attr("fill", "#4682b4")
    .attr("stroke", "#000")
    .attr("stroke-width", "0.2")
    .attr("cx", width / 2)
    .attr("cy", height / 2)
    .attr("r", initialScale);

  function zoomed() {
    if (d3.event.transform.k > 0.3) {
      projection.scale(initialScale * d3.event.transform.k);
      path = d3.geoPath().projection(projection);
      svg.selectAll("path").attr("d", path);
      globe.attr("r", projection.scale());
    } else {
      d3.event.transform.k = 0.3;
    }
  }

  svg.call(
    d3
      .drag()
      .on("start", () => {
        isDragging = true; // Set dragging flag to true
        d3.selectAll("*").interrupt();
      })
      .on("drag", () => {
        isDragging = true;
        const rotate = projection.rotate();
        const k = sensitivity / projection.scale();
        projection.rotate([
          rotate[0] + d3.event.dx * k,
          rotate[1] - d3.event.dy * k,
        ]);
        path = d3.geoPath().projection(projection);
        svg.selectAll("path").attr("d", path);
      })
      .on("end", () => {
        isDragging = false;
      })
  );

  d3.select("#wrapper").call(d3.zoom().on("zoom", zoomed));

  let map = svg.append("g");

  map
    .append("g")
    .attr("class", "countries")
    .selectAll("path")
    .data(data.features)
    .enter()
    .append("path")
    .attr("class", (d: any) => "country_" + d.properties.name.replace(" ", "_"))
    .attr("d", path)
    .attr("fill", "white")
    .style("stroke", "black")
    .style("stroke-width", 0.3)
    .style("opacity", 0.5);

  //Optional rotate
  // d3.timer(function (elapsed) {
  //   const rotate = projection.rotate();
  //   const k = sensitivity / projection.scale();
  //   projection.rotate([rotate[0] - 1 * k, rotate[1]]);
  //   path = d3.geoPath().projection(projection);
  //   svg.selectAll("path").attr("d", path);
  // }, 200);

  // visitedData.visited.forEach((country) => {
  //   d3.select(".country_" + country.country).style("opacity", 1);

  // });

  // Function to calculate the great-circle distance (Haversine formula)
  function calculateDistance(coord1, coord2) {
    const toRadians = (deg) => (deg * Math.PI) / 180;
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const earthRadius = 6371; // Earth's radius in kilometers
    return earthRadius * c; // Distance in kilometers
  }

  function updateTitle(text) {
    const title = document.getElementById("country") as HTMLParagraphElement;
    title.textContent = text;
  }

  function changeFillColor(country) {
    // Clear previous visited class
    d3.selectAll(".visited").classed("visited", false);

    // Apply class
    d3.select(".country_" + country).classed("visited", true);
  }

  let isTransitioning = false; // Flag to track active transitions

  // Function to rotate to a specific coordinate and dynamically adjust zoom
  function rotateTo(target: {
    country: string;
    coordinates: [number, number];
  }) {
    if (isDragging || isTransitioning) {
      return; // Do nothing if dragging is active
    }

    updateTitle(target.country);

    changeFillColor(target.country);

    isTransitioning = true; // Mark transition as active

    const currentRotation = projection.rotate(); // Get current rotation
    const currentCoords = [-currentRotation[0], -currentRotation[1]]; // Current longitude and latitude
    // const targetRotation = [-target[0], -target[1]]; // Flip longitude and latitude for D3
    const targetRotation = [-target.coordinates[0], -target.coordinates[1]]; // Flip longitude and latitude for D3

    // Calculate distance between current and target coordinates
    const distance = calculateDistance(currentCoords, target.coordinates);
    const maxZoomOutScale = projection.scale() * 0.5; // Maximum zoom-out scale
    const minZoomOutScale = projection.scale() * 0.8; // Minimum zoom-out scale

    // Scale zoom-out proportionally based on distance (normalize between 0 and 1)
    const zoomOutScale =
      minZoomOutScale +
      Math.min(distance / 20000, 1) * (maxZoomOutScale - minZoomOutScale);

    d3.transition()
      .duration(transitionDuration) // Duration of the rotation and zoom
      .tween("rotateAndZoom", () => {
        const interpolateRotation = d3.interpolate(
          currentRotation,
          targetRotation
        );
        const interpolateScale = d3.interpolate(
          projection.scale(),
          zoomOutScale
        );
        return function (t) {
          projection.rotate(interpolateRotation(t));
          projection.scale(interpolateScale(t < 0.5 ? t * 2 : 2 - t * 2)); // Zoom out and in
          svg.selectAll("path").attr("d", path);
          globe.attr("r", projection.scale());
        };
      })
      .on("end", () => {
        isTransitioning = false; // Reset flag when transition ends
      })
      .on("interrupt", () => {
        isTransitioning = false; // Reset flag if transition is interrupted
      });
  }

  // Rotate to a specific coordinate

  const prevButton = document.getElementById("prev") as HTMLButtonElement;
  const nextButton = document.getElementById("next") as HTMLButtonElement;

  const handlePrevClick = () => {
    index = index === 0 ? coordinates.length - 1 : index - 1;
    rotateTo(coordinates[index]);
  };

  const handleNextClick = () => {
    index = (index + 1) % coordinates.length;
    rotateTo(coordinates[index]);
  };

  let index = 0;
  // Add debounced event listeners
  prevButton.addEventListener("click", handlePrevClick);
  nextButton.addEventListener("click", handleNextClick);

  rotateTo(coordinates[index]);
})();
