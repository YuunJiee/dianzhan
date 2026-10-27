// 地圖底圖：像舊的鐵道路線圖——泛黃紙色、淡化道路、隱藏店家，只留鐵道線與地名，讓車站的顏色最清楚。
// Google 地圖樣式格式：https://developers.google.com/maps/documentation/javascript/style-reference

import type { MapStyleElement } from "react-native-maps";

export const railwayMapStyle: MapStyleElement[] = [
  { elementType: "geometry", stylers: [{ color: "#ece2cc" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6f6250" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f4ecdb" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },

  { featureType: "water", elementType: "geometry", stylers: [{ color: "#b7cbcb" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#7d9394" }] },

  { featureType: "landscape.natural.terrain", elementType: "geometry", stylers: [{ color: "#e2d6bb" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#dcd5b6" }] },

  // 道路退到背景
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#f3ead6" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e6d3ad" }] },
  { featureType: "road.local", stylers: [{ visibility: "off" }] },

  // 鐵道線保留，像路線圖上的墨線
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#7a6d58" }, { weight: 1.2 }] },
  { featureType: "transit.station", stylers: [{ visibility: "off" }] },

  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#c9b895" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
];
