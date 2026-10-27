// 選日期：月曆，只有有時刻表的日子能選；選中的日子像蓋上紫色日期戳

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { today } from "./format.ts";
import { colors } from "./theme.ts";

type Props = {
  visible: boolean;
  dates: string[]; // 可選的日期（YYYY-MM-DD），由早到晚
  selected: string;
  onSelect: (date: string) => void;
  onClose: () => void;
};

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const pad = (n: number) => String(n).padStart(2, "0");

/** 涵蓋 dates 的每個月，各自排成 7 欄的格子（null = 空格） */
function monthsOf(dates: string[]): { year: number; month: number; cells: (string | null)[] }[] {
  if (dates.length === 0) return [];
  const [y0, m0] = dates[0].split("-").map(Number);
  const [y1, m1] = dates[dates.length - 1].split("-").map(Number);
  const months = [];
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
    const firstWeekday = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate();
    const cells: (string | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= days; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
    while (cells.length % 7 !== 0) cells.push(null);
    months.push({ year: y, month: m, cells });
  }
  return months;
}

export function DatePicker({ visible, dates, selected, onSelect, onClose }: Props) {
  const available = new Set(dates);
  const now = today();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>選擇乘車日期</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>關閉</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>可以查詢今天起一個月內的時刻表</Text>
          <ScrollView>
            {monthsOf(dates).map(({ year, month, cells }) => (
              <View key={`${year}-${month}`} style={styles.month}>
                <Text style={styles.monthTitle}>
                  {year - 1911} 年 {month} 月
                </Text>
                <View style={styles.grid}>
                  {WEEKDAYS.map((w) => (
                    <Text key={w} style={[styles.cell, styles.weekday]}>
                      {w}
                    </Text>
                  ))}
                  {cells.map((d, i) => {
                    if (!d) return <View key={i} style={styles.cell} />;
                    const can = available.has(d);
                    const on = d === selected;
                    return (
                      <Pressable
                        key={d}
                        disabled={!can}
                        onPress={() => {
                          onSelect(d);
                          onClose();
                        }}
                        style={styles.cell}
                        accessibilityState={{ selected: on, disabled: !can }}
                      >
                        <View style={[styles.day, on && styles.dayOn]}>
                          <Text style={[styles.dayText, !can && styles.dayOff, on && styles.dayTextOn]}>
                            {Number(d.slice(8))}
                          </Text>
                        </View>
                        {d === now && <Text style={styles.todayMark}>今天</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 },
  sheet: { backgroundColor: colors.paper, borderRadius: 4, padding: 18, maxHeight: "85%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", color: colors.print },
  close: { fontSize: 15, color: colors.print },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4, marginBottom: 8 },
  month: { marginTop: 10 },
  monthTitle: { fontSize: 15, fontWeight: "700", color: colors.print, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, height: 48, alignItems: "center", justifyContent: "center" },
  weekday: { height: 24, fontSize: 12, color: colors.muted, textAlign: "center", textAlignVertical: "center" },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  // 選中：紫色日期戳
  dayOn: { borderWidth: 2, borderColor: colors.dateInk, transform: [{ rotate: "-8deg" }] },
  dayText: { fontSize: 16, color: colors.print, fontVariant: ["tabular-nums"] },
  dayTextOn: { color: colors.dateInk, fontWeight: "700" },
  dayOff: { color: colors.paperLine },
  todayMark: { position: "absolute", bottom: 0, fontSize: 9, color: colors.stamp },
});
