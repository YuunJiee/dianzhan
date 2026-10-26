import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { computeReach } from "./src/csa/csa.ts";
import type { Options } from "./src/csa/types.ts";
import { dataSource, getDates, getStations, getTimetable } from "./src/data/index.ts";
import { formatDate, formatTime, today } from "./src/ui/format.ts";
import { ReachList } from "./src/ui/ReachList.tsx";
import { ReachMap } from "./src/ui/ReachMap.tsx";
import { StationDetail } from "./src/ui/StationDetail.tsx";
import { StationPicker } from "./src/ui/StationPicker.tsx";
import { colors } from "./src/ui/theme.ts";
import { useSettings } from "./src/ui/useSettings.ts";

const TIME_STEP = 30;

export default function App() {
  const stations = useMemo(() => getStations(), []);
  const nameById = useMemo(() => new Map(stations.map((s) => [s.id, s.name])), [stations]);
  const nameOf = (id: string) => nameById.get(id) ?? id;

  const dates = useMemo(() => {
    const all = getDates();
    const upcoming = all.filter((d) => d >= today());
    return upcoming.length > 0 ? upcoming : all;
  }, []);

  const [settings, updateSettings, loaded] = useSettings();
  const [date, setDate] = useState(dates[0]);
  const [view, setView] = useState<"map" | "list">("map");
  const [picking, setPicking] = useState<"origin" | "destination" | undefined>();
  const [selected, setSelected] = useState<string | undefined>();

  const tt = getTimetable(date);
  const opts: Options = useMemo(
    () => ({
      origin: settings.homeStationId,
      startTime: settings.startTime,
      endTime: settings.endTime,
      unreservedOnly: settings.unreservedOnly,
    }),
    [settings],
  );
  const reach = useMemo(() => (tt ? computeReach(tt, opts) : []), [tt, opts]);
  const reachById = useMemo(() => new Map(reach.map((r) => [r.stationId, r])), [reach]);

  const shiftTime = (key: "startTime" | "endTime", delta: number) => {
    const next = settings[key] + delta;
    if (key === "startTime" && (next < 4 * 60 || next >= settings.endTime)) return;
    if (key === "endTime" && (next <= settings.startTime || next > 26 * 60)) return;
    updateSettings({ [key]: next });
  };

  if (!loaded || !tt) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.originRow}>
          <Pressable onPress={() => setPicking("origin")} style={styles.originButton}>
            <Text style={styles.originLabel}>出發站</Text>
            <Text style={styles.originName}>{nameOf(settings.homeStationId)} ▾</Text>
          </Pressable>
          <Pressable onPress={() => setPicking("destination")} style={styles.destButton}>
            <Text style={styles.destText}>指定目的地</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dates}>
          {dates.map((d) => (
            <Pressable key={d} onPress={() => setDate(d)} style={[styles.dateChip, d === date && styles.dateChipOn]}>
              <Text style={[styles.dateText, d === date && styles.dateTextOn]}>{formatDate(d)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.timeRow}>
          <TimeStepper
            label="出門"
            value={settings.startTime}
            onMinus={() => shiftTime("startTime", -TIME_STEP)}
            onPlus={() => shiftTime("startTime", TIME_STEP)}
          />
          <TimeStepper
            label="到家"
            value={settings.endTime}
            onMinus={() => shiftTime("endTime", -TIME_STEP)}
            onPlus={() => shiftTime("endTime", TIME_STEP)}
          />
          <View style={styles.localToggle}>
            <Text style={styles.localLabel}>只搭區間車</Text>
            <Switch
              value={settings.unreservedOnly}
              onValueChange={(v) => updateSettings({ unreservedOnly: v })}
              trackColor={{ true: "#8fb3e6", false: "#56708f" }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summary}>可當天來回 {reach.length} 站</Text>
        <View style={styles.tabs}>
          {(["map", "list"] as const).map((v) => (
            <Pressable key={v} onPress={() => setView(v)} style={[styles.tab, view === v && styles.tabOn]}>
              <Text style={[styles.tabText, view === v && styles.tabTextOn]}>{v === "map" ? "地圖" : "清單"}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.content}>
        {view === "map" ? (
          <ReachMap stations={stations} originId={settings.homeStationId} reachById={reachById} onSelect={setSelected} />
        ) : (
          <ReachList reach={reach} nameOf={nameOf} onSelect={setSelected} />
        )}
      </View>

      <Text style={styles.footer}>資料來源：{dataSource}｜非台鐵官方服務，時刻以台鐵公告為準</Text>

      <StationPicker
        visible={picking !== undefined}
        title={picking === "origin" ? "選擇出發站" : "指定目的地"}
        stations={picking === "destination" ? stations.filter((s) => s.id !== settings.homeStationId) : stations}
        onClose={() => setPicking(undefined)}
        onSelect={(s) => {
          if (picking === "origin") updateSettings({ homeStationId: s.id });
          else setSelected(s.id);
          setPicking(undefined);
        }}
      />

      <StationDetail
        stationId={selected}
        tt={tt}
        opts={opts}
        reach={selected ? reachById.get(selected) : undefined}
        nameOf={nameOf}
        onClose={() => setSelected(undefined)}
      />
    </View>
  );
}

function TimeStepper({ label, value, onMinus, onPlus }: { label: string; value: number; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable onPress={onMinus} hitSlop={8} style={styles.stepperButton}>
          <Text style={styles.stepperButtonText}>−</Text>
        </Pressable>
        <Text style={styles.stepperValue}>{formatTime(value)}</Text>
        <Pressable onPress={onPlus} hitSlop={8} style={styles.stepperButton}>
          <Text style={styles.stepperButtonText}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.accent, paddingTop: 48, paddingBottom: 12, gap: 10 },
  originRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16 },
  originButton: {},
  originLabel: { fontSize: 12, color: "#c9d6ea" },
  originName: { fontSize: 26, fontWeight: "700", color: "#fff" },
  destButton: { borderWidth: 1, borderColor: "#c9d6ea", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  destText: { color: "#fff", fontSize: 14 },
  dates: { paddingHorizontal: 12, gap: 6 },
  dateChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)" },
  dateChipOn: { backgroundColor: "#fff" },
  dateText: { color: "#fff", fontSize: 14 },
  dateTextOn: { color: colors.accent, fontWeight: "700" },
  timeRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 16 },
  stepper: {},
  stepperLabel: { fontSize: 12, color: "#c9d6ea" },
  stepperControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepperButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: { color: "#fff", fontSize: 16, lineHeight: 18 },
  stepperValue: { color: "#fff", fontSize: 18, fontWeight: "600", fontVariant: ["tabular-nums"] },
  localToggle: { marginLeft: "auto", alignItems: "center" },
  localLabel: { fontSize: 12, color: "#c9d6ea" },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  summary: { fontSize: 15, fontWeight: "600", color: colors.ink },
  tabs: { flexDirection: "row", backgroundColor: colors.line, borderRadius: 8, padding: 2 },
  tab: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 6 },
  tabOn: { backgroundColor: colors.surface },
  tabText: { fontSize: 14, color: colors.muted },
  tabTextOn: { color: colors.ink, fontWeight: "600" },
  content: { flex: 1 },
  footer: { fontSize: 11, color: colors.muted, textAlign: "center", paddingVertical: 6, paddingBottom: 18 },
});
