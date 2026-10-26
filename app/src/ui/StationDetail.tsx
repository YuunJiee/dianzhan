// 車站結果頁：可行時列出去程、回程與建議的前一班；不可行時說明差在哪（規格書 F1）

import { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { earlierInbound, explainInfeasible } from "../csa/csa.ts";
import type { Journey, Options, Reach, Timetable } from "../csa/types.ts";
import { formatDuration, formatTime } from "./format.ts";
import { colors, stayColor } from "./theme.ts";

type Props = {
  stationId: string | undefined;
  tt: Timetable;
  opts: Options;
  reach: Reach | undefined;
  nameOf: (id: string) => string;
  onClose: () => void;
};

export function StationDetail({ stationId, tt, opts, reach, nameOf, onClose }: Props) {
  const earlier = useMemo(() => (reach ? earlierInbound(tt, opts, reach) : undefined), [tt, opts, reach]);
  const why = useMemo(
    () => (stationId && !reach ? explainInfeasible(tt, opts, stationId) : undefined),
    [tt, opts, stationId, reach],
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
              <Text style={styles.condition}>
                {formatTime(opts.startTime)} 後出門・{formatTime(opts.endTime)} 前到家
                {opts.unreservedOnly ? "・只搭區間車" : ""}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>關閉</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            {reach ? (
              <>
                <View style={[styles.verdict, { borderColor: stayColor(reach.stayMinutes) }]}>
                  <Text style={styles.verdictLabel}>可以當天來回，可停留</Text>
                  <Text style={styles.verdictValue}>{formatDuration(reach.stayMinutes)}</Text>
                  <Text style={styles.verdictSub}>
                    {formatTime(reach.outbound.arr)} 抵達・{formatTime(reach.inbound.dep)} 搭回程
                  </Text>
                </View>
                <JourneyCard title="去程（最早抵達）" journey={reach.outbound} nameOf={nameOf} />
                <JourneyCard title="回程（最晚一班）" journey={reach.inbound} nameOf={nameOf} />
                {earlier ? (
                  <JourneyCard
                    title="建議搭前一班"
                    note="錯過這班時，還有上面的最晚一班可以搭"
                    journey={earlier}
                    nameOf={nameOf}
                    highlight
                  />
                ) : (
                  <Text style={styles.hint}>沒有更早回到家的班次，最晚一班就是唯一的回程，請預留時間。</Text>
                )}
              </>
            ) : (
              why && (
                <View style={[styles.verdict, { borderColor: colors.danger }]}>
                  <Text style={styles.verdictValue}>無法當天來回</Text>
                  {why.noOutbound && (
                    <Text style={styles.reason}>{formatTime(opts.startTime)} 之後當天沒有車可以到{nameOf(stationId)}。</Text>
                  )}
                  {why.earliestHome !== undefined && (
                    <Text style={styles.reason}>就算一到就回頭，最早 {formatTime(why.earliestHome)} 才能到家。</Text>
                  )}
                  {why.leaveBy !== undefined && (
                    <Text style={styles.reason}>最晚要在 {formatTime(why.leaveBy)} 出門，才趕得上當天來回。</Text>
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

function JourneyCard({
  title,
  note,
  journey,
  nameOf,
  highlight,
}: {
  title: string;
  note?: string;
  journey: Journey;
  nameOf: (id: string) => string;
  highlight?: boolean;
}) {
  const transfers = journey.legs.length - 1;
  return (
    <View style={[styles.card, highlight && styles.cardHighlight]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardMeta}>
          {formatDuration(journey.arr - journey.dep)}
          {transfers > 0 ? `・轉乘 ${transfers} 次` : "・直達"}
        </Text>
      </View>
      {note && <Text style={styles.cardNote}>{note}</Text>}
      {journey.legs.map((leg, i) => (
        <View key={i} style={styles.leg}>
          <View style={styles.legTrain}>
            <Text style={styles.trainNo}>{leg.trainNo}</Text>
            <Text style={[styles.trainType, leg.reserved && styles.reserved]}>{leg.trainType}</Text>
            {leg.reserved && <Text style={styles.reservedTag}>需訂位</Text>}
          </View>
          <Text style={styles.legTimes}>
            {formatTime(leg.dep)} {nameOf(leg.from)} → {formatTime(leg.arr)} {nameOf(leg.to)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 48 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  route: { fontSize: 22, fontWeight: "700", color: colors.ink },
  condition: { fontSize: 13, color: colors.muted, marginTop: 4 },
  close: { fontSize: 16, color: colors.accent, marginTop: 4 },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  verdict: { backgroundColor: colors.surface, borderRadius: 12, borderLeftWidth: 6, padding: 16, gap: 4 },
  verdictLabel: { fontSize: 13, color: colors.muted },
  verdictValue: { fontSize: 28, fontWeight: "700", color: colors.ink },
  verdictSub: { fontSize: 14, color: colors.ink },
  reason: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 10 },
  cardHighlight: { borderWidth: 1.5, borderColor: colors.accent },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  cardMeta: { fontSize: 13, color: colors.muted },
  cardNote: { fontSize: 13, color: colors.accent, marginTop: -4 },
  leg: { gap: 2 },
  legTrain: { flexDirection: "row", alignItems: "center", gap: 8 },
  trainNo: { fontSize: 15, fontWeight: "600", color: colors.ink, fontVariant: ["tabular-nums"] },
  trainType: { fontSize: 14, color: colors.ink },
  reserved: { color: colors.reserved },
  reservedTag: {
    fontSize: 11,
    color: colors.reserved,
    borderWidth: 1,
    borderColor: colors.reserved,
    borderRadius: 4,
    paddingHorizontal: 4,
  },
  legTimes: { fontSize: 15, color: colors.ink, fontVariant: ["tabular-nums"] },
  hint: { fontSize: 13, color: colors.muted, paddingHorizontal: 4 },
  disclaimer: { fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 8 },
});
