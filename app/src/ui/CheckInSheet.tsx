// 打卡流程：定位 → 找最近的車站 → 在 300 公尺內才能打卡（規格書 F2，只檢查 GPS、不防作弊）

import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { CHECK_IN_RADIUS_M, formatDistance, type Nearest, nearestStation } from "../checkins/geo.ts";
import type { CheckIn } from "../checkins/db.ts";
import type { NewCheckIn } from "../checkins/useCheckIns.ts";
import type { Station } from "../csa/types.ts";
import { StampReveal } from "./StampReveal.tsx";
import { colors, fonts } from "./theme.ts";

type Props = {
  visible: boolean;
  stations: Station[];
  visits: Map<string, number>;
  lastCompanions: string;
  onConfirm: (input: NewCheckIn) => Promise<CheckIn>;
  onClose: () => void;
};

type Step =
  | { kind: "locating" }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | { kind: "found"; nearest: Nearest; lat: number; lng: number }
  | { kind: "done"; station: Station; record: CheckIn; first: boolean };

export function CheckInSheet({ visible, stations, visits, lastCompanions, onConfirm, onClose }: Props) {
  const [step, setStep] = useState<Step>({ kind: "locating" });
  const [companions, setCompanions] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const locate = async () => {
    setStep({ kind: "locating" });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setStep({ kind: "denied" });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const nearest = nearestStation(stations, pos.coords.latitude, pos.coords.longitude);
      if (!nearest) throw new Error("沒有車站資料");
      setStep({ kind: "found", nearest, lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch (e) {
      setStep({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  useEffect(() => {
    if (!visible) return;
    setCompanions(lastCompanions);
    setNote("");
    locate();
    // 每次打開才重新定位
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const confirm = async (station: Station, lat: number, lng: number) => {
    setSaving(true);
    try {
      const first = !visits.has(station.id);
      const record = await onConfirm({ stationId: station.id, companions: companions.trim(), note: note.trim(), lat, lng });
      setStep({ kind: "done", station, record, first });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {step.kind === "locating" && (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.body}>正在確認你的位置…</Text>
            </View>
          )}

          {step.kind === "denied" && (
            <>
              <Text style={styles.title}>需要定位權限</Text>
              <Text style={styles.body}>打卡要確認你在車站 {CHECK_IN_RADIUS_M} 公尺內。請到手機設定允許「點站」使用位置。</Text>
              <Buttons onClose={onClose} primary="再試一次" onPrimary={locate} />
            </>
          )}

          {step.kind === "error" && (
            <>
              <Text style={styles.title}>定位失敗</Text>
              <Text style={styles.body}>請確認已開啟 GPS，在室外或靠窗處再試一次。</Text>
              <Text style={styles.detail}>{step.message}</Text>
              <Buttons onClose={onClose} primary="再試一次" onPrimary={locate} />
            </>
          )}

          {step.kind === "found" && step.nearest.withinRadius && (
            <>
              <Text style={styles.label}>你在</Text>
              <Text style={styles.station}>{step.nearest.station.name}</Text>
              <Text style={styles.detail}>
                距離車站 {formatDistance(step.nearest.meters)}
                {visits.has(step.nearest.station.id) ? `・已來過 ${visits.get(step.nearest.station.id)} 次` : "・第一次來！"}
              </Text>
              <TextInput style={styles.input} placeholder="同行者（例如：媽媽）" value={companions} onChangeText={setCompanions} />
              <TextInput
                style={[styles.input, styles.noteInput]}
                placeholder="備註（選填）"
                value={note}
                onChangeText={setNote}
                multiline
              />
              <Buttons
                onClose={onClose}
                primary={saving ? "打卡中…" : "打卡"}
                onPrimary={() => !saving && confirm(step.nearest.station, step.lat, step.lng)}
              />
            </>
          )}

          {step.kind === "found" && !step.nearest.withinRadius && (
            <>
              <Text style={styles.title}>不在車站附近</Text>
              <Text style={styles.body}>
                最近的車站是{step.nearest.station.name}，距離 {formatDistance(step.nearest.meters)}。要在 {CHECK_IN_RADIUS_M}{" "}
                公尺內才能打卡。
              </Text>
              <Buttons onClose={onClose} primary="重新定位" onPrimary={locate} />
              {__DEV__ && (
                // 只在開發模式出現，打包後的 App 不會有
                <Pressable
                  style={styles.devButton}
                  onPress={() =>
                    setStep({ ...step, nearest: { ...step.nearest, withinRadius: true }, lat: step.nearest.station.lat, lng: step.nearest.station.lng })
                  }
                >
                  <Text style={styles.devText}>（開發用）假裝在{step.nearest.station.name}</Text>
                </Pressable>
              )}
            </>
          )}

          {step.kind === "done" && (
            <>
              <StampReveal
                stationId={step.station.id}
                name={step.station.name}
                timestamp={step.record.timestamp}
                first={step.first}
                litCount={visits.size}
                total={stations.length}
              />
              <Buttons onClose={onClose} closeLabel="完成" />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Buttons({
  onClose,
  closeLabel = "取消",
  primary,
  onPrimary,
}: {
  onClose: () => void;
  closeLabel?: string;
  primary?: string;
  onPrimary?: () => void;
}) {
  return (
    <View style={styles.buttons}>
      <Pressable onPress={onClose} style={[styles.button, styles.secondary]}>
        <Text style={styles.secondaryText}>{closeLabel}</Text>
      </Pressable>
      {primary && (
        <Pressable onPress={onPrimary} style={[styles.button, styles.primary]}>
          <Text style={styles.primaryText}>{primary}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, paddingBottom: 36, gap: 10 },
  center: { alignItems: "center", gap: 12, paddingVertical: 24 },
  title: { fontSize: 20, fontWeight: "700", color: colors.ink },
  label: { fontSize: 14, color: colors.muted },
  station: { fontSize: 34, color: colors.print, fontFamily: fonts.ticket, letterSpacing: 4 },
  body: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  detail: { fontSize: 13, color: colors.muted },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  noteInput: { minHeight: 64, textAlignVertical: "top" },
  buttons: { flexDirection: "row", gap: 10, marginTop: 6 },
  button: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: "center" },
  primary: { backgroundColor: colors.accent },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondary: { backgroundColor: colors.background },
  secondaryText: { color: colors.ink, fontSize: 16 },
  devButton: { alignItems: "center", paddingTop: 4 },
  devText: { color: colors.muted, fontSize: 13, textDecorationLine: "underline" },
});
