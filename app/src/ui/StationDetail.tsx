// 車站結果頁：可行時列出去程、回程的可選班次，選好後顯示可停留時間與車票；不可行時說明差在哪（規格書 F1）

import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DEFAULT_MIN_TRANSFER, explainInfeasible, inboundOptions, outboundOptions } from "../csa/csa.ts";
import type { Journey, Leg, Options, Reach, Timetable } from "../csa/types.ts";
import { formatDuration, formatDurationShort, formatTime } from "./format.ts";
import { colors, fonts, stayColor, unreachableColor } from "./theme.ts";
import { Ticket } from "./Ticket.tsx";

type Props = {
  stationId: string | undefined;
  tt: Timetable;
  opts: Options;
  reach: Reach | undefined;
  minStay: number;
  visitCount: number;
  nameOf: (id: string) => string;
  onClose: () => void;
};

export function StationDetail({ stationId, tt, opts, reach, minStay, visitCount, nameOf, onClose }: Props) {
  const why = useMemo(
    () =>
      stationId && (!reach || reach.stayMinutes < minStay)
        ? explainInfeasible(tt, opts, stationId, minStay)
        : undefined,
    [tt, opts, stationId, reach, minStay],
  );

  return (
    <Modal visible={stationId !== undefined} animationType="slide" onRequestClose={onClose}>
      {stationId && (
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.route}>
                {nameOf(opts.origin)} → {nameOf(stationId)}
              </Text>
              {visitCount > 0 && <Text style={styles.visited}>已到訪 {visitCount} 次</Text>}
              <Text style={styles.condition}>
                最早 {formatTime(opts.startTime)} 出門・{formatTime(opts.endTime)} 前到家
                {opts.unreservedOnly ? "・只搭區間車" : ""}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>關閉</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {reach ? (
              <TripPlanner
                key={`${stationId}-${opts.origin}-${opts.startTime}-${opts.endTime}-${opts.unreservedOnly}`}
                tt={tt}
                opts={opts}
                reach={reach}
                minStay={minStay}
                leaveBy={why?.leaveBy}
                nameOf={nameOf}
              />
            ) : (
              why && (
                <View style={styles.verdict}>
                  <Text style={[styles.verdictValue, styles.verdictNo]}>無法當天來回</Text>
                  {why.noOutbound && (
                    <Text style={styles.reason}>
                      {formatTime(opts.startTime)} 之後當天沒有車可以到{nameOf(stationId)}。
                    </Text>
                  )}
                  {why.earliestHome !== undefined && (
                    <Text style={styles.reason}>就算一到就回頭，最早 {formatTime(why.earliestHome)} 才能到家。</Text>
                  )}
                  {why.leaveBy !== undefined && (
                    <Text style={styles.reason}>
                      最晚要在 {formatTime(why.leaveBy)} 出門，才能停留 {formatDuration(minStay)} 以上。
                    </Text>
                  )}
                  {why.leaveBy === undefined && (
                    <Text style={styles.reason}>就算提早出門也來不及，可以考慮改成兩天一夜。</Text>
                  )}
                </View>
              )
            )}
            <Text style={styles.disclaimer}>時刻依台鐵公告，誤點、停駛不在計算內；出發前請再確認。</Text>
          </ScrollView>
        </View>
      )}
    </Modal>
  );
}

