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

/**
 * 回程：每一站最晚幾點出發，仍能在 endTime 前回到 origin。
 * 除了最晚的一班，另外記下不同車次的前一班，作為建議搭乘。
 */
export function latestDeparture(
  tt: Timetable,
  opts: Options,
): { best: Map<string, Departure>; earlier: Map<string, Departure> } {
  const minTransfer = opts.minTransfer ?? DEFAULT_MIN_TRANSFER;
  const unreservedOnly = opts.unreservedOnly ?? false;
  const best = new Map<string, Departure>();
  const earlier = new Map<string, Departure>();
  const alighted = new Map<number, Connection>(); // 車次 → 下車的連結

  // 依抵達時間由晚到早掃描
  const byArrival = [...tt.connections].sort((a, b) => b[4] - a[4] || b[3] - a[3]);

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

    const candidate: Departure = { dep, ride: { board: c, alight } };
    const top = best.get(from);
    if (!top) {
      best.set(from, candidate);
    } else if (top.ride.board[0] === trip) {
      if (dep > top.dep) best.set(from, candidate);
    } else if (dep > top.dep) {
      earlier.set(from, top);
      best.set(from, candidate);
    } else if (dep < top.dep && dep > (earlier.get(from)?.dep ?? -Infinity)) {
      // 同一分鐘開出的其他車次（例如反方向）不算前一班
      earlier.set(from, candidate);
    }
  }
  return { best, earlier };
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
  const rides = earliestArrival(tt, opts);
  const { best, earlier } = latestDeparture(tt, opts);
  const result: Reach[] = [];

  for (const [stationId, ride] of rides) {
    if (stationId === opts.origin) continue;
    const back = best.get(stationId);
    if (!back) continue;
    // 至少要留最短轉乘時間，才來得及換月台搭回程
    const stay = back.dep - ride.alight[4];
    if (stay < (opts.minTransfer ?? DEFAULT_MIN_TRANSFER)) continue;

    const before = earlier.get(stationId);
    result.push({
      stationId,
      outbound: outboundJourney(tt, rides, opts.origin, stationId),
      inbound: inboundJourney(tt, best, back, opts.origin),
      inboundEarlier:
        before && before.dep >= ride.alight[4] ? inboundJourney(tt, best, before, opts.origin) : undefined,
      stayMinutes: stay,
    });
  }
  return result.sort((a, b) => b.stayMinutes - a.stayMinutes);
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
