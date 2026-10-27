// App 取得車站與時刻表的唯一入口：從 GitHub Pages 下載，存在手機裡。
// 沒網路時用上次下載的資料；同一份時刻表（檔名含內容雜湊）只下載一次。

import { Directory, File, Paths } from "expo-file-system";

import type { Station, Timetable } from "../csa/types.ts";

const DATA_URL = "https://yuunjiee.github.io/dianzhan/data/";
const FETCH_TIMEOUT_MS = 10_000;

export type DataIndex = {
  source: string;
  updatedAt?: string; // 例如 "2026-10-27T02:31+08:00"
  dates: Record<string, string>; // 日期 → 時刻表檔名
};

export type Catalog = {
  index: DataIndex;
  stations: Station[];
  offline: boolean; // true = 這次沒連上網路，用的是手機裡的舊資料
};

const cacheDir = new Directory(Paths.document, "data");

function cached(name: string): File {
  return new File(cacheDir, name);
}

async function download(name: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(DATA_URL + name, { signal: controller.signal });
    if (!resp.ok) throw new Error(`下載 ${name} 失敗（HTTP ${resp.status}）`);
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

function save(name: string, body: string): void {
  if (!cacheDir.exists) cacheDir.create({ intermediates: true });
  const file = cached(name);
  if (file.exists) file.delete();
  file.create();
  file.write(body);
}

/** 讀取日期清單與車站。優先下載最新的，失敗就用手機裡的。 */
export async function loadCatalog(): Promise<Catalog> {
  try {
    const [indexText, stationsText] = await Promise.all([download("index.json"), download("stations.json")]);
    const index: DataIndex = JSON.parse(indexText);
    save("index.json", indexText);
    save("stations.json", stationsText);
    pruneTimetables(index);
    return { index, stations: JSON.parse(stationsText), offline: false };
  } catch (error) {
    const indexFile = cached("index.json");
    const stationsFile = cached("stations.json");
    if (!indexFile.exists || !stationsFile.exists) throw error;
    return {
      index: JSON.parse(await indexFile.text()),
      stations: JSON.parse(await stationsFile.text()),
      offline: true,
    };
  }
}

/** 某一天的時刻表；手機裡有就直接讀，沒有才下載。 */
export async function loadTimetable(index: DataIndex, date: string): Promise<Timetable> {
  const name = index.dates[date];
  if (!name) throw new Error(`沒有 ${date} 的時刻表`);
  const file = cached(name);
  if (file.exists) return JSON.parse(await file.text());
  const body = await download(name);
  save(name, body);
  return JSON.parse(body);
}

// 清掉已經不在日期清單裡的舊時刻表，避免越存越多
function pruneTimetables(index: DataIndex): void {
  if (!cacheDir.exists) return;
  const keep = new Set(Object.values(index.dates));
  for (const entry of cacheDir.list()) {
    if (entry instanceof File && entry.name.startsWith("timetable-") && !keep.has(entry.name)) entry.delete();
  }
}
