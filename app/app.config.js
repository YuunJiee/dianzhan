// 在 app.json 之上補上打包時才需要的設定。
// Google 地圖金鑰從環境變數讀取，不寫進程式碼（repo 是公開的）：
// - 本機：專案根目錄的 .env 的 GOOGLE_MAPS_API_KEY
// - EAS 雲端打包：EAS 專案的環境變數 GOOGLE_MAPS_API_KEY
// Expo Go 開發時用 Expo Go 內建的金鑰，不需要這個設定。

const fs = require("node:fs");
const path = require("node:path");

function readRootEnv(name) {
  if (process.env[name]) return process.env[name];
  try {
    const text = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf-8");
    const line = text.split("\n").find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}

module.exports = ({ config }) => {
  const mapsKey = readRootEnv("GOOGLE_MAPS_API_KEY");
  return {
    ...config,
    plugins: [...config.plugins, ["react-native-maps", { androidGoogleMapsApiKey: mapsKey }]],
  };
};
