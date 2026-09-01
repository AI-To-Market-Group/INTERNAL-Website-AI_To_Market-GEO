"use client";

import { useState, useEffect } from "react";
import { getLogs, clearLogs, subscribe, type ApiLogEntry } from "@/lib/api-log";

export function useApiLog() {
  const [logs, setLogs] = useState<ApiLogEntry[]>(() => getLogs());

  useEffect(() => {
    const unsub = subscribe(() => setLogs(getLogs()));
    return unsub;
  }, []);

  return {
    logs,
    clearLogs: () => {
      clearLogs();
      setLogs([]);
    },
  };
}
