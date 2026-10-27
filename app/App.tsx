import { useFonts } from "expo-font";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { DATABASE_NAME, migrate } from "./src/checkins/db.ts";
import { useCheckIns } from "./src/checkins/useCheckIns.ts";
import { computeReach } from "./src/csa/csa.ts";
import type { Options } from "./src/csa/types.ts";
import { useCatalog, useTimetable } from "./src/data/useData.ts";
import { DatePicker } from "./src/ui/DatePicker.tsx";
import { Flap, FlapText } from "./src/ui/Flap.tsx";
import { dateParts, formatTime, today } from "./src/ui/format.ts";
import { ReachList } from "./src/ui/ReachList.tsx";
import { ReachMap } from "./src/ui/ReachMap.tsx";
import { CheckInHistory } from "./src/ui/CheckInHistory.tsx";
import { CheckInSheet } from "./src/ui/CheckInSheet.tsx";
import { StationDetail } from "./src/ui/StationDetail.tsx";
import { StationPicker } from "./src/ui/StationPicker.tsx";
import { colors, fonts } from "./src/ui/theme.ts";
import { useSettings } from "./src/ui/useSettings.ts";

const TIME_STEP = 30;
const DATE_RANGE_DAYS = 30; // 只顯示一個月內的日期，和台鐵開放訂票的範圍相當
const MIN_STAY_OPTIONS = [30, 60, 120, 180, 240];

