export { formatTime } from "../csa/csa.ts";

/** 分鐘數 → 「3 小時 20 分」 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} 分`;
  if (m === 0) return `${h} 小時`;
  return `${h} 小時 ${m} 分`;
}

/** 分鐘數 → 「3h20」，給清單等窄欄位用 */
export function formatDurationShort(minutes: number): string {
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

/** "2026-11-01" → 「11/1（日）」 */
export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = weekdays[new Date(y, m - 1, d).getDay()];
  return `${m}/${d}（${weekday}）`;
}

/** "2026-11-01" → { md: "11/1", weekday: "日" }，給時刻表看板分兩行顯示 */
export function dateParts(date: string): { md: string; weekday: string } {
  const [y, m, d] = date.split("-").map(Number);
  return { md: `${m}/${d}`, weekday: weekdays[new Date(y, m - 1, d).getDay()] };
}

/** 今天起第 offset 天的 YYYY-MM-DD（手機的當地時間） */
export function today(offset = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
