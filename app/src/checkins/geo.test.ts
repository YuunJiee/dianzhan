import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { Station } from "../csa/types.ts";
import { CHECK_IN_RADIUS_M, distanceMeters, formatDistance, nearestStation } from "./geo.ts";

const stations: Station[] = JSON.parse(
  readFileSync(new URL("../../../docs/data/stations.json", import.meta.url), "utf-8"),
);
const byName = (name: string) => stations.find((s) => s.name === name)!;

test("距離：臺北到板橋約 7 公里", () => {
  const a = byName("臺北");
  const b = byName("板橋");
  const d = distanceMeters(a.lat, a.lng, b.lat, b.lng);
  assert.ok(d > 6000 && d < 8000, `實際 ${d}`);
});

test("在車站旁邊可以打卡", () => {
  const s = byName("山佳");
  // 往北約 100 公尺（緯度 0.0009 度 ≈ 100 公尺）
  const near = nearestStation(stations, s.lat + 0.0009, s.lng)!;
  assert.equal(near.station.name, "山佳");
  assert.ok(near.meters > 90 && near.meters < 110);
  assert.equal(near.withinRadius, true);
});

test("離車站太遠不能打卡，但仍告訴你最近的站", () => {
  const s = byName("福隆");
  const far = nearestStation(stations, s.lat + 0.01, s.lng)!; // 約 1.1 公里
  assert.ok(far.meters > CHECK_IN_RADIUS_M);
  assert.equal(far.withinRadius, false);
});

test("距離顯示", () => {
  assert.equal(formatDistance(230.4), "230 公尺");
  assert.equal(formatDistance(1420), "1.4 公里");
});
