// 把 docs/data/ 複製到 app/assets/data/，並產生 src/data/bundled.ts 讓 App 直接打包這些 JSON。
// 開發階段先用本機資料；之後改從 GitHub Pages 下載時，這個腳本就用不到了。
// npm start 前會自動執行。

import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const src = new URL("../../docs/data/", import.meta.url);
const dest = new URL("../assets/data/", import.meta.url);
const out = new URL("../src/data/bundled.ts", import.meta.url);

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith(".json"));
for (const f of files) copyFileSync(new URL(f, src), new URL(f, dest));

const index = JSON.parse(readFileSync(new URL("index.json", src), "utf-8"));
const timetableFiles = [...new Set(Object.values(index.dates as Record<string, string>))].sort();

const lines = [
  "// 由 scripts/sync-data.ts 自動產生，請勿手動修改",
  'import type { Station, Timetable } from "../csa/types.ts";',
  "",
  'export const stations: Station[] = require("../../assets/data/stations.json");',
  'export const index: { source: string; dates: Record<string, string> } = require("../../assets/data/index.json");',
  "",
  "export const timetables: Record<string, () => Timetable> = {",
  ...timetableFiles.map((f) => `  "${f}": () => require("../../assets/data/${f}"),`),
  "};",
  "",
];
mkdirSync(new URL(".", out), { recursive: true });
writeFileSync(out, lines.join("\n"));
console.log(`已同步 ${files.length} 個資料檔（${Object.keys(index.dates).length} 天）`);
