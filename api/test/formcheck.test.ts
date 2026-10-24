import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { AppType } from '@prisma/client';
import { computeFeatures, type FormValues } from '../src/formcheck/features.js';
import { ruleHits } from '../src/formcheck/rules.js';
import { sharedDir } from '../src/config/index.js';

describe('form check rules (Node)', () => {
  it('match the expected rule hits in shared/formcheck-samples.json (parity with Python)', () => {
    const samples = JSON.parse(fs.readFileSync(path.join(sharedDir(), 'formcheck-samples.json'), 'utf8')) as {
      type: AppType;
      values: FormValues;
      today: string;
      expectedRuleHits: string[];
    }[];
    expect(samples).toHaveLength(50);
    for (const s of samples) expect(ruleHits(computeFeatures(s.type, s.values, s.today))).toEqual(s.expectedRuleHits);
    const all = new Set(samples.flatMap((s) => s.expectedRuleHits));
    for (const id of ['R1', 'R2', 'R3', 'R4', 'R5']) expect(all.has(id), id).toBe(true);
  });
});
