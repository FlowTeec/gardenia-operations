"use client";

import { useState, useSyncExternalStore } from "react";

type Snapshot<T> = {
  status: "loading" | "ready" | "error";
  data: T | null;
  error: string | null;
};

const SERVER_SNAPSHOT: Snapshot<unknown> = {
  status: "loading",
  data: null,
  error: null,
};

function getServerSnapshot(): Snapshot<unknown> {
  return SERVER_SNAPSHOT;
}

function createQuery<T>(loader: () => Promise<T>) {
  let snapshot: Snapshot<T> = SERVER_SNAPSHOT as Snapshot<T>;
  const listeners = new Set<() => void>();
  let generation = 0;

  function emit(next: Snapshot<T>) {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  function load() {
    const ticket = ++generation;
    if (snapshot.data) {
      emit({ status: "loading", data: snapshot.data, error: null });
    }
    loader()
      .then((data) => {
        if (ticket !== generation) return;
        emit({ status: "ready", data, error: null });
      })
      .catch((error: unknown) => {
        if (ticket !== generation) return;
        emit({
          status: "error",
          data: snapshot.data,
          error: error instanceof Error ? error.message : "Could not load this page.",
        });
      });
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      load();
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    reload() {
      load();
    },
  };
}

export function useServerData<T>(loader: () => Promise<T>, resetKey = "default") {
  const [entry, setEntry] = useState(() => ({
    resetKey,
    query: createQuery(loader),
  }));
  if (entry.resetKey !== resetKey) {
    setEntry({ resetKey, query: createQuery(loader) });
  }
  const snapshot = useSyncExternalStore(
    entry.query.subscribe,
    entry.query.getSnapshot,
    getServerSnapshot as () => Snapshot<T>,
  );
  return { ...snapshot, reload: entry.query.reload };
}
