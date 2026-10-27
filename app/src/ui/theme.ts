export const colors = {
  ink: "#1d2430",
  muted: "#667085",
  line: "#e4e7ec",
  surface: "#ffffff",
  background: "#f5f6f8",
  accent: "#1f4e8c", // 台鐵藍
  accentSoft: "#e8eef7",
  reserved: "#b54708", // 對號車
  danger: "#b42318",
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

// 可停留時間的上色分級（規格書 F1）
export const stayBuckets = [
  { min: 6 * 60, label: "6 小時以上", short: "6h 以上", color: "#1b7a43" },
  { min: 3 * 60, label: "3～6 小時", short: "3～6h", color: "#4caf6e" },
  { min: 60, label: "1～3 小時", short: "1～3h", color: "#e0a526" },
  { min: 0, label: "少於 1 小時", short: "1h 內", color: "#e0662b" },
] as const;

export const unreachableColor = "#b5aa95"; // 暖灰，放在紙色地圖上不突兀

export function stayColor(stayMinutes: number | undefined): string {
  if (stayMinutes === undefined) return unreachableColor;
  return stayBuckets.find((b) => stayMinutes >= b.min)!.color;
}
