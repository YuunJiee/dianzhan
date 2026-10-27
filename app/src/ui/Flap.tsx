// 翻牌式時刻表的一片牌：深色牌面、中間一道上下翻片的縫；選中時換成車票紙色

import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, type TextStyle, View, type ViewStyle } from "react-native";

import { colors } from "./theme.ts";

type Props = {
  children: ReactNode;
  on?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

export function Flap({ children, on, onPress, style }: Props) {
  const body = (
    <View style={[styles.tile, on && styles.tileOn, style]}>
      {children}
      <View style={[styles.seam, on && styles.seamOn]} pointerEvents="none" />
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}>
      {body}
    </Pressable>
  );
}

/** 牌面上的字：選中時改成印刷墨色 */
export function FlapText({ children, on, style }: { children: ReactNode; on?: boolean; style?: TextStyle }) {
  return <Text style={[styles.text, on && styles.textOn, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.boardTile,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tileOn: { backgroundColor: colors.ticket },
  seam: { position: "absolute", left: 0, right: 0, top: "50%", height: 1, backgroundColor: colors.boardSeam },
  seamOn: { backgroundColor: colors.ticketEdge },
  text: { color: colors.boardText, fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] },
  textOn: { color: colors.print },
});
