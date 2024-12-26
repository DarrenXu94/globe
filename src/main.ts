import * as d3 from "d3";
import { Visited } from "./types";
import { calculateGeographicCentroid } from "./calculate";

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
  // .call(
  //   d3.zoom().on("zoom", () => {
  //     if (d3.event.transform.k > 0.3) {
  //       projection.scale(initialScale * d3.event.transform.k);
  //       path = d3.geoPath().projection(projection);
  //       svg.selectAll("path").attr("d", path);
  //       globe.attr("r", projection.scale());
  //     } else {
  //       d3.event.transform.k = 0.3;
  //     }
  //   })
  // );

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
    .style("opacity", 0.8);

  //Optional rotate
  // d3.timer(function (elapsed) {
  //   const rotate = projection.rotate();
  //   const k = sensitivity / projection.scale();
  //   projection.rotate([rotate[0] - 1 * k, rotate[1]]);
  //   path = d3.geoPath().projection(projection);
  //   svg.selectAll("path").attr("d", path);
  // }, 200);

  function calculateCenter(coordinates) {
    // Helper function to calculate the centroid of a single polygon
    function calculatePolygonCentroid(polygon) {
      let x = 0,
        y = 0,
        totalPoints = 0;
      polygon.forEach(([lon, lat]) => {
        x += lon;
        y += lat;
        totalPoints++;
      });
      return [x / totalPoints, y / totalPoints];
    }

    // Check if input is a multipolygon or a polygon
    if (Array.isArray(coordinates[0][0][0])) {
      // Input is a MultiPolygon
      let totalX = 0,
        totalY = 0,
        totalCount = 0;
      coordinates.forEach((polygon) => {
        const [centroidX, centroidY] = calculatePolygonCentroid(polygon[0]);
        totalX += centroidX;
        totalY += centroidY;
        totalCount++;
      });
      return [totalX / totalCount, totalY / totalCount];
    } else {
      // Input is a Polygon
      return calculatePolygonCentroid(coordinates[0]);
    }
  }

  visitedData.visited.forEach((country) => {
    d3.select(".country_" + country.country)
      .attr("fill", "red")
      .on("click", () => {
        console.log(country);

        const findCountry = data.features.find(
          (feature) => feature.properties.name === country.country
        );
        console.log(findCountry);

        console.log(
          calculateGeographicCentroid(findCountry.geometry.coordinates)
        );
      });
  });

  // List of target coordinates to rotate to (longitude, latitude)
  // const coordinates = [
  //   [-74.006, 40.7128], // New York City
  //   [2.3522, 48.8566], // Paris
  //   [139.6917, 35.6895], // Tokyo
  //   [151.2093, -33.8688], // Sydney
  // ];

  const coordinates = [
    [-19.265977400000004, 65.27802869999998], // Iceland
    [-100.2736408005889, 43.070868452395025], // USA
    [139.9463476611082, -32.842718431985276], // Australia
  ];

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

  // Function to rotate to a specific coordinate and dynamically adjust zoom
  function rotateTo(target) {
    if (isDragging) {
      return; // Do nothing if dragging is active
    }
    const currentRotation = projection.rotate(); // Get current rotation
    const currentCoords = [-currentRotation[0], -currentRotation[1]]; // Current longitude and latitude
    const targetRotation = [-target[0], -target[1]]; // Flip longitude and latitude for D3

    // Calculate distance between current and target coordinates
    const distance = calculateDistance(currentCoords, target);
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
      });
  }

  // Interval to rotate to each coordinate every X seconds
  // let index = 0;
  // const interval = 3000; // 3 seconds
  // setInterval(() => {
  //   rotateTo(coordinates[index]);
  //   index = (index + 1) % coordinates.length; // Cycle through coordinates
  // }, interval);

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
