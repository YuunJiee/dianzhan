// 打卡紀錄的匯出／匯入格式：CheckIn 陣列的 JSON（規格書資料模型），日後加帳號系統可直接匯入。

import type { CheckIn } from "./db.ts";

export function toBackupJson(checkIns: CheckIn[]): string {
  return JSON.stringify(checkIns, null, 2);
}

export type ParsedBackup = { checkIns: CheckIn[]; skipped: number };

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isText = (v: unknown): v is string => typeof v === "string";

/**
 * 解析匯入的檔案。格式不對的紀錄跳過並計數，不讓一筆壞資料擋住整個檔案；
 * 整個檔案都不是打卡紀錄時丟出錯誤。
 */
export function parseBackupJson(text: string, knownStationIds: Set<string>): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("這不是 JSON 檔案");
  }
  if (!Array.isArray(data)) throw new Error("檔案內容不是打卡紀錄");

  const checkIns: CheckIn[] = [];
  let skipped = 0;
  for (const item of data) {
    const c = item as Record<string, unknown>;
    const valid =
      c !== null &&
      typeof c === "object" &&
      isText(c.id) &&
      c.id.length > 0 &&
      isText(c.stationId) &&
      knownStationIds.has(c.stationId) &&
      isText(c.timestamp) &&
      !Number.isNaN(Date.parse(c.timestamp)) &&
      isNumber(c.lat) &&
      isNumber(c.lng);
    if (!valid) {
      skipped++;
      continue;
    }
    checkIns.push({
      id: c.id as string,
      stationId: c.stationId as string,
      timestamp: c.timestamp as string,
      companions: isText(c.companions) ? c.companions : "",
      note: isText(c.note) ? c.note : "",
      lat: c.lat as number,
      lng: c.lng as number,
    });
  }
  if (checkIns.length === 0 && skipped > 0) throw new Error("檔案裡沒有可以匯入的打卡紀錄");
  return { checkIns, skipped };
}
