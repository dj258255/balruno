/**
 * Global custom event listeners for modal opens (WelcomeScreen / Sidebar 등에서 dispatch).
 * page.tsx 의 god component 분해 (Track D-1).
 */

import { useEffect } from 'react';

export function useGlobalEvents(handlers: {
  onOpenImport?: () => void;
  onOpenExport?: () => void;
  onOpenAISetup?: () => void;
  onOpenShare?: () => void;
  onOpenShortcuts?: () => void;
  onOpenGallery?: () => void;
  onOpenSettings?: () => void;
  onOpenAICopilot?: () => void;
  onSetView?: (view: string) => void;
}): void {
  useEffect(() => {
    if (!handlers.onOpenSettings) return;
    const h = handlers.onOpenSettings;
    window.addEventListener('balruno:open-settings', h);
    return () => window.removeEventListener('balruno:open-settings', h);
  }, [handlers.onOpenSettings]);

  useEffect(() => {
    if (!handlers.onOpenAICopilot) return;
    const h = handlers.onOpenAICopilot;
    window.addEventListener('balruno:open-ai-copilot', h);
    return () => window.removeEventListener('balruno:open-ai-copilot', h);
  }, [handlers.onOpenAICopilot]);

  useEffect(() => {
    if (!handlers.onOpenImport) return;
    const h = handlers.onOpenImport;
    window.addEventListener('balruno:open-import-modal', h);
    return () => window.removeEventListener('balruno:open-import-modal', h);
  }, [handlers.onOpenImport]);

  useEffect(() => {
    if (!handlers.onOpenExport) return;
    const h = handlers.onOpenExport;
    window.addEventListener('balruno:open-export-modal', h);
    return () => window.removeEventListener('balruno:open-export-modal', h);
  }, [handlers.onOpenExport]);

  useEffect(() => {
    if (!handlers.onOpenAISetup) return;
    const h = handlers.onOpenAISetup;
    window.addEventListener('balruno:open-ai-setup', h);
    return () => window.removeEventListener('balruno:open-ai-setup', h);
  }, [handlers.onOpenAISetup]);

  useEffect(() => {
    if (!handlers.onOpenShare) return;
    const h = handlers.onOpenShare;
    window.addEventListener('balruno:open-share', h);
    return () => window.removeEventListener('balruno:open-share', h);
  }, [handlers.onOpenShare]);

  useEffect(() => {
    if (!handlers.onOpenShortcuts) return;
    const h = handlers.onOpenShortcuts;
    window.addEventListener('balruno:open-shortcuts', h);
    return () => window.removeEventListener('balruno:open-shortcuts', h);
  }, [handlers.onOpenShortcuts]);

  useEffect(() => {
    if (!handlers.onOpenGallery) return;
    const h = handlers.onOpenGallery;
    window.addEventListener('balruno:open-gallery', h);
    return () => window.removeEventListener('balruno:open-gallery', h);
  }, [handlers.onOpenGallery]);

  useEffect(() => {
    if (!handlers.onSetView) return;
    const cb = handlers.onSetView;
    const h = (e: Event) => {
      const detail = (e as CustomEvent<{ view: string }>).detail;
      if (detail?.view) cb(detail.view);
    };
    window.addEventListener('balruno:set-view', h);
    return () => window.removeEventListener('balruno:set-view', h);
  }, [handlers.onSetView]);
}
