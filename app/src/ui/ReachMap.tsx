import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";

import type { Reach, Station } from "../csa/types.ts";
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

export function ReachMap({ stations, originId, reachById, visited, mode, onSelect }: Props) {
  return (
    <View style={styles.container}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={TAIWAN} toolbarEnabled={false}>
        {stations.map((s) => {
          const isOrigin = s.id === originId && mode === "reach";
          const reach = reachById.get(s.id);
          const isVisited = visited.has(s.id);
          const look = isOrigin
            ? "origin"
            : mode === "collection"
              ? isVisited
                ? "stamp"
                : "faded"
              : reach
                ? stayColor(reach.stayMinutes)
                : "unreachable";
          return (
            <Marker
              // 外觀改變時換 key，讓 Android 重新畫 marker
              key={`${s.id}-${look}-${isVisited ? "v" : ""}`}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              title={s.name}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              onPress={() => !isOrigin && onSelect(s.id)}
              zIndex={isOrigin ? 3 : reach || (mode === "collection" && isVisited) ? 2 : 1}
            >
              <View
                style={[
                  styles.dot,
                  look === "origin"
                    ? styles.origin
                    : look === "stamp"
                      ? styles.stamp
                      : look === "faded" || look === "unreachable"
                        ? styles.unreachable
                        : { backgroundColor: look },
                  mode === "reach" && isVisited && !isOrigin && styles.visitedRing,
                ]}
              />
            </Marker>
          );
        })}
      </MapView>
      {mode === "reach" ? (
        <View style={styles.legend}>
          {stayBuckets.map((b) => (
            <View key={b.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: b.color }]} />
              <Text style={styles.legendText}>{b.label}</Text>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: unreachableColor }]} />
            <Text style={styles.legendText}>停留不足或無法來回</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendVisited]} />
            <Text style={styles.legendText}>去過</Text>
          </View>
        </View>
      ) : (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.stamp }]} />
            <Text style={styles.legendText}>已點亮</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: unreachableColor }]} />
            <Text style={styles.legendText}>還沒去過</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: "#fff" },
  unreachable: { width: 9, height: 9, borderRadius: 4.5, borderWidth: 1, backgroundColor: unreachableColor },
  stamp: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#fff", backgroundColor: colors.stamp },
  visitedRing: { borderColor: colors.stamp, borderWidth: 3 },
  legendVisited: { backgroundColor: "#fff", borderWidth: 2.5, borderColor: colors.stamp },
  origin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 4,
    borderColor: colors.accent,
    backgroundColor: "#fff",
  },
  legend: {
    position: "absolute",
    left: 10,
    bottom: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    gap: 3,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.ink },
});
