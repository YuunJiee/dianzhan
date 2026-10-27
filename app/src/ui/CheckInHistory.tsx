// 打卡紀錄：新的在前，長按刪除；可匯出／匯入 JSON 備份（規格書 F2）

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { parseBackupJson, toBackupJson } from "../checkins/backup.ts";
import type { CheckIn } from "../checkins/db.ts";
import { colors } from "./theme.ts";

type Props = {
  visible: boolean;
  checkIns: CheckIn[];
  stationIds: Set<string>;
  nameOf: (id: string) => string;
  onDelete: (id: string) => Promise<void>;
  onImport: (records: CheckIn[]) => Promise<number>;
  onClose: () => void;
};

// "2026-10-27T14:05:12+08:00" → 「2026/10/27 14:05」（顯示打卡當地的時間）
function formatTimestamp(iso: string): string {
  const [day, time] = iso.split("T");
  return `${day.replace(/-/g, "/")} ${time.slice(0, 5)}`;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function CheckInHistory({ visible, checkIns, stationIds, nameOf, onDelete, onImport, onClose }: Props) {
  const exportBackup = async () => {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `點站打卡紀錄-${date}.json`);
      if (file.exists) file.delete();
      file.create();
      file.write(toBackupJson(checkIns));
      await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "備份打卡紀錄" });
    } catch (e) {
      Alert.alert("匯出失敗", message(e));
    }
  };

  const importBackup = async () => {
    try {
      // 用 expo-file-system 自己的選擇器，選到的檔案才有讀取權限（expo-document-picker 在 Expo Go 會被拒絕讀取）。
      // 不限檔案類型：Android 的檔案管理員常把 .json 標成其他類型，內容由 parseBackupJson 檢查
      const picked = await File.pickFileAsync();
      if (picked.canceled) return;
      const text = await picked.result.text();
      const { checkIns: records, skipped } = parseBackupJson(text, stationIds);
      const added = await onImport(records);
      const duplicates = records.length - added;
      Alert.alert(
        "匯入完成",
        [
          `新增 ${added} 筆打卡紀錄`,
          duplicates > 0 ? `${duplicates} 筆原本就有，已略過` : "",
          skipped > 0 ? `${skipped} 筆格式不對，已略過` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
    } catch (e) {
      Alert.alert("匯入失敗", message(e));
    }
  };

  const confirmDelete = (c: CheckIn) =>
    Alert.alert("刪除這筆打卡？", `${nameOf(c.stationId)}・${formatTimestamp(c.timestamp)}`, [
      { text: "取消", style: "cancel" },
      { text: "刪除", style: "destructive", onPress: () => onDelete(c.id) },
    ]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>打卡紀錄</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.link}>關閉</Text>
          </Pressable>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={exportBackup} style={styles.action} disabled={checkIns.length === 0}>
            <Text style={[styles.actionText, checkIns.length === 0 && styles.disabled]}>匯出備份</Text>
          </Pressable>
          <Pressable onPress={importBackup} style={styles.action}>
            <Text style={styles.actionText}>匯入備份</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>換手機或重灌前記得先匯出備份。長按紀錄可以刪除。</Text>
        <FlatList
          data={checkIns}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Pressable
              onLongPress={() => confirmDelete(item)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowTop}>
                <Text style={styles.station}>{nameOf(item.stationId)}</Text>
                <Text style={styles.time}>{formatTimestamp(item.timestamp)}</Text>
              </View>
              {item.companions !== "" && <Text style={styles.sub}>和 {item.companions}</Text>}
              {item.note !== "" && <Text style={styles.note}>{item.note}</Text>}
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>還沒有打卡紀錄。到車站時按右下角的「打卡」！</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 48 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink },
  link: { fontSize: 16, color: colors.accent },
  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 14 },
  action: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  actionText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  disabled: { color: colors.muted },
  hint: { fontSize: 12, color: colors.muted, paddingHorizontal: 20, paddingVertical: 10 },
  row: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    gap: 3,
  },
  pressed: { backgroundColor: colors.accentSoft },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  station: { fontSize: 17, fontWeight: "600", color: colors.ink },
  time: { fontSize: 13, color: colors.muted, fontVariant: ["tabular-nums"] },
  sub: { fontSize: 14, color: colors.ink },
  note: { fontSize: 14, color: colors.muted },
  empty: { padding: 24, textAlign: "center", color: colors.muted },
});
