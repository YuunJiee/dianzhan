import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { DATABASE_NAME, migrate } from "./src/checkins/db.ts";
import { useCheckIns } from "./src/checkins/useCheckIns.ts";
import { computeReach } from "./src/csa/csa.ts";
import type { Options } from "./src/csa/types.ts";
import { useCatalog, useTimetable } from "./src/data/useData.ts";
import { formatDate, formatTime, today } from "./src/ui/format.ts";
import { ReachList } from "./src/ui/ReachList.tsx";
import { ReachMap } from "./src/ui/ReachMap.tsx";
import { CheckInSheet } from "./src/ui/CheckInSheet.tsx";
import { StationDetail } from "./src/ui/StationDetail.tsx";
import { StationPicker } from "./src/ui/StationPicker.tsx";
import { colors } from "./src/ui/theme.ts";
import { useSettings } from "./src/ui/useSettings.ts";

const TIME_STEP = 30;
const DATE_RANGE_DAYS = 30; // 只顯示一個月內的日期，和台鐵開放訂票的範圍相當
const MIN_STAY_OPTIONS = [30, 60, 120, 180, 240];

export default function Root() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
      <App />
    </SQLiteProvider>
  );
}

const TABS = [
  { key: "map", label: "地圖" },
  { key: "list", label: "清單" },
  { key: "collection", label: "集站" },
] as const;