export default function Root() {
  // 車票與站章用的明體（缺字時自動改用系統字型）
  const [fontsLoaded, fontError] = useFonts({ [fonts.ticket]: require("./assets/fonts/TicketSerif.ttf") });
  // 字型最多等 3 秒，載不到就先用系統字型，不讓畫面卡住
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(timer);
  }, []);
  if (!fontsLoaded && !fontError && !fontTimeout) return <View style={styles.loading} />;
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
  const { checkIns, visits, lastCompanions, checkIn, remove, importMany } = useCheckIns();
  const [checkingIn, setCheckingIn] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const stations = catalog.value?.stations ?? [];
  const nameById = useMemo(() => new Map(stations.map((s) => [s.id, s.name])), [stations]);
  const nameOf = (id: string) => nameById.get(id) ?? id;
  const stationIds = useMemo(() => new Set(stations.map((s) => s.id)), [stations]);

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
  const [pickingDate, setPickingDate] = useState(false);
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
        <ActivityIndicator color={colors.print} />
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

        <View style={styles.dateRow}>
          <Pressable onPress={() => setPickingDate(true)} accessibilityRole="button" accessibilityLabel="選擇乘車日期">
            <Flap style={styles.dateTile}>
              <FlapText style={styles.dateText}>
                {dateParts(date).md}（{dateParts(date).weekday}）▾
              </FlapText>
            </Flap>
          </Pressable>
          <View style={styles.localToggle}>
            <Text style={styles.localLabel}>只搭區間車</Text>
            <Switch
              value={settings.unreservedOnly}
              onValueChange={(v) => updateSettings({ unreservedOnly: v })}
              trackColor={{ true: colors.ticketEdge, false: colors.boardTile }}
              thumbColor={settings.unreservedOnly ? colors.ticket : colors.boardMuted}
            />
          </View>
        </View>

        <View style={styles.timeRow}>
          <TimeStepper
            label="最早出門"
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
        </View>

        <View style={styles.minStayRow}>
          <Text style={styles.minStayLabel}>至少停留</Text>
          {MIN_STAY_OPTIONS.map((m) => (
            <Flap key={m} on={settings.minStay === m} onPress={() => updateSettings({ minStay: m })}>
              <FlapText on={settings.minStay === m} style={styles.minStayText}>
                {m < 60 ? `${m}分` : `${m / 60}小時`}
              </FlapText>
            </Flap>
          ))}
        </View>
      </View>

      <View style={styles.summaryRow}>
        {view === "collection" ? (
          <Pressable onPress={() => setShowHistory(true)} style={styles.collectionSummary}>
            <Text style={styles.summary}>
              已點亮 <Text style={styles.stampCount}>{visits.size}</Text> / {stations.length} 站
            </Text>
            <Text style={styles.historyLink}>紀錄 ›</Text>
          </Pressable>
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
        {/* 打卡按鈕做成一顆站章：朱紅雙圈、明體「打卡」，稍微蓋歪 */}
        <Pressable
          onPress={() => setCheckingIn(true)}
          style={({ pressed }) => [styles.checkInButton, pressed && styles.checkInPressed]}
          accessibilityRole="button"
          accessibilityLabel="打卡"
        >
          <View style={styles.checkInInner}>
            <Text style={styles.checkInText}>打卡</Text>
          </View>
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

      <DatePicker
        visible={pickingDate}
        dates={dates}
        selected={date}
        onSelect={setDate}
        onClose={() => setPickingDate(false)}
      />

      <CheckInSheet
        visible={checkingIn}
        stations={stations}
        visits={visits}
        lastCompanions={lastCompanions}
        onConfirm={checkIn}
        onClose={() => setCheckingIn(false)}
      />

      <CheckInHistory
        visible={showHistory}
        checkIns={checkIns}
        stationIds={stationIds}
        nameOf={nameOf}
        onDelete={remove}
        onImport={importMany}
        onClose={() => setShowHistory(false)}
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

function TimeStepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable onPress={onMinus} hitSlop={8} style={styles.stepperButton}>
          <Text style={styles.stepperButtonText}>−</Text>
        </Pressable>
        <View style={styles.stepperValue}>
          <Flap style={styles.timeTile}>
            <FlapText style={styles.timeDigits}>{formatTime(value).slice(0, 2)}</FlapText>
          </Flap>
          <Text style={styles.timeColon}>:</Text>
          <Flap style={styles.timeTile}>
            <FlapText style={styles.timeDigits}>{formatTime(value).slice(3)}</FlapText>
          </Flap>
        </View>
        <Pressable onPress={onPlus} hitSlop={8} style={styles.stepperButton}>
          <Text style={styles.stepperButtonText}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 8,
    backgroundColor: colors.paper,
  },
  loadingText: { fontSize: 14, color: colors.muted },
  errorTitle: { fontSize: 18, fontWeight: "700", color: colors.print },
  errorText: { fontSize: 15, color: colors.print },
  errorDetail: { fontSize: 12, color: colors.muted, textAlign: "center" },
  retryButton: {
    marginTop: 12,
    backgroundColor: colors.board,
    borderRadius: 3,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: { color: colors.boardText, fontSize: 16, fontWeight: "600" },
  container: { flex: 1, backgroundColor: colors.paper },
  // 上方：車站的翻牌式時刻表看板
  header: { backgroundColor: colors.board, paddingTop: 48, paddingBottom: 14, gap: 12 },
  originRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16 },
  originButton: {},
  originLabel: { fontSize: 12, color: colors.boardMuted },
  originName: { fontSize: 30, color: colors.boardText, fontFamily: fonts.ticket, letterSpacing: 4 },
  destButton: {
    borderWidth: 1,
    borderColor: colors.boardMuted,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  destText: { color: colors.boardText, fontSize: 14 },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  dateTile: { paddingHorizontal: 12, paddingVertical: 7 },
  dateText: { fontSize: 18, fontWeight: "700" },
  timeRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 18 },
  stepper: { gap: 4 },
  stepperLabel: { fontSize: 12, color: colors.boardMuted },
  stepperControls: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepperButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.boardMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: { color: colors.boardText, fontSize: 15, lineHeight: 17 },
  stepperValue: { flexDirection: "row", alignItems: "center", gap: 2 },
  timeTile: { paddingHorizontal: 5, paddingVertical: 3 },
  timeDigits: { fontSize: 20, fontWeight: "700" },
  timeColon: { color: colors.boardText, fontSize: 18, fontWeight: "700" },
  localToggle: { flexDirection: "row", alignItems: "center", gap: 6 },
  localLabel: { fontSize: 12, color: colors.boardMuted },
  minStayRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 5 },
  minStayLabel: { fontSize: 12, color: colors.boardMuted, marginRight: 4 },
  minStayText: { fontSize: 13 },
  // 看板下方：紙色的路線圖區
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: colors.paperLine,
  },
  summary: { fontSize: 15, fontWeight: "600", color: colors.print },
  tabs: { flexDirection: "row", borderWidth: 1, borderColor: colors.print, borderRadius: 3, overflow: "hidden" },
  tab: { paddingHorizontal: 14, paddingVertical: 5 },
  tabOn: { backgroundColor: colors.print },
  tabText: { fontSize: 14, color: colors.print },
  tabTextOn: { color: colors.paper, fontWeight: "600" },
  content: { flex: 1 },
  stampCount: { color: colors.stamp, fontWeight: "800" },
  collectionSummary: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  historyLink: { fontSize: 14, color: colors.dateInk },
  checkInButton: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: colors.stamp,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  // 按下去像把章壓下：縮一點、轉正
  checkInPressed: { transform: [{ rotate: "0deg" }, { scale: 0.94 }] },
  checkInInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: colors.stamp,
    alignItems: "center",
    justifyContent: "center",
  },
  checkInText: { color: colors.stamp, fontSize: 21, fontFamily: fonts.ticket, letterSpacing: 1 },
  footer: {
    fontSize: 11,
    color: colors.muted,
    textAlign: "center",
    paddingVertical: 6,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderColor: colors.paperLine,
  },
});
