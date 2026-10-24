import type { Directory } from './directory.js';

/** Phase 0: no case history yet (phase 4 builds it by running the real actions with a backdated clock). */
export async function seedHistory(_dir: Directory): Promise<void> {
  return;
}
