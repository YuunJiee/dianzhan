// 名片式硬票：粉橘紙色、兩側半圓缺口、剪票孔與虛線撕線

import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

import { colors } from "./theme.ts";

type Props = {
  children: ReactNode;
  stub?: ReactNode; // 撕線右側的票根
  notchColor?: string; // 缺口與剪票孔要和背後的底色一樣
  style?: ViewStyle;
};

export function Ticket({ children, stub, notchColor = colors.paper, style }: Props) {
  return (
    <View style={[styles.ticket, style]}>
      <View style={styles.main}>
        <View style={[styles.punch, { backgroundColor: notchColor }]} />
        {children}
      </View>
      {stub && (
        <>
          <View style={styles.perforation} />
          <View style={styles.stub}>{stub}</View>
        </>
      )}
      <View style={[styles.notch, styles.notchLeft, { backgroundColor: notchColor }]} />
      <View style={[styles.notch, styles.notchRight, { backgroundColor: notchColor }]} />
    </View>
  );
}

const NOTCH = 14;

const styles = StyleSheet.create({
  ticket: {
    flexDirection: "row",
    backgroundColor: colors.ticket,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ticketEdge,
    overflow: "hidden",
  },
  main: { flex: 1, paddingVertical: 14, paddingLeft: 26, paddingRight: 16 },
  // 剪票員剪出的缺孔
  punch: {
    position: "absolute",
    left: 22,
    top: -5,
    width: 12,
    height: 10,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  perforation: {
    width: 0,
    marginVertical: 8,
    borderLeftWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.ticketEdge,
  },
  stub: { alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  notch: {
    position: "absolute",
    top: "50%",
    marginTop: -NOTCH / 2,
    width: NOTCH,
    height: NOTCH,
    borderRadius: NOTCH / 2,
  },
  notchLeft: { left: -NOTCH / 2 },
  notchRight: { right: -NOTCH / 2 },
});
