import { useEffect } from 'react';
import { en } from '../strings/en';

/** Per-route document title: "Action Center · AICTE Approvals". */
export function useTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${en.app.name}`;
  }, [title]);
}
