// 鐵道懷舊風的小工具：民國紀年的日期戳、每站固定的蓋章角度

/** ISO 時間 → 售票口日期戳的寫法「115.10.27」（民國紀年） */
export function rocDateStamp(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${y - 1911}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
}

/** 每個車站的章蓋下去的角度固定（-14° ～ 14°），同一站每次看起來一樣，不同站各有歪斜。 */
export function stampAngle(stationId: string): number {
  let h = 0;
  for (const ch of stationId) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h % 29) - 14;
}
