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

type Month = { year: number; month: number; weeks: (string | null)[][] };

/**
 * 涵蓋 dates 的每個月，切成一週一列（null = 空格）。
 * 只留有可選日期的週，已經過去的週不占畫面。
 */
function monthsOf(dates: string[]): Month[] {
  if (dates.length === 0) return [];
  const available = new Set(dates);
  const [y0, m0] = dates[0].split("-").map(Number);
  const [y1, m1] = dates[dates.length - 1].split("-").map(Number);
  const months: Month[] = [];
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
    const firstWeekday = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate();
    const cells: (string | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= days; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7);
      if (week.some((d) => d !== null && available.has(d))) weeks.push(week);
    }
    if (weeks.length > 0) months.push({ year: y, month: m, weeks });
  }
  return months;
}

const isWeekend = (column: number) => column === 0 || column === 6;

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
            {monthsOf(dates).map(({ year, month, weeks }) => (
              <View key={`${year}-${month}`} style={styles.month}>
                <Text style={styles.monthTitle}>
                  {year - 1911} 年 {month} 月
                </Text>
                <View style={styles.week}>
                  {WEEKDAYS.map((w, i) => (
                    <Text key={w} style={[styles.weekday, isWeekend(i) && styles.weekend]}>
                      {w}
                    </Text>
                  ))}
                </View>
                {weeks.map((week, wi) => (
                  <View key={wi} style={styles.week}>
                    {week.map((d, i) => {
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
                            <Text
                              style={[
                                styles.dayText,
                                isWeekend(i) && styles.weekend,
                                on && styles.dayTextOn,
                                !can && styles.dayOff,
                              ]}
                            >
                              {Number(d.slice(8))}
                            </Text>
                          </View>
                          <Text style={styles.todayMark}>{d === now ? "今天" : " "}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
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
  // 一週固定一列 7 格，用 flex 平分寬度，不會因為百分比進位而換行
  week: { flexDirection: "row" },
  cell: { flex: 1, height: 54, alignItems: "center", justifyContent: "center" },
  weekday: { flex: 1, height: 24, fontSize: 12, color: colors.muted, textAlign: "center", textAlignVertical: "center" },
  weekend: { color: colors.stamp },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  // 選中：紫色日期戳
  dayOn: { borderWidth: 2, borderColor: colors.dateInk, transform: [{ rotate: "-8deg" }] },
  dayText: { fontSize: 16, color: colors.print, fontVariant: ["tabular-nums"] },
  dayTextOn: { color: colors.dateInk, fontWeight: "700" },
  dayOff: { color: colors.paperLine },
  todayMark: { fontSize: 10, lineHeight: 12, color: colors.stamp },
});
