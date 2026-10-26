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
};

// 可停留時間的上色分級（規格書 F1）
export const stayBuckets = [
  { min: 6 * 60, label: "6 小時以上", color: "#1b7a43" },
  { min: 3 * 60, label: "3～6 小時", color: "#4caf6e" },
  { min: 60, label: "1～3 小時", color: "#e0a526" },
  { min: 0, label: "少於 1 小時", color: "#e0662b" },
] as const;

export const unreachableColor = "#c3c8d0";

export function stayColor(stayMinutes: number | undefined): string {
  if (stayMinutes === undefined) return unreachableColor;
  return stayBuckets.find((b) => stayMinutes >= b.min)!.color;
}
