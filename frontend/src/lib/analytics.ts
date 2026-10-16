import type { RequestStatus, ThreatCategory, ToolCallRequest } from "./types";

export type WindowKey = "15m" | "1h" | "24h";
export const WINDOW_MS: Record<WindowKey, number> = { "15m": 15 * 60_000, "1h": 3_600_000, "24h": 86_400_000 };

export const THREATS: ThreatCategory[] = ["DIRECT_INJECTION", "INDIRECT_INJECTION", "DATA_EXFILTRATION", "EXCESSIVE_AGENCY"];

const STOPPED: RequestStatus[] = ["BLOCKED", "HITL_REJECTED", "HITL_TIMED_OUT", "KILL_SWITCH_BLOCKED", "AUTH_FAILED", "INVALID_REQUEST"];

export const isStopped = (r: ToolCallRequest) => STOPPED.includes(r.status);
export const isThreat = (r: ToolCallRequest) => r.threat_category !== null;
export const isMasked = (r: ToolCallRequest) => r.dlp_redactions.length > 0 || r.outbound_redactions > 0;
export const isExecuted = (r: ToolCallRequest) => r.status === "ALLOWED" || r.status === "HITL_APPROVED";

export function inWindow(requests: ToolCallRequest[], now: number, ms: number) {
  return requests.filter((r) => r.received_at >= now - ms);
}

export function buckets(requests: ToolCallRequest[], now: number, ms: number, n: number) {
  const size = ms / n;
  const calls = new Array(n).fill(0);
  const threats = new Array(n).fill(0);
  const start = now - ms;
  for (const r of requests) {
    if (r.received_at < start) continue;
    const i = Math.min(n - 1, Math.floor((r.received_at - start) / size));
    calls[i]++;
    if (isThreat(r)) threats[i]++;
  }
  return { calls, threats, start, size };
}

export function percentileOf(values: number[], p: number): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

export function countBy<T, K extends string>(items: T[], key: (t: T) => K | null): Map<K, number> {
  const m = new Map<K, number>();
  for (const it of items) {
    const k = key(it);
    if (k !== null) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
