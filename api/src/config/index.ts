import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const STAGES = ['SCRUTINY', 'EVC', 'SAC_SHC', 'DECISION'] as const;
const TASKS = ['SCRUTINY', 'RE_SCRUTINY', 'EVC_DESK', 'VERIFY', 'SAC_SHC_FORWARD'] as const;
const TYPES = [
  'NEW_INSTITUTION',
  'EXTENSION',
  'NAME_CHANGE',
  'INTAKE_INCREASE',
  'CHANGE_OF_SITE',
  'VERIFICATION_VISIT',
  'RESTORATION',
] as const;

const docSchema = z.object({
  kind: z.string().min(1),
  label: z.string().min(1),
  critical: z.boolean(),
  hasExpiry: z.boolean(),
});

const routeStepSchema = z.object({
  stage: z.enum(STAGES),
  when: z
    .object({ field: z.string(), op: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']), value: z.number() })
    .optional(),
});

export const rulesSchema = z.object({
  version: z.number().int().positive(),
  note: z.string().optional(),
  categories: z.record(
    z.enum(['NEW', 'EXTENSION', 'EXPANSION']),
    z.object({ categoryWeight: z.number().positive(), categoryRank: z.number().int().min(0) }),
  ),
  types: z.record(
    z.enum(TYPES),
    z.object({
      label: z.string(),
      category: z.enum(['NEW', 'EXTENSION', 'EXPANSION']),
      requiresPriorApproval: z.boolean(),
      route: z.array(routeStepSchema).min(1),
      documents: z.array(docSchema).min(1),
    }),
  ),
  sla: z.object({
    SCRUTINY: z.number().int().positive(),
    SAC_SHC: z.number().int().positive(),
    DECISION: z.number().int().positive(),
    EVC_SCHEDULE: z.number().int().positive(),
    EVC_REPORT: z.number().int().positive(),
    VERIFICATION: z.number().int().positive(),
  }),
  complianceReminderOffsets: z.array(z.number().int().min(0)).min(1),
  atRiskPct: z.number().min(1).max(100),
  stalledWorkingDays: z.number().int().positive(),
  urgentDays: z.number().int().min(0),
  dueSoonDays: z.number().int().positive(),
  escalationThresholds: z.array(z.number().int().positive()).length(3),
});

const eligibilitySchema = z.array(
  z.object({
    tier: z.number().int().min(0),
    role: z.enum(['OFFICER', 'BUREAU']),
    region: z.enum(['HOME', 'ANY']),
    skill: z.string().optional(),
  }),
);

export const policySchema = z.object({
  version: z.number().int().positive(),
  note: z.string().optional(),
  stageWeight: z.record(z.enum(TASKS), z.number().positive()),
  defaultCapacityPoints: z.number().positive(),
  maxUtil: z.number().positive(),
  urgentMaxUtil: z.number().positive(),
  continuityUtilCap: z.number().positive(),
  scoreWeights: z.object({ projectedUtil: z.number(), recent: z.number(), mismatch: z.number() }),
  recentWorkingDays: z.number().int().positive(),
  specialisationLookbackDays: z.number().int().positive(),
  idleBelowTeamAverage: z.number().positive(),
  overloadedAbove: z.number().positive(),
  eligibility: z.record(z.enum(TASKS), eligibilitySchema),
  taskSkill: z.record(z.enum(TASKS), z.string().nullable()),
});

export const formcheckRulesSchema = z.object({
  version: z.number().int().positive(),
  note: z.string().optional(),
  rules: z
    .array(
      z.object({
        id: z.string(),
        feature: z.string(),
        op: z.enum(['gt', 'gte', 'lt', 'lte', 'gt_feature']),
        value: z.number().optional(),
        compare: z.string().optional(),
        field: z.string(),
        severity: z.enum(['HIGH', 'MEDIUM']),
        message: z.string(),
      }),
    )
    .min(1),
});

type RawRules = z.infer<typeof rulesSchema>;
type RawPolicy = z.infer<typeof policySchema>;
type Full<T> = { [K in keyof T]-?: Exclude<T[K], undefined> };
export type Rules = Omit<RawRules, 'types' | 'categories'> & {
  types: Full<RawRules['types']>;
  categories: Full<RawRules['categories']>;
};
export type AssignmentPolicy = Omit<RawPolicy, 'stageWeight' | 'eligibility' | 'taskSkill'> & {
  stageWeight: Full<RawPolicy['stageWeight']>;
  eligibility: Full<RawPolicy['eligibility']>;
  taskSkill: { [K in keyof RawPolicy['taskSkill']]-?: string | null };
};
export type FormcheckRules = z.infer<typeof formcheckRulesSchema>;
export type AppTypeName = (typeof TYPES)[number];
export type StageName = (typeof STAGES)[number];
export type TaskName = (typeof TASKS)[number];

export function sharedDir(): string {
  return process.env.SHARED_DIR ?? path.resolve(process.cwd(), '../shared');
}

function load<T>(file: string, schema: z.ZodType<T>): T {
  const raw = JSON.parse(fs.readFileSync(path.join(sharedDir(), file), 'utf8'));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid ${file}: ${parsed.error.message}`);
  }
  return parsed.data;
}

function requireKeys(file: string, obj: Record<string, unknown>, keys: readonly string[], what: string) {
  const missing = keys.filter((k) => !(k in obj));
  if (missing.length) throw new Error(`Invalid ${file}: ${what} missing ${missing.join(', ')}`);
}

const rawRules = load('rules.json', rulesSchema);
requireKeys('rules.json', rawRules.types, TYPES, 'types');
requireKeys('rules.json', rawRules.categories, ['NEW', 'EXTENSION', 'EXPANSION'], 'categories');
const rawPolicy = load('assignment-policy.json', policySchema);
requireKeys('assignment-policy.json', rawPolicy.stageWeight, TASKS, 'stageWeight');
requireKeys('assignment-policy.json', rawPolicy.eligibility, TASKS, 'eligibility');
requireKeys('assignment-policy.json', rawPolicy.taskSkill, TASKS, 'taskSkill');

export const rules = rawRules as Rules;
export const policy = rawPolicy as AssignmentPolicy;
export const formcheckRules: FormcheckRules = load('formcheck-rules.json', formcheckRulesSchema);

export function typeConfig(type: AppTypeName) {
  return rules.types[type];
}
