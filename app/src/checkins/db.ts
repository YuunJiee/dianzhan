// 打卡紀錄存在手機的 SQLite（規格書資料模型 CheckIn）

import type { SQLiteDatabase } from "expo-sqlite";

export type CheckIn = {
  id: string; // UUID，匯入時用來去除重複
  stationId: string;
  timestamp: string; // ISO 8601，含時區
  companions: string; // 自由填寫，例如「媽媽」
  note: string;
  lat: number; // 打卡當下的位置
  lng: number;
};

export const DATABASE_NAME = "dianzhan.db";

/** SQLiteProvider 的 onInit：依 user_version 逐版建立／升級資料表。 */
export async function migrate(db: SQLiteDatabase): Promise<void> {
  const DATABASE_VERSION = 1;
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;
  if (current >= DATABASE_VERSION) return;

  if (current < 1) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS checkins (
        id TEXT PRIMARY KEY NOT NULL,
        station_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        companions TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        lat REAL NOT NULL,
        lng REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS checkins_station ON checkins (station_id);
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}

type Row = {
  id: string;
  station_id: string;
  timestamp: string;
  companions: string;
  note: string;
  lat: number;
  lng: number;
};

const fromRow = (r: Row): CheckIn => ({
  id: r.id,
  stationId: r.station_id,
  timestamp: r.timestamp,
  companions: r.companions,
  note: r.note,
  lat: r.lat,
  lng: r.lng,
});

/** 全部打卡紀錄，新的在前。 */
export async function listCheckIns(db: SQLiteDatabase): Promise<CheckIn[]> {
  const rows = await db.getAllAsync<Row>("SELECT * FROM checkins ORDER BY timestamp DESC");
  return rows.map(fromRow);
}

/** 新增；id 已存在時略過（匯入重複的檔案不會產生重複紀錄）。回傳實際新增的筆數。 */
export async function addCheckIns(db: SQLiteDatabase, checkIns: CheckIn[]): Promise<number> {
  let added = 0;
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const c of checkIns) {
      const result = await txn.runAsync(
        "INSERT OR IGNORE INTO checkins (id, station_id, timestamp, companions, note, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)",
        c.id,
        c.stationId,
        c.timestamp,
        c.companions,
        c.note,
        c.lat,
        c.lng,
      );
      added += result.changes;
    }
  });
  return added;
}

export async function deleteCheckIn(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync("DELETE FROM checkins WHERE id = ?", id);
}
