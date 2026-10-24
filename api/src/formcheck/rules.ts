// Node evaluation of shared/formcheck-rules.json (fallback when the form check service is down).
import { formcheckRules } from '../config/index.js';
import { FIELD_LABEL, type Features } from './features.js';

export interface Warning {
  source: 'rule' | 'model';
  ruleId?: string;
  field: string;
  value: number | null;
  typical?: number | null;
  z?: number | null;
  message: string;
  severity: 'HIGH' | 'MEDIUM';
}

const round = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

export function evaluateRules(f: Features): Warning[] {
  const out: Warning[] = [];
  for (const r of formcheckRules.rules) {
    const v = f[r.feature];
    if (v === null || v === undefined) continue;
    let hit = false;
    switch (r.op) {
      case 'gt':
        hit = v > r.value!;
        break;
      case 'gte':
        hit = v >= r.value!;
        break;
      case 'lt':
        hit = v < r.value!;
        break;
      case 'lte':
        hit = v <= r.value!;
        break;
      case 'gt_feature': {
        const other = f[r.compare!];
        hit = other !== null && other !== undefined && v > other;
        break;
      }
    }
    // Ratios are shown as percentages.
    const shown = r.feature === 'docs_ratio' ? Math.round(v * 100) : round(v);
    if (hit) out.push({ source: 'rule', ruleId: r.id, field: FIELD_LABEL[r.field] ?? r.field, value: shown, message: r.message, severity: r.severity });
  }
  return out;
}

export function ruleHits(f: Features): string[] {
  return evaluateRules(f).map((w) => w.ruleId!);
}
