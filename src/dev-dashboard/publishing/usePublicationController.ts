import { useRef, useState } from 'react';
import { useAdminAuth } from '../../app/auth/AdminAuthContext';
import { usePublishedContent } from '../../app/content/PublishedContentContext';
import {
  getPublishedPayloadSize,
  MAX_PUBLISHED_PAYLOAD_BYTES,
  validatePublicationPayload,
  type PublishedContentPayload,
  type PublishedContentSnapshot,
} from '../../app/content/publishedContent';
import { PublishedContentRepositoryError } from '../../app/content/publishedContentRepository';
import { validateDashboardContacts } from '../contacts/contactsValidation';
import { validateDashboardEducation } from '../education/educationValidation';
import { validateDashboardFlows } from '../flows/flowValidation';
import type { useDraftWorkspace } from '../draft-storage/useDraftWorkspace';
import type { ReconciliationSession } from '../draft-storage/workspace';
import { compareContent, contentIdentity, reconcileContent, type ValueSlot } from './semanticDiff';

export type WorkspaceStore = ReturnType<typeof useDraftWorkspace>;
type Phase = 'editing' | 'comparing' | 'resolving' | 'ready' | 'publishing' | 'uncertain' | 'success' | 'error';

export function validateCandidate(payload: PublishedContentPayload) {
  try {
    if (getPublishedPayloadSize(payload) > MAX_PUBLISHED_PAYLOAD_BYTES) return false;
    validatePublicationPayload(payload);
    return [
      validateDashboardContacts(payload.contacts, payload.locations),
      validateDashboardEducation(payload.educationMaterials, payload.educationGroups),
      validateDashboardFlows(
        payload.flows,
        payload.educationMaterials.map((r) => r.id),
      ),
    ].every((result) => result.errors.length === 0);
  } catch {
    return false;
  }
}