// 可行時：去程、回程各一張班次表，選好的組合決定可停留時間
function TripPlanner({
  tt,
  opts,
  reach,
  minStay,
  leaveBy,
  nameOf,
}: {
  tt: Timetable;
  opts: Options;
  reach: Reach;
  minStay: number;
  leaveBy?: number;
  nameOf: (id: string) => string;
}) {
  const minTransfer = opts.minTransfer ?? DEFAULT_MIN_TRANSFER;
  const outs = useMemo(
    () => outboundOptions(tt, opts, reach.stationId, reach.returnTime - minTransfer),
    [tt, opts, reach, minTransfer],
  );
  const ins = useMemo(
    () => inboundOptions(tt, opts, reach.stationId, reach.arrivalTime + minTransfer),
    [tt, opts, reach, minTransfer],
  );
  // 預設：最早抵達＋最晚回程（停留最久）
  const [outIndex, setOutIndex] = useState(0);
  const [inIndex, setInIndex] = useState(0);
  const out = outs[outIndex] ?? reach.outbound;
  const back = ins[inIndex] ?? reach.inbound;
  const stay = back.dep - out.arr;
  const best = reach.stayMinutes;

  return (
    <>
      <View style={styles.verdict}>
        <View style={styles.verdictLabelRow}>
          <View
            style={[styles.verdictDot, { backgroundColor: stay >= minStay ? stayColor(stay) : unreachableColor }]}
          />
          <Text style={styles.verdictLabel}>
            {stay >= minStay ? "可以當天來回，可停留" : "可以當天來回，但只能停留"}
          </Text>
        </View>
        <Text style={styles.verdictValue}>{formatDuration(stay)}</Text>
        <Text style={styles.verdictSub}>
          {formatTime(out.dep)} 出門・{formatTime(out.arr)} 抵達・{formatTime(back.dep)} 搭回程・{formatTime(back.arr)}{" "}
          到家
        </Text>
        {stay < best && <Text style={styles.reason}>最多可以停留 {formatDuration(best)}（選最早到、最晚回）。</Text>}
        {best < minStay && (
          <Text style={styles.reason}>
            少於你設定的至少停留 {formatDuration(minStay)}；
            {leaveBy !== undefined
              ? `最晚 ${formatTime(leaveBy)} 出門，就能停留 ${formatDuration(minStay)} 以上。`
              : `就算提早出門也待不到 ${formatDuration(minStay)}。`}
          </Text>
        )}
      </View>

      <OptionTable
        title="去程班次"
        hint="越晚出門越晚到，選一班適合的"
        options={outs}
        selected={outIndex}
        badges={["最早到"]}
        // 來不及接上已選的回程，就不能選
        disabled={(o) => o.arr + minTransfer > back.dep}
        onSelect={setOutIndex}
      />
      <JourneyCard title="去程車票" journey={out} nameOf={nameOf} />

      <OptionTable
        title="回程班次"
        hint="錯過「最晚」那班就回不了家，建議搭早一點的"
        options={ins}
        selected={inIndex}
        badges={["最晚", "建議"]}
        disabled={(o) => o.dep < out.arr + minTransfer}
        onSelect={setInIndex}
      />
      <JourneyCard title="回程車票" journey={back} nameOf={nameOf} />
    </>
  );
}

