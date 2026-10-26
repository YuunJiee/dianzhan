import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { Station } from "../csa/types.ts";
import { colors } from "./theme.ts";

type Props = {
  visible: boolean;
  title: string;
  stations: Station[];
  onSelect: (station: Station) => void;
  onClose: () => void;
};

export function StationPicker({ visible, title, stations, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().replace(/台/g, "臺");
    return q ? stations.filter((s) => s.name.includes(q)) : stations;
  }, [query, stations]);

  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={close} hitSlop={12}>
            <Text style={styles.close}>關閉</Text>
          </Pressable>
        </View>
        <TextInput
          style={styles.search}
          placeholder="搜尋車站，例如：福隆"
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => {
                setQuery("");
                onSelect(item);
              }}
            >
              <Text style={styles.name}>{item.name}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>找不到「{query}」</Text>}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingTop: 48 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  title: { fontSize: 20, fontWeight: "700", color: colors.ink },
  close: { fontSize: 16, color: colors.accent },
  search: {
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.background,
    fontSize: 16,
  },
  row: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  pressed: { backgroundColor: colors.accentSoft },
  name: { fontSize: 17, color: colors.ink },
  empty: { padding: 20, color: colors.muted },
});
