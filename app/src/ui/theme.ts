export const colors = {
  muted: "#7a705f", // 次要文字（暖灰，配紙色）
  stamp: "#b8322a", // 站章朱：去過的車站、紀念章
  ticket: "#eed3bf", // 名片式硬票的紙色
  ticketEdge: "#d9b89f",
  print: "#2b2a28", // 車票的印刷墨
  dateInk: "#5a3e8e", // 售票口的日期戳（紫色印泥）
  // 車站翻牌式時刻表看板
  board: "#23241f",
  boardTile: "#36382f",
  boardSeam: "#1b1c18",
  boardText: "#efe6d3",
  boardMuted: "#a39b88",
  paper: "#f1e9d8", // 和地圖底圖同色系的紙色
  paperLight: "#f8f3e8", // 紙上的輸入框
  paperLine: "#ddd0b6",
};

// 車票、站章用的明體（只含站名與固定用字，見 scripts/subset-font.py）
export const fonts = { ticket: "TicketSerif" };

// 可停留時間的上色分級（規格書 F1）：單一墨綠色、越久越深。
// 已用 dataviz 驗證：深淺單調、相鄰級距看得出差別、最淺一級在地圖土色上對比 ≥ 2:1；
// 和朱紅（去過）色相不同，不會混淆。
export const stayBuckets = [
  { min: 6 * 60, label: "6 小時以上", short: "6h 以上", color: "#1b3f2a" },
  { min: 3 * 60, label: "3～6 小時", short: "3～6h", color: "#355f39" },
  { min: 60, label: "1～3 小時", short: "1～3h", color: "#567f43" },
  { min: 0, label: "少於 1 小時", short: "1h 內", color: "#7f9f52" },
] as const;

// 停留不足／無法來回：淡暖灰，和最淺的綠在色盲模擬下仍分得開；點也比較小、加細框才看得到
export const unreachableColor = "#c4bba8";
export const unreachableEdge = "#a0947d";

export function stayColor(stayMinutes: number | undefined): string {
  if (stayMinutes === undefined) return unreachableColor;
  return stayBuckets.find((b) => stayMinutes >= b.min)!.color;
}
