import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { computeReach, earlierInbound, earliestArrival, explainInfeasible, latestDeparture, parseTime } from "./csa.ts";
import type { Connection, Options, Timetable, Trip } from "./types.ts";

const t = parseTime;

// 用「車次 + 停靠站與時刻」建立小型時刻表
function makeTimetable(trains: { no: string; reserved?: boolean; stops: [string, string][] }[]): Timetable {
  const trips: Trip[] = [];
  const connections: Connection[] = [];
  trains.forEach((train, i) => {
    trips.push({ no: train.no, type: train.reserved ? "自強" : "區間", reserved: train.reserved ?? false });
    for (let k = 0; k + 1 < train.stops.length; k++) {
      const [from, dep] = train.stops[k];
      const [to, arr] = train.stops[k + 1];
      connections.push([i, from, to, t(dep), t(arr)]);
    }
  });
  connections.sort((a, b) => a[3] - b[3] || a[4] - b[4]);
  return { trips, connections };
}

describe("小型時刻表", () => {
  // A ─ B ─ C 一條線，D 接在 B
  const tt = makeTimetable([
    { no: "101", stops: [["A", "08:00"], ["B", "08:30"], ["C", "09:00"]] },
    { no: "103", stops: [["A", "10:00"], ["B", "10:30"], ["C", "11:00"]] },
    { no: "201", stops: [["B", "08:33"], ["D", "09:00"]] }, // 只有 3 分鐘可轉，趕不上
    { no: "203", stops: [["B", "08:40"], ["D", "09:10"]] },
    { no: "102", stops: [["C", "16:00"], ["B", "16:30"], ["A", "17:00"]] },
    { no: "104", stops: [["C", "17:00"], ["B", "17:30"], ["A", "18:00"]] },
    { no: "202", stops: [["D", "16:50"], ["B", "17:20"]] },
    { no: "1", reserved: true, stops: [["A", "09:00"], ["C", "09:20"]] },
  ]);
  const opts: Options = { origin: "A", startTime: t("07:00"), endTime: t("18:00") };

  test("最早抵達：直達與轉乘", () => {
    const rides = earliestArrival(tt, opts);
    assert.equal(rides.get("B")!.alight[4], t("08:30"));
    assert.equal(rides.get("C")!.alight[4], t("09:00"));
    // 201 只留 3 分鐘轉乘，不夠 5 分鐘，要搭 203
    assert.equal(rides.get("D")!.alight[4], t("09:10"));
  });

  test("最晚回程", () => {
    const best = latestDeparture(tt, opts);
    assert.equal(best.get("C")!.dep, t("17:00"));
    // D 16:50 → B 17:20，轉 104（B 17:30）剛好 10 分鐘
    assert.equal(best.get("D")!.dep, t("16:50"));
  });

  test("可停留時間與轉乘次數", () => {
    const reach = new Map(computeReach(tt, opts).map((r) => [r.stationId, r]));
    const d = reach.get("D")!;
    assert.equal(d.stayMinutes, t("16:50") - t("09:10"));
    assert.deepEqual(d.outbound.legs.map((l) => l.trainNo), ["101", "203"]);
    assert.deepEqual(d.inbound.legs.map((l) => l.trainNo), ["202", "104"]);
  });

  test("前一班要比最晚回程更早到家", () => {
    const reach = new Map(computeReach(tt, opts).map((r) => [r.stationId, r]));
    // C：最晚 104（18:00 到家），前一班 102（17:00 到家）
    assert.deepEqual(earlierInbound(tt, opts, reach.get("C")!)?.legs.map((l) => l.trainNo), ["102"]);
    // D：只有 202 一班可接回 A，沒有更早到家的走法
    assert.equal(earlierInbound(tt, opts, reach.get("D")!), undefined);
  });

  test("接上同一班車回家的不算前一班", () => {
    // 回程只有 9 次能回 A；8 次雖然更早從 B 出發，但也是到 C 接 9 次，到家時間一樣
    const join = makeTimetable([
      { no: "1", stops: [["A", "09:00"], ["B", "09:30"]] },
      { no: "8", stops: [["B", "16:00"], ["C", "16:20"]] },
      { no: "7", stops: [["B", "16:30"], ["C", "16:50"]] },
      { no: "9", stops: [["C", "17:00"], ["A", "17:40"]] },
    ]);
    const b = computeReach(join, opts).find((r) => r.stationId === "B")!;
    assert.equal(b.inbound.dep, t("16:30"));
    assert.equal(earlierInbound(join, opts, b), undefined);
  });

  test("對號車與只搭區間車", () => {
    const all = new Map(computeReach(tt, opts).map((r) => [r.stationId, r]));
    // 1 次自強 09:00 出發 09:20 到 C，比 101 的 09:00 晚，最早抵達仍是 101
    assert.equal(all.get("C")!.outbound.legs[0].trainNo, "101");
    const late = { ...opts, startTime: t("08:10") };
    assert.equal(computeReach(tt, late).find((r) => r.stationId === "C")!.outbound.legs[0].trainNo, "1");
    const local = computeReach(tt, { ...late, unreservedOnly: true }).find((r) => r.stationId === "C")!;
    assert.equal(local.outbound.legs[0].trainNo, "103");
  });

  test("車次經過出發站時，在出發站上下車，不繞路", () => {
    // 301 經過 A 開到 Z，302 再從 Z 開回 A：時間上「坐過頭再搭回來」也趕得上，但不該這樣建議
    const loop = makeTimetable([
      { no: "300", stops: [["Z", "08:50"], ["A", "09:00"], ["E", "09:30"]] },
      { no: "299", stops: [["A", "08:40"], ["Z", "08:45"]] },
      { no: "301", stops: [["E", "17:00"], ["A", "17:30"], ["Z", "17:40"]] },
      { no: "302", stops: [["Z", "17:50"], ["A", "17:58"]] },
    ]);
    const r = computeReach(loop, opts).find((x) => x.stationId === "E")!;
    assert.deepEqual(r.outbound.legs.map((l) => `${l.trainNo}:${l.from}`), ["300:A"]);
    assert.deepEqual(r.inbound.legs.map((l) => `${l.trainNo}:${l.to}`), ["301:A"]);
  });

  test("停留不到最短轉乘時間，不算可以來回", () => {
    const quick = makeTimetable([
      { no: "1", stops: [["A", "09:00"], ["B", "09:30"]] },
      { no: "2", stops: [["B", "09:33"], ["A", "10:00"]] },
    ]);
    assert.equal(computeReach(quick, opts).length, 0);
  });

  test("無法來回時說明差在哪", () => {
    // 10:30 才出門：往 C 的 101、1、103 都已開走，當天沒車可到；要來回得在 10:00 前出門搭 103
    const late = explainInfeasible(tt, { ...opts, startTime: t("10:30") }, "C");
    assert.equal(late.noOutbound, true);
    assert.equal(late.leaveBy, t("10:00"));

    // 16:30 前要到家：最早的回程 102 也要 17:00 才到家，再早出門也沒用
    const early = explainInfeasible(tt, { ...opts, endTime: t("16:30") }, "C");
    assert.equal(early.noOutbound, false);
    assert.equal(early.earliestHome, t("17:00"));
    assert.equal(early.leaveBy, undefined);
  });

  test("時間不夠就無法來回", () => {
    const reach = computeReach(tt, { ...opts, endTime: t("16:00") });
    assert.equal(reach.length, 0);
  });
});

