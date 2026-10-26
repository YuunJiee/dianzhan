// App 取得車站與時刻表的唯一入口。目前讀打包在 App 裡的資料，之後改成從 GitHub Pages 下載時只改這裡。

import type { Station, Timetable } from "../csa/types.ts";
import { index, stations, timetables } from "./bundled.ts";

export const dataSource = index.source;

export function getStations(): Station[] {
  return stations;
}

/** 可查詢的日期（YYYY-MM-DD），由早到晚。 */
export function getDates(): string[] {
  return Object.keys(index.dates).sort();
}

const cache = new Map<string, Timetable>();

export function getTimetable(date: string): Timetable | undefined {
  const file = index.dates[date];
  if (!file) return undefined;
  let tt = cache.get(file);
  if (!tt) {
    tt = timetables[file]();
    cache.set(file, tt);
  }
  return tt;
}
