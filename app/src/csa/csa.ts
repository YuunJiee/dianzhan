// Connection Scan Algorithm：算出從出發站當天來回，每一站的最早抵達、最晚回程與可停留時間。
// 參考：Dibbelt et al., "Connection Scan Algorithm" (2018)

import type { Connection, Journey, Leg, Options, Reach, Timetable } from "./types.ts";

export const DEFAULT_MIN_TRANSFER = 5;

// 一段乘車：在 board 上車、在 alight 下車（同一車次）
type Ride = { board: Connection; alight: Connection };

function usable(tt: Timetable, c: Connection, unreservedOnly: boolean): boolean {
  return !unreservedOnly || !tt.trips[c[0]].reserved;
}

function toLeg(tt: Timetable, ride: Ride): Leg {
  const trip = tt.trips[ride.board[0]];
  return {
    trainNo: trip.no,
    trainType: trip.type,
    reserved: trip.reserved,
    from: ride.board[1],
    to: ride.alight[2],
    dep: ride.board[3],
    arr: ride.alight[4],
  };
}

function toJourney(legs: Leg[]): Journey {
  return { dep: legs[0].dep, arr: legs[legs.length - 1].arr, legs };
}

/**
 * 去程：從 origin 在 startTime 之後出發，到每一站的最早抵達。
 * 回傳每站抵達時所搭的那一段車，用來回推完整路線。
 */
export function earliestArrival(tt: Timetable, opts: Options): Map<string, Ride> {
  const minTransfer = opts.minTransfer ?? DEFAULT_MIN_TRANSFER;
  const unreservedOnly = opts.unreservedOnly ?? false;
  const arrival = new Map<string, number>([[opts.origin, opts.startTime]]);
  const boarded = new Map<number, Connection>(); // 車次 → 上車的連結
  const lastRide = new Map<string, Ride>();

  for (const c of tt.connections) {
    const [trip, from, to, dep, arr] = c;
    if (dep < opts.startTime) continue;
    if (dep > opts.endTime) break;
    if (!usable(tt, c, unreservedOnly)) continue;

    let board = boarded.get(trip);
    // 車次經過出發站時，一律從出發站上車（避免先搭到別站再上同一班車的繞路走法）
    if (!board || from === opts.origin) {
      const at = arrival.get(from);
      // 出發站不需轉乘時間；其他站下車後要預留轉乘時間才能換車
      const ready = at === undefined ? Infinity : from === opts.origin ? at : at + minTransfer;
      if (ready <= dep) {
        board = c;
        boarded.set(trip, c);
      }
    }
    if (!board) continue;
    if (arr < (arrival.get(to) ?? Infinity)) {
      arrival.set(to, arr);
      lastRide.set(to, { board, alight: c });
    }
  }
  return lastRide;
}

type Departure = { dep: number; ride: Ride };

// 依抵達時間由晚到早排序的連結；同一份時刻表只排一次
const byArrivalCache = new WeakMap<Timetable, Connection[]>();
function connectionsByArrival(tt: Timetable): Connection[] {
  let sorted = byArrivalCache.get(tt);
  if (!sorted) {
    sorted = [...tt.connections].sort((a, b) => b[4] - a[4] || b[3] - a[3]);
    byArrivalCache.set(tt, sorted);
  }
  return sorted;
}

/** 回程：每一站最晚幾點出發，仍能在 endTime 前回到 origin。 */
export function latestDeparture(tt: Timetable, opts: Options): Map<string, Departure> {
  const minTransfer = opts.minTransfer ?? DEFAULT_MIN_TRANSFER;
  const unreservedOnly = opts.unreservedOnly ?? false;
  const best = new Map<string, Departure>();
  const alighted = new Map<number, Connection>(); // 車次 → 下車的連結

  const byArrival = connectionsByArrival(tt);

  for (const c of byArrival) {
    const [trip, from, to, dep, arr] = c;
    if (arr > opts.endTime) continue;
    if (arr < opts.startTime) break;
    if (!usable(tt, c, unreservedOnly)) continue;

    let alight = alighted.get(trip);
    // 車次經過出發站時，一律在出發站下車（避免坐過頭再搭回來的繞路走法）
    if (!alight || to === opts.origin) {
      // 回到出發站不需轉乘時間；在其他站下車要預留轉乘時間接下一班
      const deadline = to === opts.origin ? opts.endTime : (best.get(to)?.dep ?? -Infinity) - minTransfer;
      if (arr <= deadline) {
        alight = c;
        alighted.set(trip, c);
      }
    }
    if (!alight) continue;
    if (from === opts.origin) continue;

    if (dep > (best.get(from)?.dep ?? -Infinity)) {
      best.set(from, { dep, ride: { board: c, alight } });
    }
  }
  return best;
}