// ── 真實時刻表：和暴力法比對 ──────────────────────────────────

// 暴力法：反覆對每個車次從頭掃到尾，直到沒有任何站的時間再改善為止。
// 和 CSA 的掃描順序完全不同，用來交叉驗證。
function bruteEarliest(tt: Timetable, opts: Options): Map<string, number> {
  const minTransfer = opts.minTransfer ?? 5;
  const byTrip = groupByTrip(tt, opts);
  const arrival = new Map<string, number>([[opts.origin, opts.startTime]]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const conns of byTrip) {
      let onBoard = false;
      for (const [, from, to, dep, arr] of conns) {
        if (dep < opts.startTime || dep > opts.endTime) continue;
        const at = arrival.get(from);
        if (at !== undefined && (from === opts.origin ? at : at + minTransfer) <= dep) onBoard = true;
        if (onBoard && arr < (arrival.get(to) ?? Infinity)) {
          arrival.set(to, arr);
          changed = true;
        }
      }
    }
  }
  return arrival;
}

function bruteLatest(tt: Timetable, opts: Options): Map<string, number> {
  const minTransfer = opts.minTransfer ?? 5;
  const byTrip = groupByTrip(tt, opts);
  const departure = new Map<string, number>();
  for (let changed = true; changed; ) {
    changed = false;
    for (const conns of byTrip) {
      let canReach = false;
      for (let i = conns.length - 1; i >= 0; i--) {
        const [, from, to, dep, arr] = conns[i];
        if (arr > opts.endTime || arr < opts.startTime) continue;
        const deadline = to === opts.origin ? opts.endTime : (departure.get(to) ?? -Infinity) - minTransfer;
        if (arr <= deadline) canReach = true;
        if (canReach && from !== opts.origin && dep > (departure.get(from) ?? -Infinity)) {
          departure.set(from, dep);
          changed = true;
        }
      }
    }
  }
  return departure;
}