export function usePublicationController({
  base,
  local,
  expectedRevision,
  store,
  onPublished,
}: {
  base: PublishedContentPayload;
  local: PublishedContentPayload;
  expectedRevision: number | null;
  store?: WorkspaceStore;
  onPublished(snapshot: PublishedContentSnapshot): void;
}) {
  const { account } = useAdminAuth();
  const { snapshot, publish, refreshLatest, refresh } = usePublishedContent();
  const [phase, setPhase] = useState<Phase>('editing');
  const [message, setMessage] = useState<string | null>(null);
  const [fallback, setFallback] = useState<ReconciliationSession>();
  const lock = useRef(false);
  const session = store?.workspace?.reconciliation ?? fallback;
  const merge = session
    ? reconcileContent(session.base, session.local, session.remote.payload, session.decisions)
    : null;
  const candidate =
    merge?.ok && merge.value.kind === 'complete' ? (session?.candidateOverride ?? merge.value.candidate) : null;
  const diff = candidate && session ? compareContent(session.remote.payload, candidate) : null;
  const candidateValid = candidate !== null && validateCandidate(candidate);
  const canConfirm =
    !!account &&
    !!session?.reviewed &&
    candidateValid &&
    diff?.ok === true &&
    diff.value.length > 0 &&
    (!store || store.status === 'saved') &&
    !store?.workspace?.publicationAttempt &&
    phase !== 'publishing' &&
    phase !== 'comparing' &&
    phase !== 'uncertain';

  async function saveSession(next: ReconciliationSession) {
    if (store) return store.persist((w) => ({ ...w, reconciliation: next }));
    setFallback(next);
    return true;
  }
  async function latest() {
    if (refreshLatest) return refreshLatest();
    await refresh();
    return snapshot;
  }
  function busy(value: boolean) {
    lock.current = value;
    store?.setBusy(value);
  }

  async function prepare() {
    if (lock.current || store?.workspace?.publicationAttempt) return;
    busy(true);
    setPhase('comparing');
    setMessage(null);
    try {
      if (store && !(await store.checkpoint())) throw new Error('checkpoint');
      const remote = await latest();
      if (!remote && expectedRevision !== null) throw new Error('remote');
      const next: ReconciliationSession = {
        base: candidate && session ? session.remote.payload : (session?.base ?? base),
        local: candidate ?? session?.local ?? local,
        remote: { revision: remote?.revision ?? null, payload: remote?.payload ?? base },
        localGeneration: store?.current.current?.generation ?? 0,
        decisions: candidate ? {} : (session?.decisions ?? {}),
        reviewed: false,
      };
      const result = reconcileContent(next.base, next.local, next.remote.payload, next.decisions);
      if (!result.ok) throw new Error('diff');
      if (!(await saveSession(next))) throw new Error('checkpoint');
      setPhase(result.value.kind === 'complete' ? 'ready' : 'resolving');
    } catch {
      setPhase('error');
      setMessage(
        'Não foi possível comparar as alterações. Seu rascunho não foi descartado. Tente comparar novamente ou baixe uma cópia.',
      );
    } finally {
      busy(false);
    }
  }

  async function decide(id: string, choice?: ValueSlot) {
    if (!session || lock.current) return;
    const decisions = { ...session.decisions };
    if (choice) decisions[id] = choice;
    else delete decisions[id];
    await saveSession({ ...session, decisions, candidateOverride: undefined, reviewed: false });
  }
  async function editCandidate(payload: PublishedContentPayload) {
    if (!session || lock.current) return;
    await saveSession({ ...session, candidateOverride: payload, reviewed: false });
  }
  async function review() {
    if (!session || !candidateValid || !diff?.ok || lock.current) return;
    await saveSession({ ...session, reviewed: true });
  }

  async function reconcileNewRemote(remote: PublishedContentSnapshot, sent: PublishedContentPayload) {
    if (!session) return;
    const next: ReconciliationSession = {
      base: session.remote.payload,
      local: sent,
      remote: { revision: remote.revision, payload: remote.payload },
      localGeneration: store?.current.current?.generation ?? 0,
      decisions: {},
      reviewed: false,
    };
    if (store) await store.persist((w) => ({ ...w, publicationAttempt: undefined, reconciliation: next }));
    else setFallback(next);
    setPhase('resolving');
    setMessage(
      'Há uma nova publicação. As escolhas anteriores foram preservadas no resultado local. Revise este novo conjunto antes de publicar.',
    );
  }

  async function confirm() {
    if (lock.current || !canConfirm || !session || !candidate || !account) return;
    busy(true);
    setPhase('publishing');
    setMessage(null);
    let sentWorkspace = store?.current.current;
    try {
      // The attempted payload is durable before any network write.
      if (store) {
        if (
          !(await store.persist((w) => ({
            ...w,
            publicationAttempt: {
              id: crypto.randomUUID(),
              candidate,
              expectedRevision: session.remote.revision,
              generation: w.generation + 1,
            },
          })))
        )
          throw new Error('checkpoint');
        sentWorkspace = store.current.current;
      }
      const next = await publish(candidate, account.id, session.remote.revision);
      setPhase('success');
      if (store && sentWorkspace && !(await store.archive(sentWorkspace)))
        setMessage(
          'O conteúdo foi publicado, mas não foi possível arquivar esta geração. A cópia local foi preservada.',
        );
      onPublished(next);
    } catch (error) {
      if (error instanceof PublishedContentRepositoryError && error.code === 'conflict') {
        const remote = await latest().catch(() => null);
        if (remote) await reconcileNewRemote(remote, candidate);
        else {
          setPhase('uncertain');
          setMessage('Não foi possível carregar a nova publicação. A tentativa e o rascunho foram preservados.');
        }
      } else {
        setPhase('uncertain');
        setMessage(
          'Não foi possível confirmar o resultado do envio. Consulte a publicação antes de tentar novamente. O rascunho e a tentativa foram preservados.',
        );
      }
    } finally {
      busy(false);
    }
  }

  async function checkOutcome() {
    const attempt = store?.workspace?.publicationAttempt;
    if (lock.current || !attempt) return;
    busy(true);
    try {
      const remote = await latest();
      if (!remote) throw new Error('remote');
      if (contentIdentity(remote.payload) === contentIdentity(attempt.candidate)) {
        setMessage('Este conteúdo está publicado. A igualdade não confirma a autoria da tentativa.');
        setPhase('success');
        await store!.archive(store!.current.current ?? undefined);
        onPublished(remote);
      } else await reconcileNewRemote(remote, attempt.candidate);
    } catch {
      setMessage('Não foi possível consultar a publicação. A tentativa permanece preservada.');
    } finally {
      busy(false);
    }
  }
  return {
    phase,
    message,
    session,
    merge,
    candidate,
    diff,
    candidateValid,
    canConfirm,
    prepare,
    decide,
    editCandidate,
    review,
    confirm,
    checkOutcome,
    uncertain: !!store?.workspace?.publicationAttempt,
  };
}
