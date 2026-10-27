import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import type { Reach } from "../csa/types.ts";
import { formatDurationShort, formatTime } from "./format.ts";
import { colors, fonts, stayColor } from "./theme.ts";

type Props = {
  reach: Reach[]; // 已依可停留時間排序
  nameOf: (id: string) => string;
  onSelect: (stationId: string) => void;
};

export function ReachList({ reach, nameOf, onSelect }: Props) {
  return (
    <FlatList
      data={reach}
      keyExtractor={(r) => r.stationId}
      ListHeaderComponent={
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.stay, styles.headerText]}>可停留</Text>
          <Text style={[styles.name, styles.headerText]}>車站</Text>
          <Text style={[styles.cell, styles.headerText]}>單程</Text>
          <Text style={[styles.cell, styles.headerText]}>抵達</Text>
          <Text style={[styles.cell, styles.headerText]}>回程</Text>
        </View>
      }
      renderItem={({ item }) => {
        const transfers = item.outbound.legs.length - 1 + item.inbound.legs.length - 1;
        return (
          <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={() => onSelect(item.stationId)}>
            <View style={styles.stay}>
              <View style={[styles.dot, { backgroundColor: stayColor(item.stayMinutes) }]} />
              <Text style={styles.stayText}>{formatDurationShort(item.stayMinutes)}</Text>
            </View>
            <View style={styles.name}>
              <Text style={styles.nameText}>{nameOf(item.stationId)}</Text>
              {transfers > 0 && <Text style={styles.sub}>轉乘 {transfers} 次</Text>}
            </View>
            <Text style={styles.cell}>{formatDurationShort(item.outbound.arr - item.outbound.dep)}</Text>
            <Text style={styles.cell}>{formatTime(item.arrivalTime)}</Text>
            <Text style={styles.cell}>{formatTime(item.returnTime)}</Text>
          </Pressable>
        );
      }}
      ListEmptyComponent={<Text style={styles.empty}>這個時間範圍內沒有可以當天來回的車站</Text>}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.paperLine,
    backgroundColor: colors.paper,
  },
  headerRow: { paddingVertical: 8, backgroundColor: colors.paper },
  headerText: { fontSize: 12, color: colors.muted },
  pressed: { backgroundColor: colors.accentSoft },
  stay: { width: 72, flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stayText: { fontSize: 15, fontWeight: "600", color: colors.ink, fontVariant: ["tabular-nums"] },
  name: { flex: 1 },
  nameText: { fontSize: 17, color: colors.print, fontFamily: fonts.ticket, letterSpacing: 1 },
  sub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  cell: { width: 52, textAlign: "right", fontSize: 14, color: colors.ink, fontVariant: ["tabular-nums"] },
  empty: { padding: 24, textAlign: "center", color: colors.muted },
});
