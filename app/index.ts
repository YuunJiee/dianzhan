import { registerRootComponent } from "expo";
import * as SplashScreen from "expo-splash-screen";
import { type ComponentType, createElement, useEffect } from "react";

import {
  CrashBoundary,
  ErrorScreen,
  describeError,
  installCrashRecorder,
  LastCrashNotice,
} from "./src/ui/CrashGuard.tsx";

// 打包後的 App 出錯會直接閃退、看不到原因：先記下錯誤，下次開啟時顯示（見 CrashGuard）。
// 一定要在載入 App 之前裝好——import 會比這個檔案的程式碼先執行，所以 App 改用 require 延後載入。
installCrashRecorder();

let App: ComponentType | undefined;
let loadError: unknown;
try {
  App = require("./App").default;
} catch (e) {
  loadError = e;
}

function Root() {
  // 一掛上畫面就收起啟動畫面，不依賴自動收起（之前在打包版卡在啟動畫面）
  useEffect(() => SplashScreen.hide(), []);
  if (!App) return createElement(ErrorScreen, { title: "App 載入失敗", detail: describeError(loadError) });
  return createElement(CrashBoundary, null, createElement(LastCrashNotice, null, createElement(App)));
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Root);
