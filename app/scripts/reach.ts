// 在終端機印出「從某站出發，各站可停留多久」，用來抽查 CSA 結果。
//
// 用法：
//   npm run reach -- 臺北
//   npm run reach -- 臺北 --date 2026-11-01 --start 09:00 --end 18:00
//   npm run reach -- 臺北 --to 山佳          只看一站，列出完整車次
//   npm run reach -- 臺北 --local           只搭區間車

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { computeReach, earlierInbound, formatTime, parseTime } from "../src/csa/csa.ts";
import type { Journey, Station, Timetable } from "../src/csa/types.ts";

const dataDir = new URL("../../docs/data/", import.meta.url);
const readJson = (file: string) => JSON.parse(readFileSync(new URL(file, dataDir), "utf-8"));

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    date: { type: "string" },
    start: { type: "string", default: "09:00" },
    end: { type: "string", default: "18:00" },
    to: { type: "string" },
    local: { type: "boolean", default: false },
  },
});

const stations: Station[] = readJson("stations.json");
const index: { dates: Record<string, string> } = readJson("index.json");

const byName = (name: string): Station => {
  const normalized = name.replace(/台/g, "臺");
  const found = stations.find((s) => s.name === normalized || s.id === name);
  if (!found) {
    console.error(`找不到車站「${name}」`);
    process.exit(1);
  }
  return found;
};
const nameOf = (id: string) => stations.find((s) => s.id === id)?.name ?? id;

if (positionals.length === 0) {
  console.error("請指定出發站，例如：npm run reach -- 臺北");
  process.exit(1);
}
const origin = byName(positionals[0]);
const date = values.date ?? Object.keys(index.dates)[0];
const file = index.dates[date];
if (!file) {
  console.error(`沒有 ${date} 的時刻表，可選日期：${Object.keys(index.dates).join("、")}`);
  process.exit(1);
}
const tt: Timetable = readJson(file);

const startedAt = performance.now();
const opts = {
  origin: origin.id,
  startTime: parseTime(values.start!),
  endTime: parseTime(values.end!),
  unreservedOnly: values.local,
};
const reach = computeReach(tt, opts);
const elapsed = performance.now() - startedAt;

const duration = (minutes: number) => `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
const describe = (j: Journey) =>
  j.legs
    .map((l) => `${l.trainNo} ${l.trainType}${l.reserved ? "（對號）" : ""}  ${nameOf(l.from)} ${formatTime(l.dep)} → ${nameOf(l.to)} ${formatTime(l.arr)}`)
    .join("\n      ");

console.log(
  `${date}　${origin.name} 出發　${values.start} 後出門、${values.end} 前到家${values.local ? "　只搭區間車" : ""}`,
);

if (values.to) {
  const target = byName(values.to);
  const r = reach.find((x) => x.stationId === target.id);
  if (!r) {
    console.log(`\n${target.name}：無法當天來回`);
    process.exit(0);
  }
  console.log(`\n${target.name}：可停留 ${duration(r.stayMinutes)}`);
  console.log(`\n  去程（最早 ${formatTime(r.outbound.arr)} 抵達，轉乘 ${r.outbound.legs.length - 1} 次）\n      ${describe(r.outbound)}`);
  console.log(`\n  回程（最晚 ${formatTime(r.inbound.dep)} 出發、${formatTime(r.inbound.arr)} 到家，轉乘 ${r.inbound.legs.length - 1} 次）\n      ${describe(r.inbound)}`);
  const earlier = earlierInbound(tt, opts, r);
  if (earlier) {
    console.log(`\n  建議搭前一班（${formatTime(earlier.dep)} 出發、${formatTime(earlier.arr)} 到家）\n      ${describe(earlier)}`);
  } else {
    console.log("\n  沒有更早回到家的班次，最晚回程就是唯一選擇");
  }
  process.exit(0);
}

console.log(`\n可當天來回 ${reach.length} 站（計算 ${elapsed.toFixed(0)} ms）\n`);
console.log("可停留   車站          抵達   單程    回程出發  轉乘(去/回)");
for (const r of reach) {
  const oneWay = r.outbound.arr - r.outbound.dep;
  console.log(
    [
      duration(r.stayMinutes).padEnd(8),
      nameOf(r.stationId).padEnd(6, "　"),
      formatTime(r.outbound.arr).padEnd(6),
      duration(oneWay).padEnd(7),
      formatTime(r.inbound.dep).padEnd(9),
      `${r.outbound.legs.length - 1}/${r.inbound.legs.length - 1}`,
    ].join(" "),
  );
}
