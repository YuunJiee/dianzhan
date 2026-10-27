import { useRef, useState } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";

import type { Reach, Station } from "../csa/types.ts";
import { railwayMapStyle } from "./mapStyle.ts";
import { colors, stayBuckets, stayColor, unreachableColor } from "./theme.ts";

type Props = {
  stations: Station[];
  originId: string;
  reachById: Map<string, Reach>;
  visited: Map<string, number>; // 去過的車站 → 打卡次數
  mode: "reach" | "collection"; // 一日遊地圖，或只看集站成果
  onSelect: (stationId: string) => void;
};

const TAIWAN = { latitude: 23.75, longitude: 120.95, latitudeDelta: 3.6, longitudeDelta: 3.6 };

// 依縮放程度決定點的大小：看全島時點要小才不會疊在一起，放大後才變大好點選
type Zoom = 0 | 1 | 2;
const zoomOf = (r: Region): Zoom => (r.latitudeDelta > 1.8 ? 0 : r.latitudeDelta > 0.5 ? 1 : 2);
const SIZES = {
  dot: [8, 11, 15],
  ring: [1, 1.5, 2],
  faded: [4, 6, 9],
  stamp: [9, 12, 16],
  origin: [12, 16, 20],
} as const;

type Look = "origin" | "stamp" | "faded" | string; // string = 可停留時間的顏色

function dotStyle(look: Look, zoom: Zoom, visitedRing: boolean): ViewStyle {
  const circle = (d: number): ViewStyle => ({ width: d, height: d, borderRadius: d / 2 });
  if (look === "origin") {
    return {
      ...circle(SIZES.origin[zoom]),
      borderWidth: zoom === 0 ? 3 : 4,
      borderColor: colors.board,
      backgroundColor: colors.ticket,
    };
  }
  if (look === "faded") return { ...circle(SIZES.faded[zoom]), backgroundColor: unreachableColor };
  if (look === "stamp") {
    return {
      ...circle(SIZES.stamp[zoom]),
      borderWidth: SIZES.ring[zoom],
      borderColor: colors.paper,
      backgroundColor: colors.stamp,
    };
  }
  return {
    ...circle(SIZES.dot[zoom]),
    backgroundColor: look,
    borderWidth: visitedRing ? SIZES.ring[zoom] + 1.5 : SIZES.ring[zoom],
    borderColor: visitedRing ? colors.stamp : colors.paper,
  };
}

export function ReachMap({ stations, originId, reachById, visited, mode, onSelect }: Props) {
  const map = useRef<MapView>(null);
  const fitted = useRef(false);
  const [zoom, setZoom] = useState<Zoom>(0);

  // 開啟時讓本島剛好填滿畫面（所有車站都在本島上）
  const fitIsland = () => {
    if (fitted.current || stations.length === 0) return;
    fitted.current = true;
    map.current?.fitToCoordinates(
      stations.map((s) => ({ latitude: s.lat, longitude: s.lng })),
      // 上方留給圖例，下方留給「打卡」按鈕
      { edgePadding: { top: 48, right: 24, bottom: 96, left: 24 }, animated: false },
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={TAIWAN}
        toolbarEnabled={false}
        customMapStyle={railwayMapStyle}
        minZoomLevel={6.5}
        onMapReady={fitIsland}
        onRegionChangeComplete={(r) => setZoom(zoomOf(r))}
      >
        {stations.map((s) => {
          const isOrigin = s.id === originId && mode === "reach";
          const reach = reachById.get(s.id);
          const isVisited = visited.has(s.id);
          const look: Look = isOrigin
            ? "origin"
            : mode === "collection"
              ? isVisited
                ? "stamp"
                : "faded"
              : reach
                ? stayColor(reach.stayMinutes)
                : "faded";
          const ring = mode === "reach" && isVisited && look !== "origin" && look !== "faded";
          return (
            <Marker
              // 外觀或縮放改變時換 key，讓 Android 重新畫 marker
              key={`${s.id}-${look}-${ring ? "v" : ""}-${zoom}`}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              title={s.name}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => !isOrigin && onSelect(s.id)}
              zIndex={isOrigin ? 3 : look === "faded" ? 1 : 2}
            >
              <View style={dotStyle(look, zoom, ring)} />
            </Marker>
          );
        })}
      </MapView>
      {/* 圖例：地圖上方一條細帶，不遮住任何車站 */}
      <View style={styles.legend}>
        {mode === "reach" ? (
          <>
            {stayBuckets.map((b) => (
              <LegendItem key={b.label} color={b.color} label={b.short} />
            ))}
            <LegendItem color={unreachableColor} label="不足" />
            <LegendItem ring label="去過" />
          </>
        ) : (
          <>
            <LegendItem color={colors.stamp} label="已點亮" />
            <LegendItem color={unreachableColor} label="還沒去過" />
          </>
        )}
      </View>
    </View>
  );
}

function LegendItem({ color, label, ring }: { color?: string; label: string; ring?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, ring ? styles.legendVisited : { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  legend: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: 12,
    rowGap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderColor: colors.paperLine,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 9, height: 9, borderRadius: 4.5 },
  legendVisited: { backgroundColor: colors.paper, borderWidth: 2.5, borderColor: colors.stamp },
  legendText: { fontSize: 11, color: colors.print },
});