function outboundJourney(tt: Timetable, rides: Map<string, Ride>, origin: string, target: string): Journey {
  const legs: Leg[] = [];
  let at = target;
  while (at !== origin) {
    const ride = rides.get(at)!;
    legs.unshift(toLeg(tt, ride));
    at = ride.board[1];
  }
  return toJourney(legs);
}

function inboundJourney(tt: Timetable, best: Map<string, Departure>, first: Departure, origin: string): Journey {
  const legs: Leg[] = [toLeg(tt, first.ride)];
  let at = first.ride.alight[2];
  while (at !== origin) {
    const next = best.get(at)!;
    legs.push(toLeg(tt, next.ride));
    at = next.ride.alight[2];
  }
  return toJourney(legs);
}

/** 從 origin 出發，列出所有當天可以來回的車站（可停留時間至少為最短轉乘時間）。 */
export function computeReach(tt: Timetable, opts: Options): Reach[] {
  const minTransfer = opts.minTransfer ?? DEFAULT_MIN_TRANSFER;
  const rides = earliestArrival(tt, opts);
  const best = latestDeparture(tt, opts);
  const result: Reach[] = [];

  for (const [stationId, ride] of rides) {
    if (stationId === opts.origin) continue;
    const back = best.get(stationId);
    if (!back) continue;
    // 至少要留最短轉乘時間，才來得及換月台搭回程
    const stay = back.dep - ride.alight[4];
    if (stay < minTransfer) continue;

    result.push({
      stationId,
      outbound: outboundJourney(tt, rides, opts.origin, stationId),
      inbound: inboundJourney(tt, best, back, opts.origin),
      stayMinutes: stay,
    });
  }
  return result.sort((a, b) => b.stayMinutes - a.stayMinutes);
}

/**
 * 建議搭的前一班：比最晚回程「更早回到家」的最晚走法。
 * 錯過這班時，最晚回程仍可當備案；只在看單一車站時計算。
 */
export function earlierInbound(tt: Timetable, opts: Options, reach: Reach): Journey | undefined {
  const minTransfer = opts.minTransfer ?? DEFAULT_MIN_TRANSFER;
  const best = latestDeparture(tt, { ...opts, endTime: reach.inbound.arr - 1 });
  const back = best.get(reach.stationId);
  if (!back || back.dep - reach.outbound.arr < minTransfer) return undefined;
  return inboundJourney(tt, best, back, opts.origin);
}

// 「整天」的時間範圍，用來找出時間範圍外的替代方案（跨午夜的車次可到 30:00）
const DAY_START = 0;
const DAY_END = 30 * 60;

export type Infeasibility = {
  noOutbound: boolean; // 出發後當天沒有車能到
  leaveBy?: number; // 要在這個時間前出發，才能停留 minStay 以上
  earliestHome?: number; // 就算一到就回頭，最早幾點到家
};

/**
 * 指定目的地無法當天來回（或停留不到 minStay）時，說明差在哪裡，
 * 讓使用者決定提早出門或改成兩天一夜。
 */
export function explainInfeasible(tt: Timetable, opts: Options, stationId: string, minStay = 0): Infeasibility {
  const minTransfer = opts.minTransfer ?? DEFAULT_MIN_TRANSFER;
  const unreservedOnly = opts.unreservedOnly ?? false;
  const result: Infeasibility = { noOutbound: false };

  const arrive = earliestArrival(tt, { ...opts, endTime: DAY_END }).get(stationId);
  if (!arrive) {
    result.noOutbound = true;
  } else {
    const home = earliestArrival(tt, {
      origin: stationId,
      startTime: arrive.alight[4] + minTransfer,
      endTime: DAY_END,
      unreservedOnly,
    }).get(opts.origin);
    if (home) result.earliestHome = home.alight[4];
  }

  // 最晚的回程車，往回推最晚幾點要從出發站出發，才能停留 minStay 以上
  const lastBack = latestDeparture(tt, { ...opts, startTime: DAY_START }).get(stationId);
  if (lastBack) {
    const leave = latestDeparture(tt, {
      origin: stationId,
      startTime: DAY_START,
      endTime: lastBack.dep - Math.max(minTransfer, minStay),
      unreservedOnly,
    }).get(opts.origin);
    if (leave && leave.dep < opts.startTime) result.leaveBy = leave.dep;
  }
  return result;
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