function App() {
  const catalog = useCatalog();
  const { visits, lastCompanions, checkIn } = useCheckIns();
  const [checkingIn, setCheckingIn] = useState(false);
  const stations = catalog.value?.stations ?? [];
  const nameById = useMemo(() => new Map(stations.map((s) => [s.id, s.name])), [stations]);
  const nameOf = (id: string) => nameById.get(id) ?? id;

  const dates = useMemo(() => {
    const all = Object.keys(catalog.value?.index.dates ?? {}).sort();
    const upcoming = all.filter((d) => d >= today() && d <= today(DATE_RANGE_DAYS));
    return upcoming.length > 0 ? upcoming : all;
  }, [catalog.value]);

  const [settings, updateSettings, loaded] = useSettings();
  const [pickedDate, setDate] = useState<string | undefined>();
  const date = pickedDate && dates.includes(pickedDate) ? pickedDate : dates[0];
  const [view, setView] = useState<(typeof TABS)[number]["key"]>("map");
  const [picking, setPicking] = useState<"origin" | "destination" | undefined>();
  const [selected, setSelected] = useState<string | undefined>();

  const timetable = useTimetable(catalog.value, date);
  const tt = timetable.value;
  const opts: Options = useMemo(
    () => ({
      origin: settings.homeStationId,
      startTime: settings.startTime,
      endTime: settings.endTime,
      unreservedOnly: settings.unreservedOnly,
    }),
    [settings],
  );
  // allReach 含停留不足的車站（結果頁要用）；reach 只留達到「至少停留」的車站
  const allReach = useMemo(() => (tt ? computeReach(tt, opts) : []), [tt, opts]);
  const allById = useMemo(() => new Map(allReach.map((r) => [r.stationId, r])), [allReach]);
  const reach = useMemo(() => allReach.filter((r) => r.stayMinutes >= settings.minStay), [allReach, settings.minStay]);
  const reachById = useMemo(() => new Map(reach.map((r) => [r.stationId, r])), [reach]);

  const shiftTime = (key: "startTime" | "endTime", delta: number) => {
    const next = settings[key] + delta;
    if (key === "startTime" && (next < 4 * 60 || next >= settings.endTime)) return;
    if (key === "endTime" && (next <= settings.startTime || next > 26 * 60)) return;
    updateSettings({ [key]: next });
  };

  const error = catalog.error ?? (tt ? undefined : timetable.error);
  if (error) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorTitle}>無法取得時刻表資料</Text>
        <Text style={styles.errorText}>請確認網路連線後再試一次。</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <Pressable onPress={catalog.retry} style={styles.retryButton}>
          <Text style={styles.retryText}>重試</Text>
        </Pressable>
      </View>
    );
  }

  if (!loaded || !catalog.value || !tt) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.loadingText}>正在下載時刻表…</Text>
      </View>
    );
  }

  const { index, offline } = catalog.value;

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

        <View style={styles.minStayRow}>
          <Text style={styles.minStayLabel}>至少停留</Text>
          {MIN_STAY_OPTIONS.map((m) => (
            <Pressable
              key={m}
              onPress={() => updateSettings({ minStay: m })}
              style={[styles.minStayChip, settings.minStay === m && styles.minStayChipOn]}
            >
              <Text style={[styles.minStayText, settings.minStay === m && styles.minStayTextOn]}>
                {m < 60 ? `${m}分` : `${m / 60}小時`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.summaryRow}>
        {view === "collection" ? (
          <Text style={styles.summary}>
            已點亮 <Text style={styles.stampCount}>{visits.size}</Text> / {stations.length} 站
          </Text>
        ) : (
          <Text style={styles.summary}>
            可當天來回 {reach.length} 站{timetable.loading ? "（更新中…）" : ""}
          </Text>
        )}
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setView(t.key)} style={[styles.tab, view === t.key && styles.tabOn]}>
              <Text style={[styles.tabText, view === t.key && styles.tabTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.content}>
        {view === "list" ? (
          <ReachList reach={reach} nameOf={nameOf} onSelect={setSelected} />
        ) : (
          <ReachMap
            stations={stations}
            originId={settings.homeStationId}
            reachById={reachById}
            visited={visits}
            mode={view === "map" ? "reach" : "collection"}
            onSelect={setSelected}
          />
        )}
        <Pressable onPress={() => setCheckingIn(true)} style={styles.checkInButton}>
          <Text style={styles.checkInText}>打卡</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>
        資料來源：{index.source}
        {index.updatedAt ? `・${formatUpdatedAt(index.updatedAt)} 更新` : ""}
        {offline ? "（離線，使用上次下載的資料）" : ""}
        {"\n"}非台鐵官方服務，時刻以台鐵公告為準
      </Text>

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

      <CheckInSheet
        visible={checkingIn}
        stations={stations}
        visits={visits}
        lastCompanions={lastCompanions}
        onConfirm={async (input) => {
          await checkIn(input);
        }}
        onClose={() => setCheckingIn(false)}
      />

      <StationDetail
        stationId={selected}
        tt={tt}
        opts={opts}
        reach={selected ? allById.get(selected) : undefined}
        minStay={settings.minStay}
        visitCount={selected ? (visits.get(selected) ?? 0) : 0}
        nameOf={nameOf}
        onClose={() => setSelected(undefined)}
      />
    </View>
  );
}

// "2026-10-27T02:31+08:00" → 「10/27 02:31」
function formatUpdatedAt(iso: string): string {
  const [day, time] = iso.split("T");
  const [, m, d] = day.split("-").map(Number);
  return `${m}/${d} ${time.slice(0, 5)}`;
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  loadingText: { fontSize: 14, color: colors.muted },
  errorTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  errorText: { fontSize: 15, color: colors.ink },
  errorDetail: { fontSize: 12, color: colors.muted, textAlign: "center" },
  retryButton: { marginTop: 12, backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
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
  minStayRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 6 },
  minStayLabel: { fontSize: 12, color: "#c9d6ea", marginRight: 2 },
  minStayChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)" },
  minStayChipOn: { backgroundColor: "#fff" },
  minStayText: { color: "#fff", fontSize: 13 },
  minStayTextOn: { color: colors.accent, fontWeight: "700" },
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
  stampCount: { color: colors.stamp, fontWeight: "800" },
  checkInButton: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.stamp,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  checkInText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  footer: { fontSize: 11, color: colors.muted, textAlign: "center", paddingVertical: 6, paddingBottom: 18 },
});
