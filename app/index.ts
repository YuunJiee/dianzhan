import { registerRootComponent } from "expo";
import { createElement } from "react";

import App from "./App";
import { CrashBoundary, installCrashRecorder, LastCrashNotice } from "./src/ui/CrashGuard.tsx";

// 打包後的 App 出錯會直接閃退、看不到原因：先記下錯誤，下次開啟時顯示（見 CrashGuard）
installCrashRecorder();

function Root() {
  return createElement(CrashBoundary, null, createElement(LastCrashNotice, null, createElement(App)));
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Root);
