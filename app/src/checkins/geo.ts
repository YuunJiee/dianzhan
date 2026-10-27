// 打卡範圍判斷：找出離目前位置最近的車站，看是否在半徑內（規格書 F2）

import type { Station } from "../csa/types.ts";

export const CHECK_IN_RADIUS_M = 300;

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** 兩點的球面距離（公尺，haversine）。 */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export type Nearest = { station: Station; meters: number; withinRadius: boolean };

export function nearestStation(stations: Station[], lat: number, lng: number): Nearest | undefined {
  let best: Nearest | undefined;
  for (const station of stations) {
    const meters = distanceMeters(lat, lng, station.lat, station.lng);
    if (!best || meters < best.meters) best = { station, meters, withinRadius: meters <= CHECK_IN_RADIUS_M };
  }
  return best;
}

/** 「230 公尺」「1.4 公里」 */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} 公尺` : `${(meters / 1000).toFixed(1)} 公里`;
}
