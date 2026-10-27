import { randomUUID } from "expo-crypto";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useState } from "react";

import { addCheckIns, type CheckIn, deleteCheckIn, listCheckIns } from "./db.ts";

/** ISO 8601 加上手機的時區，例如 2026-10-27T14:05:12+08:00 */
function localTimestamp(date = new Date()): string {
  const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(offset / 60)}:${pad(offset % 60)}`
  );
}

export type NewCheckIn = Pick<CheckIn, "stationId" | "companions" | "note" | "lat" | "lng">;

export function useCheckIns() {
  const db = useSQLiteContext();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);

  const reload = useCallback(async () => setCheckIns(await listCheckIns(db)), [db]);
  useEffect(() => {
    reload();
  }, [reload]);

  const checkIn = useCallback(
    async (input: NewCheckIn) => {
      const record: CheckIn = { ...input, id: randomUUID(), timestamp: localTimestamp() };
      await addCheckIns(db, [record]);
      await reload();
      return record;
    },
    [db, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteCheckIn(db, id);
      await reload();
    },
    [db, reload],
  );

  /** 匯入備份；已存在的紀錄（同 id）略過，回傳新增筆數。 */
  const importMany = useCallback(
    async (records: CheckIn[]) => {
      const added = await addCheckIns(db, records);
      await reload();
      return added;
    },
    [db, reload],
  );

  // 去過的車站 → 打卡次數
  const visits = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of checkIns) map.set(c.stationId, (map.get(c.stationId) ?? 0) + 1);
    return map;
  }, [checkIns]);

  // 上次填的同行者，打卡時預先帶入
  const lastCompanions = checkIns[0]?.companions ?? "";

  return { checkIns, visits, lastCompanions, checkIn, remove, importMany, reload };
}
