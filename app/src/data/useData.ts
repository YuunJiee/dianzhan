import { useCallback, useEffect, useState } from "react";

import type { Timetable } from "../csa/types.ts";
import { type Catalog, loadCatalog, loadTimetable } from "./index.ts";

type Loadable<T> = { value?: T; error?: string; loading: boolean };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useCatalog(): Loadable<Catalog> & { retry: () => void } {
  const [state, setState] = useState<Loadable<Catalog>>({ loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    loadCatalog()
      .then((value) => alive && setState({ value, loading: false }))
      .catch((e) => alive && setState({ error: message(e), loading: false }));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

/** 切換日期時保留上一份時刻表，直到新的讀好，畫面才不會閃一下空白。 */
export function useTimetable(catalog: Catalog | undefined, date: string | undefined): Loadable<Timetable> {
  const [state, setState] = useState<Loadable<Timetable>>({ loading: true });

  useEffect(() => {
    if (!catalog || !date) return;
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    loadTimetable(catalog.index, date)
      .then((value) => alive && setState({ value, loading: false }))
      .catch((e) => alive && setState((s) => ({ ...s, error: message(e), loading: false })));
    return () => {
      alive = false;
    };
  }, [catalog, date]);

  return state;
}
