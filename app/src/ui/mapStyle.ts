// 地圖底圖：像印在紙上的舊鐵道路線圖——海和頁面同一張紙色，只有本島是淡淡的土色，
// 道路淡化、店家與國名隱藏，只留鐵道線與地名，讓車站的顏色最清楚。
// Google 地圖樣式格式：https://developers.google.com/maps/documentation/javascript/style-reference

import type { MapStyleElement } from "react-native-maps";

import { colors } from "./theme.ts";

export const railwayMapStyle: MapStyleElement[] = [
  { elementType: "geometry", stylers: [{ color: "#e6d8ba" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7a6c56" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#efe5cf" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },

  // 海＝頁面的紙
  { featureType: "water", elementType: "geometry", stylers: [{ color: colors.paper }] },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },

  { featureType: "landscape.natural.terrain", elementType: "geometry", stylers: [{ color: "#dfcfad" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },

  // 道路退到背景
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ecdfc4" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.local", stylers: [{ visibility: "off" }] },

  // 鐵道線保留，像路線圖上的墨線
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#8a7b62" }, { weight: 1.2 }] },
  { featureType: "transit.station", stylers: [{ visibility: "off" }] },

  // 國名、海岸以外的行政界線都不需要
  { featureType: "administrative.country", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.province", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
];
