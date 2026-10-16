// خط الفحص الحتمي: لا يستدعي أي نموذج لغوي في أي قرار (NFR-06)
import type { GatewaySettings, Redaction, RedactionType } from "../types";
import { ATTACK_CORPUS, INJECTION_SIGNATURES, PII_PATTERNS, REDACTION_TOKEN, SECRET_PATTERNS, type DlpPattern } from "./signatures";

// ---------------- أدوات مساعدة ----------------

/** إنتروبيا شانون بالبت لكل حرف (FR-13) */
export function shannonEntropy(s: string): number {
  if (!s) return 0;
  const freq = new Map<string, number>();
  for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of freq.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

/** كل النصوص داخل المعاملات مع مسار كل منها */
export function collectStrings(value: unknown, path = ""): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path: path || "value", text: value }];
  if (Array.isArray(value)) return value.flatMap((v, i) => collectStrings(v, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => collectStrings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

function mapStrings(value: unknown, fn: (text: string, path: string) => string, path = ""): unknown {
  if (typeof value === "string") return fn(value, path || "value");
  if (Array.isArray(value)) return value.map((v, i) => mapStrings(v, fn, `${path}[${i}]`));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, mapStrings(v, fn, path ? `${path}.${k}` : k)]));
  }
  return value;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function cosine(a: string[], b: string[]): number {
  const va = new Map<string, number>();
  const vb = new Map<string, number>();
  a.forEach((w) => va.set(w, (va.get(w) ?? 0) + 1));
  b.forEach((w) => vb.set(w, (vb.get(w) ?? 0) + 1));
  let dot = 0;
  for (const [w, n] of va) dot += n * (vb.get(w) ?? 0);
  const norm = (v: Map<string, number>) => Math.sqrt([...v.values()].reduce((s, n) => s + n * n, 0));
  const d = norm(va) * norm(vb);
  return d ? dot / d : 0;
}

/**
 * تشابه دلالي محلي: نافذة منزلقة من الكلمات تُقارن بعينات الهجمات المعروفة.
 * في الخادم يُستبدل بنموذج تضمين محلي (Sentence-Transformers) بنفس الواجهة.
 */
export function semanticSimilarity(text: string): { score: number; sample: string | null } {
  const words = tokenize(text);
  let best = 0;
  let sample: string | null = null;
  for (const phrase of ATTACK_CORPUS) {
    const p = tokenize(phrase);
    const size = Math.min(words.length, p.length + 3);
    for (let i = 0; i + size <= words.length || i === 0; i++) {
      const s = cosine(words.slice(i, i + size), p);
      if (s > best) {
        best = s;
        sample = phrase;
      }
      if (i + size >= words.length) break;
    }
  }
  return { score: Math.round(best * 100) / 100, sample };
}

/** فك ترميز Base64 للمقاطع المخفية ثم فحصها */
function decodeHidden(text: string): string[] {
  const out: string[] = [];
  for (const m of text.match(/[A-Za-z0-9+/]{24,}={0,2}/g) ?? []) {
    try {
      const decoded = atob(m);
      if (/^[\x20-\x7E\s]+$/.test(decoded)) out.push(decoded);
    } catch {
      // ليس Base64 صالحاً
    }
  }
  return out;
}

// ---------------- كشف حقن الأوامر ----------------

export interface InjectionResult {
  score: number;
  signature_score: number;
  semantic_score: number;
  matched: string[];
  semantic_sample: string | null;
  decoded: boolean;
  flagged: boolean;
}

export function scanInjection(args: unknown, settings: Pick<GatewaySettings, "similarity_threshold" | "modules">): InjectionResult {
  const texts = collectStrings(args).map((s) => s.text);
  const hidden = texts.flatMap(decodeHidden);
  const all = [...texts, ...hidden];
  const matched = new Set<string>();
  let semantic = 0;
  let sample: string | null = null;

  for (const text of all) {
    if (settings.modules.injection_signatures) {
      for (const sig of INJECTION_SIGNATURES) if (sig.pattern.test(text)) matched.add(sig.id);
    }
    if (settings.modules.injection_semantic) {
      const r = semanticSimilarity(text);
      if (r.score > semantic) {
        semantic = r.score;
        sample = r.sample;
      }
    }
  }

  const signatureScore = matched.size ? Math.min(0.97, 0.78 + 0.07 * (matched.size - 1)) : 0;
  // دمج الإشارتين في درجة واحدة موحدة (FR-11)
  const score = Math.round((1 - (1 - signatureScore) * (1 - semantic)) * 100) / 100;
  return {
    score,
    signature_score: signatureScore,
    semantic_score: semantic,
    matched: [...matched],
    semantic_sample: sample,
    decoded: hidden.length > 0,
    flagged: matched.size > 0 || semantic >= settings.similarity_threshold,
  };
}

// ---------------- منع تسريب البيانات ----------------

export interface DlpResult {
  sanitized: Record<string, unknown>;
  redactions: Redaction[];
  /** 0 لا شيء، 0.5 بيانات شخصية، 0.9 مفاتيح سرية */
  severity: number;
}

function applyPatterns(text: string, patterns: DlpPattern[], path: string, out: Redaction[]): string {
  let result = text;
  for (const p of patterns) {
    result = result.replace(p.pattern, (m) => {
      if (p.validate && !p.validate(m)) return m;
      out.push({ field: path, type: p.type, token: REDACTION_TOKEN[p.type] });
      return REDACTION_TOKEN[p.type];
    });
  }
  return result;
}

export function scanDlp(args: Record<string, unknown>, settings: Pick<GatewaySettings, "entropy_threshold" | "modules">): DlpResult {
  const redactions: Redaction[] = [];
  const sanitized = mapStrings(args, (text, path) => {
    let t = text;
    if (settings.modules.dlp_secrets) t = applyPatterns(t, SECRET_PATTERNS, path, redactions);
    if (settings.modules.dlp_pii) t = applyPatterns(t, PII_PATTERNS, path, redactions);
    if (settings.modules.dlp_entropy) {
      t = t.replace(/[A-Za-z0-9+/=_-]{20,}/g, (m) => {
        if (m.startsWith("REDACTED_") || shannonEntropy(m) < settings.entropy_threshold) return m;
        redactions.push({ field: path, type: "HIGH_ENTROPY", token: REDACTION_TOKEN.HIGH_ENTROPY });
        return REDACTION_TOKEN.HIGH_ENTROPY;
      });
    }
    return t;
  }) as Record<string, unknown>;

  const types = new Set<RedactionType>(redactions.map((r) => r.type));
  const severity = types.has("SECRET") || types.has("HIGH_ENTROPY") ? 0.9 : types.size ? 0.5 : 0;
  return { sanitized, redactions, severity };
}
