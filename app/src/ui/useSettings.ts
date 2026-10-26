// 出發站與偏好設定，存在 AsyncStorage，下次開啟自動帶入（規格書 F1）

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export type Settings = {
  homeStationId: string;
  startTime: number; // 分鐘
  endTime: number;
  unreservedOnly: boolean;
};

const KEY = "settings.v1";

export const defaultSettings: Settings = {
  homeStationId: "1100", // 中壢
  startTime: 9 * 60,
  endTime: 18 * 60,
  unreservedOnly: false,
};

export function useSettings(): [Settings, (patch: Partial<Settings>) => void, boolean] {
  const [settings, setSettings] = useState(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setSettings({ ...defaultSettings, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const update = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  return [settings, update, loaded];
}
