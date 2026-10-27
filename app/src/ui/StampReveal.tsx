// 打卡成功：一張車票，紀念章從上方用力蓋下去（整個 App 唯一的主動畫）

import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";

import { rocDateLong, rocDateStamp, stampAngle } from "./retro.ts";
import { StationStamp } from "./StationStamp.tsx";
import { colors, fonts } from "./theme.ts";
import { Ticket } from "./Ticket.tsx";

type Props = {
  stationId: string;
  name: string;
  timestamp: string;
  first: boolean; // 第一次來這站
  litCount: number;
  total: number;
};

export function StampReveal({ stationId, name, timestamp, first, litCount, total }: Props) {
  const press = useRef(new Animated.Value(0)).current;
  const angle = stampAngle(stationId);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        press.setValue(1);
        return;
      }
      // 停一下讓人先看到車票，再把章壓下去；落下瞬間震動一下
      Animated.sequence([
        Animated.delay(350),
        Animated.timing(press, { toValue: 1, duration: 240, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished && !cancelled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      });
    });
    return () => {
      cancelled = true;
    };
  }, [press]);

  const stampStyle = {
    opacity: press.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.5, 0.92] }),
    transform: [
      { scale: press.interpolate({ inputRange: [0, 1], outputRange: [2.2, 1] }) },
      { rotate: press.interpolate({ inputRange: [0, 1], outputRange: [`${angle - 18}deg`, `${angle}deg`] }) },
    ],
  };

  return (
    <View style={styles.wrap}>
      <Ticket
        stub={
          <View style={styles.stub}>
            <Text style={styles.stubCount}>{litCount}</Text>
            <Text style={styles.stubTotal}>/ {total} 站</Text>
          </View>
        }
      >
        <Text style={styles.small}>乘車日期　{rocDateLong(timestamp)}</Text>
        <Text style={[styles.name, name.length >= 3 && styles.nameLong]}>{name}</Text>
        <Text style={styles.status}>{first ? "新車站點亮" : "打卡完成"}</Text>
        <Text style={styles.dateStamp}>{rocDateStamp(timestamp)}</Text>
      </Ticket>
      <Animated.View style={[styles.stamp, stampStyle]} pointerEvents="none">
        <StationStamp name={name} date={rocDateStamp(timestamp)} size={112} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 8, paddingBottom: 4 },
  small: { fontSize: 12, color: colors.print, fontFamily: fonts.ticket, letterSpacing: 1 },
  name: { fontSize: 44, color: colors.print, fontFamily: fonts.ticket, letterSpacing: 6, marginTop: 6 },
  nameLong: { fontSize: 32, letterSpacing: 2 },
  status: { fontSize: 14, color: colors.print, fontFamily: fonts.ticket, marginTop: 2 },
  // 售票口的紫色日期戳，故意壓得有點歪
  dateStamp: {
    alignSelf: "flex-start",
    marginTop: 10,
    color: colors.dateInk,
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
    transform: [{ rotate: "-3deg" }],
    opacity: 0.85,
  },
  stub: { alignItems: "center", width: 64 },
  stubCount: { fontSize: 30, color: colors.stamp, fontFamily: fonts.ticket },
  stubTotal: { fontSize: 12, color: colors.print },
  stamp: { position: "absolute", right: 72, top: 16 },
});
