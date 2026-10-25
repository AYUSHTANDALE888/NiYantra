// Mirror of shared/rules.json document lists and type labels for the apply form (the API re-validates).
import type { AppType, DocCfg } from '../api/types';
import rules from '../../../shared/seed/rules.json';

type TypeCfg = { label: string; category: string; requiresPriorApproval: boolean; route: { stage: string; when?: { field: string; op: string; value: number } }[]; documents: DocCfg[] };

export const TYPES = rules.types as unknown as Record<AppType, TypeCfg>;
export const TYPE_ORDER: AppType[] = ['NEW_INSTITUTION', 'EXTENSION', 'NAME_CHANGE', 'INTAKE_INCREASE', 'CHANGE_OF_SITE', 'VERIFICATION_VISIT', 'RESTORATION'];

export function needsSite(type: AppType): boolean {
  return TYPES[type].documents.some((d) => d.kind === 'LAND_LEASE');
}
