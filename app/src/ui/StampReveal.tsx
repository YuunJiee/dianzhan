// 打卡成功：一張車票，紀念章從上方用力蓋下去（整個 App 唯一的主動畫）

import * as Haptics from "expo-haptics";
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";

import { rocDateStamp, stampAngle } from "./retro.ts";
import { StationStamp } from "./StationStamp.tsx";
import { colors, fonts } from "./theme.ts";
import { Ticket } from "./Ticket.tsx";

type Props = {
  stationId: string;
  name: string;
  timestamp: string;
  visitNumber: number; // 這是第幾次來這站（1 = 第一次）
  companions: string;
  litCount: number;
  total: number;
};

export function StampReveal({ stationId, name, timestamp, visitNumber, companions, litCount, total }: Props) {
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
        {/* 日期只在紀念章上出現一次；票面放章上沒有的資訊 */}
        <Text style={styles.status}>{visitNumber === 1 ? "新車站點亮" : `第 ${visitNumber} 次來`}</Text>
        <Text style={[styles.name, name.length >= 3 && styles.nameLong]}>{name}</Text>
        <Text style={styles.detail}>
          {timestamp.slice(11, 16)}
          {companions ? `・和 ${companions}` : ""}
        </Text>
      </Ticket>
      <Animated.View style={[styles.stamp, stampStyle]} pointerEvents="none">
        <StationStamp name={name} date={rocDateStamp(timestamp)} size={112} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 8, paddingBottom: 4 },
  status: { fontSize: 14, color: colors.stamp, fontFamily: fonts.ticket, letterSpacing: 1 },
  name: { fontSize: 44, color: colors.print, fontFamily: fonts.ticket, letterSpacing: 6, marginTop: 4 },
  nameLong: { fontSize: 32, letterSpacing: 2 },
  detail: { fontSize: 14, color: colors.print, marginTop: 6, fontVariant: ["tabular-nums"] },
  stub: { alignItems: "center", width: 64 },
  stubCount: { fontSize: 30, color: colors.stamp, fontFamily: fonts.ticket },
  stubTotal: { fontSize: 12, color: colors.print },
  // 蓋在票面右半，壓在站名旁
  stamp: { position: "absolute", right: 74, top: 22 },
});
