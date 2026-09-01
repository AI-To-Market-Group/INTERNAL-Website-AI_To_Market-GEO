/**
 * Log of API calls for verification (section, path, status, duration, error).
 * Listeners allow the UI to update on each new entry.
 */

export interface ApiLogEntry {
  id: string;
  ts: string; // ISO
  section: "opportunities" | "tendances" | "gap" | "from-keywords" | "article-sections" | "api";
  label: string;
  method: string;
  path: string;
  status?: number;
  durationMs?: number;
  error?: string;
}

const MAX_LOGS = 100;
const logs: ApiLogEntry[] = [];
const listeners = new Set<() => void>();

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `log-${idCounter}-${Date.now()}`;
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function addLog(entry: Omit<ApiLogEntry, "id" | "ts">): void {
  const full: ApiLogEntry = {
    ...entry,
    id: nextId(),
    ts: new Date().toISOString(),
  };
  logs.unshift(full);
  if (logs.length > MAX_LOGS) logs.pop();
  notify();
}

export function getLogs(): ApiLogEntry[] {
  return [...logs];
}

export function clearLogs(): void {
  logs.length = 0;
  notify();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