// 班次表：像車站的時刻表，一列一個走法，點選後換成那一班
function OptionTable({
  title,
  hint,
  options,
  selected,
  badges,
  disabled,
  onSelect,
}: {
  title: string;
  hint: string;
  options: Journey[];
  selected: number;
  badges: string[]; // 依序標在前幾列
  disabled: (option: Journey) => boolean;
  onSelect: (index: number) => void;
}) {
  return (
    <View style={styles.options}>
      <View style={styles.journeyHeader}>
        <Text style={styles.journeyTitle}>{title}</Text>
        <Text style={styles.journeyMeta}>{hint}</Text>
      </View>
      <View style={styles.optionTable}>
        {options.map((o, i) => {
          const off = disabled(o);
          const on = i === selected;
          return (
            <Pressable
              key={`${o.dep}-${o.arr}`}
              disabled={off}
              onPress={() => onSelect(i)}
              style={({ pressed }) => [styles.optionRow, on && styles.optionOn, pressed && styles.optionPressed]}
              accessibilityState={{ selected: on, disabled: off }}
            >
              <Text style={[styles.optionTime, off && styles.optionOff]}>
                {formatTime(o.dep)} → {formatTime(o.arr)}
              </Text>
              <Text style={[styles.optionMeta, off && styles.optionOff]}>
                {formatDurationShort(o.arr - o.dep)}・{o.legs.length === 1 ? "直達" : `轉 ${o.legs.length - 1}`}
              </Text>
              <View style={styles.optionTags}>
                {o.legs.some((l) => l.reserved) && <Text style={[styles.tag, off && styles.optionOff]}>對號</Text>}
                {badges[i] && <Text style={[styles.badge, off && styles.optionOff]}>{badges[i]}</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// 一段行程＝一疊車票：每段車一張，換車處標出在哪轉、要等多久
function JourneyCard({
  title,
  note,
  journey,
  nameOf,
}: {
  title: string;
  note?: string;
  journey: Journey;
  nameOf: (id: string) => string;
}) {
  const transfers = journey.legs.length - 1;
  return (
    <View style={styles.journey}>
      <View style={styles.journeyHeader}>
        <Text style={styles.journeyTitle}>{title}</Text>
        <Text style={styles.journeyMeta}>
          {formatDuration(journey.arr - journey.dep)}
          {transfers > 0 ? `・轉乘 ${transfers} 次` : "・直達"}
        </Text>
      </View>
      {note && <Text style={styles.journeyNote}>{note}</Text>}
      {journey.legs.map((leg, i) => (
        <View key={i}>
          {i > 0 && (
            <Text style={styles.transfer}>
              {nameOf(leg.from)} 轉車・等 {formatDuration(leg.dep - journey.legs[i - 1].arr)}
            </Text>
          )}
          <LegTicket leg={leg} nameOf={nameOf} />
        </View>
      ))}
    </View>
  );
}

function LegTicket({ leg, nameOf }: { leg: Leg; nameOf: (id: string) => string }) {
  return (
    <Ticket
      notchColor={colors.paper}
      stub={
        <View style={styles.legStub}>
          <Text style={styles.trainNo}>{leg.trainNo}</Text>
          <Text style={styles.trainType}>{leg.trainType}</Text>
          {leg.reserved && <Text style={styles.reservedStamp}>對號</Text>}
        </View>
      }
    >
      <View style={styles.legRow}>
        <View style={styles.legEnd}>
          <Text style={styles.legStation} numberOfLines={1} adjustsFontSizeToFit>
            {nameOf(leg.from)}
          </Text>
          <Text style={styles.legTime}>{formatTime(leg.dep)}</Text>
        </View>
        <Text style={styles.legArrow}>→</Text>
        <View style={[styles.legEnd, styles.legEndRight]}>
          <Text style={styles.legStation} numberOfLines={1} adjustsFontSizeToFit>
            {nameOf(leg.to)}
          </Text>
          <Text style={styles.legTime}>{formatTime(leg.arr)}</Text>
        </View>
      </View>
    </Ticket>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, paddingTop: 48 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  route: { fontSize: 26, color: colors.print, fontFamily: fonts.ticket, letterSpacing: 2 },
  condition: { fontSize: 13, color: colors.muted, marginTop: 4 },
  visited: { fontSize: 13, color: colors.stamp, fontWeight: "700", marginTop: 4 },
  close: { fontSize: 16, color: colors.print, marginTop: 4 },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  // 和首頁上方一樣的時刻表看板
  verdict: { backgroundColor: colors.board, borderRadius: 4, padding: 16, gap: 6 },
  verdictLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  // 深墨綠在看板上看不到，加一圈淺色邊
  verdictDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: colors.boardText },
  verdictLabel: { fontSize: 13, color: colors.boardMuted },
  verdictValue: { fontSize: 32, color: colors.boardText, fontFamily: fonts.ticket },
  verdictNo: { color: colors.ticket },
  verdictSub: { fontSize: 15, color: colors.boardText, fontVariant: ["tabular-nums"] },
  reason: { fontSize: 15, color: colors.boardText, lineHeight: 22 },
  options: { gap: 6, marginTop: 10 },
  optionTable: { borderWidth: 1, borderColor: colors.paperLine, borderRadius: 3, overflow: "hidden" },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.paperLine,
    gap: 10,
  },
  optionOn: { backgroundColor: colors.ticket },
  optionPressed: { opacity: 0.7 },
  optionTime: { fontSize: 16, fontWeight: "600", color: colors.print, fontVariant: ["tabular-nums"] },
  optionMeta: { fontSize: 13, color: colors.muted, fontVariant: ["tabular-nums"] },
  optionOff: { color: colors.paperLine },
  optionTags: { marginLeft: "auto", flexDirection: "row", gap: 6 },
  tag: {
    fontSize: 11,
    color: colors.stamp,
    borderWidth: 1,
    borderColor: colors.stamp,
    borderRadius: 2,
    paddingHorizontal: 4,
  },
  badge: { fontSize: 11, color: colors.dateInk, fontWeight: "700" },
  journey: { gap: 8, marginTop: 6 },
  journeyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 2,
  },
  journeyTitle: { fontSize: 17, color: colors.print, fontFamily: fonts.ticket },
  journeyMeta: { fontSize: 13, color: colors.muted },
  journeyNote: { fontSize: 13, color: colors.dateInk, marginTop: -4, paddingHorizontal: 2 },
  transfer: { fontSize: 13, color: colors.muted, textAlign: "center", paddingVertical: 6 },
  legRow: { flexDirection: "row", alignItems: "center" },
  legEnd: { flex: 1 },
  legEndRight: { alignItems: "flex-end" },
  legStation: { fontSize: 22, color: colors.print, fontFamily: fonts.ticket, letterSpacing: 2 },
  legTime: { fontSize: 18, color: colors.print, fontWeight: "600", fontVariant: ["tabular-nums"], marginTop: 2 },
  legArrow: { fontSize: 18, color: colors.print, fontFamily: fonts.ticket, paddingHorizontal: 8 },
  legStub: { alignItems: "center", width: 58, gap: 2 },
  trainNo: { fontSize: 18, color: colors.print, fontFamily: fonts.ticket, fontVariant: ["tabular-nums"] },
  trainType: { fontSize: 13, color: colors.print, fontFamily: fonts.ticket },
  // 對號車：像蓋上去的方形小章
  reservedStamp: {
    marginTop: 3,
    fontSize: 11,
    color: colors.stamp,
    fontFamily: fonts.ticket,
    borderWidth: 1.5,
    borderColor: colors.stamp,
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    transform: [{ rotate: "-6deg" }],
  },
  hint: { fontSize: 13, color: colors.muted, paddingHorizontal: 4 },
  disclaimer: { fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 8 },
});
