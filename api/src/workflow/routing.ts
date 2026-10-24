import type { AppType, Category, Stage } from '@prisma/client';
import { rules } from '../config/index.js';

/** Resolve the route at submission (conditions applied). It is stored on the application and never changes. */
export function resolveRoute(type: AppType, formData: Record<string, unknown>): Stage[] {
  return rules.types[type].route
    .filter((step) => {
      if (!step.when) return true;
      const v = Number(formData[step.when.field]);
      if (!Number.isFinite(v)) return false;
      switch (step.when.op) {
        case 'gt':
          return v > step.when.value;
        case 'gte':
          return v >= step.when.value;
        case 'lt':
          return v < step.when.value;
        case 'lte':
          return v <= step.when.value;
        case 'eq':
          return v === step.when.value;
      }
    })
    .map((s) => s.stage as Stage);
}

export function nextStage(route: Stage[], current: Stage): Stage | null {
  const i = route.indexOf(current);
  return i >= 0 && i + 1 < route.length ? route[i + 1]! : null;
}

export function categoryOf(type: AppType): { category: Category; categoryRank: number; categoryWeight: number } {
  const category = rules.types[type].category as Category;
  const c = rules.categories[category];
  return { category, categoryRank: c.categoryRank, categoryWeight: c.categoryWeight };
}

export const STAGE_LABEL: Record<Stage, string> = {
  SCRUTINY: 'Scrutiny',
  EVC: 'EVC',
  SAC_SHC: 'SAC/SHC',
  DECISION: 'Decision',
};
