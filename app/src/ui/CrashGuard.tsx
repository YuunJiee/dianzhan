// 當機防護：畫面出錯時顯示錯誤內容而不是直接閃退；其他未處理的錯誤先存起來，下次開啟時顯示。
// 打包後的 App 沒有開發模式的紅色錯誤畫面，靠這個才看得到出了什麼事。

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Component, type ReactNode, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const KEY = "lastCrash";

type ErrorHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = { getGlobalHandler: () => ErrorHandler; setGlobalHandler: (h: ErrorHandler) => void };

const describe = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}\n\n${e.stack ?? ""}` : String(e));

/** 在 App 載入前呼叫：攔下未處理的錯誤，先存起來再交給原本的處理（會關閉 App）。 */
export function installCrashRecorder(): void {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!errorUtils) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    const record = `${new Date().toISOString()}${isFatal ? "（致命）" : ""}\n${describe(error)}`;
    AsyncStorage.setItem(KEY, record)
      .catch(() => {})
      .finally(() => previous(error, isFatal));
  });
}

function ErrorScreen({ title, detail, onDismiss }: { title: string; detail: string; onDismiss?: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.hint}>請截圖給開發者。</Text>
      <ScrollView style={styles.box}>
        <Text style={styles.detail} selectable>
          {detail}
        </Text>
      </ScrollView>
      {onDismiss && (
        <Pressable onPress={onDismiss} style={styles.button}>
          <Text style={styles.buttonText}>繼續使用</Text>
        </Pressable>
      )}
    </View>
  );
}

/** 畫面出錯時改顯示錯誤內容。 */
export class CrashBoundary extends Component<{ children: ReactNode }, { error?: unknown }> {
  state: { error?: unknown } = {};

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  render() {
    if (this.state.error !== undefined) {
      return <ErrorScreen title="畫面發生錯誤" detail={describe(this.state.error)} />;
    }
    return this.props.children;
  }
}

/** 上次開啟時如果當機過，先顯示當時的錯誤，看完再進 App。 */
export function LastCrashNotice({ children }: { children: ReactNode }) {
  const [crash, setCrash] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(setCrash)
      .catch(() => setCrash(null));
  }, []);

  if (crash === undefined) return null;
  if (crash) {
    return (
      <ErrorScreen
        title="上次開啟時發生錯誤"
        detail={crash}
        onDismiss={() => {
          AsyncStorage.removeItem(KEY).catch(() => {});
          setCrash(null);
        }}
      />
    );
  }
  return children;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1e9d8", padding: 20, paddingTop: 56, gap: 10 },
  title: { fontSize: 20, fontWeight: "700", color: "#2b2a28" },
  hint: { fontSize: 14, color: "#7a705f" },
  box: { flex: 1, borderWidth: 1, borderColor: "#ddd0b6", borderRadius: 3, padding: 10, backgroundColor: "#f8f3e8" },
  detail: { fontSize: 12, color: "#2b2a28", fontFamily: "monospace" },
  button: { backgroundColor: "#23241f", borderRadius: 3, paddingVertical: 12, alignItems: "center" },
  buttonText: { color: "#efe6d3", fontSize: 16, fontWeight: "600" },
});
