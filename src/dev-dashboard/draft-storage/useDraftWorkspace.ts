import { useEffect, useRef, useState } from 'react';
import type { ConflictDecisions, PublishedContentPayload } from '@bemtevi/content-core';
import type { DraftRepository } from '../drafts/draftRepository';
import { createDraftPolling, type SaveTimers } from '../drafts/draftPolling';
import { createSaveCoordinator } from '../drafts/saveCoordinator';
import { initialSaveState, type SaveCoordinator, type SaveState } from '../drafts/saveTransitions';
import { createLocalDraftCache, getTabId } from './localDraftCache';

/**
 * Canonical V2 workspace hook (LEGACY-01): local-persistence
 * The old browser-store dependencies are removed.
 * Owns ONE save coordinator per authenticated principal and disposes it on
 * unmount/logout/principal change (late callbacks ignored); keeps an
 * in-memory undo history of at most 20 candidates (undo never decrements the
 * server generation). The repository transport is registered via
 * `configureCanonicalWorkspaceServices` (editorialNeonServices); without it
 * the hook stays inert in `loading`. Services override: deterministic tests.
 */

export interface CanonicalWorkspaceServices {
  repository: DraftRepository;
  cache?: ReturnType<typeof createLocalDraftCache>;
  now?: () => number;
  timers?: SaveTimers;
  isOnline?: () => boolean;
  tabId?: () => string;
}

let configuredServices: CanonicalWorkspaceServices | null = null;

/** Composition point used by INTEGRATION-01 (editorialNeonServices). */
export function configureCanonicalWorkspaceServices(services: CanonicalWorkspaceServices | null): void {
  configuredServices = services;
}

export interface CanonicalDraftWorkspace {
  state: SaveState;
  edit(candidate: PublishedContentPayload): void;
  flush(): Promise<boolean>;
  refresh(): Promise<void>;
  resolve(decisions: ConflictDecisions): Promise<void>;
  retry(): Promise<void>;
  discardLocal(): Promise<void>;
  /** Restores the previous in-memory candidate; the base generation never moves backwards. */
  undo(): void;
}

// Legacy temporary alias (DASHBOARD-03); prefer the final export below.
export const useCanonicalDraftWorkspace = useDraftWorkspace;

export function useDraftWorkspace(principalId: string, override?: CanonicalWorkspaceServices): CanonicalDraftWorkspace {
  const [state, setState] = useState<SaveState>(initialSaveState);
  const servicesRef = useRef<CanonicalWorkspaceServices | null>(null);
  const stateRef = useRef(state);
  const session = useRef<{
    coordinator: SaveCoordinator;
    editWithHistory(candidate: PublishedContentPayload): void;
    undo(): void;
  } | null>(null);
  useEffect(() => {
    servicesRef.current = override ?? configuredServices;
  });
  useEffect(() => {
    const services = servicesRef.current;
    if (!services) return; // unconfigured: stays inert in `loading`
    const timers = services.timers ?? window;
    const coordinator = createSaveCoordinator({
      repository: services.repository,
      cache: services.cache ?? createLocalDraftCache(),
      now: services.now ?? (() => Date.now()),
      timers,
      onChange: (next) => {
        stateRef.current = next;
        setState(next);
      },
      isOnline: services.isOnline ?? (() => navigator.onLine),
      tabId: services.tabId ?? getTabId,
    });
    const polling = createDraftPolling({
      timers,
      isVisible: () => document.visibilityState === 'visible',
      onPoll: () => coordinator.refresh(),
    });
    const undoStack: PublishedContentPayload[] = [];
    session.current = {
      coordinator,
      editWithHistory(candidate) {
        const previous = stateRef.current.local;
        if (previous !== null) {
          undoStack.push(previous);
          if (undoStack.length > 20) undoStack.shift();
        }
        coordinator.edit(candidate);
      },
      undo() {
        const previous = undoStack.pop();
        if (previous !== undefined) coordinator.edit(previous);
      },
    };
    const onVisibility = () => polling.setVisibility(document.visibilityState === 'visible');
    // Focus/online: immediate head check, then save the reconciled local when safe.
    const wake = () => {
      polling.poke();
      if (stateRef.current.phase === 'dirty') void coordinator.flush();
    };
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', onVisibility);
    onVisibility();
    void coordinator.load(principalId);
    return () => {
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', onVisibility);
      polling.dispose();
      coordinator.dispose();
      session.current = null;
    };
  }, [principalId]);
  return {
    state,
    edit: (candidate) => session.current?.editWithHistory(candidate),
    flush: () => session.current?.coordinator.flush() ?? Promise.resolve(false),
    refresh: () => session.current?.coordinator.refresh() ?? Promise.resolve(),
    resolve: (decisions) => session.current?.coordinator.resolve(decisions) ?? Promise.resolve(),
    retry: () => session.current?.coordinator.retry() ?? Promise.resolve(),
    discardLocal: () => session.current?.coordinator.discardLocal() ?? Promise.resolve(),
    undo: () => session.current?.undo(),
  };
}
