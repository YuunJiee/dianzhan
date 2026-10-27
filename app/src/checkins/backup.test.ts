import assert from "node:assert/strict";
import { test } from "node:test";

import { parseBackupJson, toBackupJson } from "./backup.ts";
import type { CheckIn } from "./db.ts";

const stations = new Set(["1100", "1180"]);
const sample: CheckIn = {
  id: "a1",
  stationId: "1180",
  timestamp: "2026-10-27T14:05:12+08:00",
  companions: "媽媽",
  note: "車站旁的豆花",
  lat: 24.97,
  lng: 121.4,
};

test("匯出再匯入，內容完全相同", () => {
  const { checkIns, skipped } = parseBackupJson(toBackupJson([sample]), stations);
  assert.deepEqual(checkIns, [sample]);
  assert.equal(skipped, 0);
});

test("格式不對的紀錄跳過，其他照常匯入", () => {
  const text = JSON.stringify([
    sample,
    { ...sample, id: "a2", stationId: "9999" }, // 不存在的車站
    { ...sample, id: "a3", timestamp: "不是時間" },
    { ...sample, id: "a4", lat: "24.9" }, // 座標不是數字
    { stationId: "1100" }, // 缺欄位
    null,
  ]);
  const { checkIns, skipped } = parseBackupJson(text, stations);
  assert.deepEqual(checkIns.map((c) => c.id), ["a1"]);
  assert.equal(skipped, 5);
});

test("缺少同行者與備註時補空字串", () => {
  const { companions, note, ...rest } = sample;
  const { checkIns } = parseBackupJson(JSON.stringify([rest]), stations);
  assert.equal(checkIns[0].companions, "");
  assert.equal(checkIns[0].note, "");
});

test("整個檔案不對時給出錯誤訊息", () => {
  assert.throws(() => parseBackupJson("hello", stations), /不是 JSON/);
  assert.throws(() => parseBackupJson('{"a":1}', stations), /不是打卡紀錄/);
  assert.throws(() => parseBackupJson('[{"x":1}]', stations), /沒有可以匯入/);
  assert.deepEqual(parseBackupJson("[]", stations), { checkIns: [], skipped: 0 });
});