function groupByTrip(tt: Timetable, opts: Options): Connection[][] {
  const byTrip: Connection[][] = tt.trips.map(() => []);
  for (const c of tt.connections) {
    if (opts.unreservedOnly && tt.trips[c[0]].reserved) continue;
    byTrip[c[0]].push(c);
  }
  for (const conns of byTrip) conns.sort((a, b) => a[3] - b[3]);
  return byTrip;
}

const dataDir = new URL("../../../docs/data/", import.meta.url);

function loadRealTimetable(): { date: string; tt: Timetable } | undefined {
  try {
    const index = JSON.parse(readFileSync(new URL("index.json", dataDir), "utf-8"));
    const [date, file] = Object.entries(index.dates as Record<string, string>)[0];
    return { date, tt: JSON.parse(readFileSync(new URL(file, dataDir), "utf-8")) };
  } catch {
    return undefined;
  }
}

const real = loadRealTimetable();

describe("真實時刻表", { skip: real ? false : "沒有 docs/data，先執行 pipeline/build.py" }, () => {
  const { tt } = real!;
  const stations = [...new Set(tt.connections.map((c) => c[1]))].sort();
  // 固定挑選：每隔幾站取一個出發站，涵蓋西部、東部與支線
  const origins = stations.filter((_, i) => i % 8 === 0);

  for (const unreservedOnly of [false, true]) {
    test(`CSA 與暴力法結果一致（${origins.length} 個出發站，${unreservedOnly ? "只搭區間車" : "全部車種"}）`, () => {
      for (const origin of origins) {
        const opts: Options = { origin, startTime: t("09:00"), endTime: t("18:00"), unreservedOnly };

        const expectedArr = bruteEarliest(tt, opts);
        const rides = earliestArrival(tt, opts);
        for (const [s, time] of expectedArr) {
          if (s === origin) continue;
          assert.equal(rides.get(s)?.alight[4], time, `${origin} → ${s} 最早抵達`);
        }
        assert.equal(rides.size, expectedArr.size - 1, `${origin} 可抵達站數`);

        const expectedDep = bruteLatest(tt, opts);
        const best = latestDeparture(tt, opts);
        for (const [s, time] of expectedDep) {
          assert.equal(best.get(s)?.dep, time, `${s} → ${origin} 最晚出發`);
        }
        assert.equal(best.size, expectedDep.size, `${origin} 可回程站數`);
      }
    });
  }

  test("路線本身合理：每段接得上、轉乘時間足夠、時間在範圍內", () => {
    for (const origin of origins) {
      const opts: Options = { origin, startTime: t("09:00"), endTime: t("18:00") };
      for (const r of computeReach(tt, opts)) {
        const earlier = earlierInbound(tt, opts, r);
        for (const j of [r.outbound, r.inbound, ...(earlier ? [earlier] : [])]) {
          assert.ok(j.dep >= opts.startTime && j.arr <= opts.endTime);
          for (let i = 0; i + 1 < j.legs.length; i++) {
            assert.equal(j.legs[i].to, j.legs[i + 1].from);
            assert.ok(j.legs[i + 1].dep - j.legs[i].arr >= 5, "轉乘時間至少 5 分鐘");
          }
        }
        assert.equal(r.outbound.legs[0].from, origin);
        assert.equal(r.outbound.legs.at(-1)!.to, r.stationId);
        assert.equal(r.inbound.legs[0].from, r.stationId);
        assert.equal(r.inbound.legs.at(-1)!.to, origin);
        if (earlier) {
          assert.ok(earlier.arr < r.inbound.arr, "前一班更早到家");
          assert.ok(earlier.dep - r.outbound.arr >= 5, "前一班來得及搭");
          assert.equal(earlier.legs[0].from, r.stationId);
          assert.equal(earlier.legs.at(-1)!.to, origin);
        }
      }
    }
  });
});
