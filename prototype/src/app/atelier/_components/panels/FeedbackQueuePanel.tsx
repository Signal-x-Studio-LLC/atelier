// Feedback queue — pending triage drafts awaiting human classification
// (M6 / ADR-018 / migration 9 / ARCH §6.5.2).
//
// Reads from viewModel.feedbackQueue (loaded by lens-data.ts via
// AtelierClient.triagePendingList). Approve/reject affordances use the
// server actions in triage-actions.ts.
//
// Routing per ADR-025: a draft's approval surface is gated by the
// territory's review_role (or owner_role when null). Drafts NOT routed
// to the viewer's discipline render read-only with a "routed to <role>"
// hint. The substrate enforces this at the action level (cross-project
// approver -> FORBIDDEN); the UI hint exists for ergonomics, not
// security.
//
// ADR-060 PR C: migrated to design-package primitives.

'use client';

import { useState, useTransition } from 'react';

import type { FeedbackEntry } from '../../../../lib/atelier/lens-data.ts';
import { Button, Field, Mono, Panel } from '../../../../lib/atelier/design';
import {
  approveTriageDraft,
  rejectTriageDraft,
  type TriageActionResult,
} from './triage-actions.ts';
import {
  Affordance,
  PanelEmpty,
  PanelHeader,
  PanelList,
  PanelRow,
  RowHead,
  RowSub,
  RowTitle,
  StatePill,
  Tags,
} from './panel-ui.tsx';

export default function FeedbackQueuePanel({
  entries,
  viewerDiscipline,
}: {
  entries: FeedbackEntry[];
  viewerDiscipline: string | null;
}) {
  return (
    <Panel tone="paper" className="col-[1/-1] flex min-w-0 flex-col gap-3 p-4">
      <PanelHeader title="Feedback queue" count={entries.length} />
      {entries.length === 0 ? (
        <PanelEmpty>
          No pending triage drafts. New external comments (Figma, GitHub PR
          discussions, etc.) below the classifier confidence threshold land
          here for human classification per ADR-018.
        </PanelEmpty>
      ) : (
        <PanelList>
          {entries.map((entry) => (
            <FeedbackRow
              key={entry.id}
              entry={entry}
              viewerDiscipline={viewerDiscipline}
            />
          ))}
        </PanelList>
      )}
      <Affordance>
        Triage <em>never</em> auto-merges per ADR-018; every external comment
        becomes a contribution awaiting human approval. Approve to create a
        contribution from the drafted proposal; reject to dismiss with an
        optional reason.
      </Affordance>
    </Panel>
  );
}

function FeedbackRow({
  entry,
  viewerDiscipline,
}: {
  entry: FeedbackEntry;
  viewerDiscipline: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<TriageActionResult | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectReason, setShowRejectReason] = useState(false);

  const handleApprove = (): void => {
    startTransition(async () => {
      const r = await approveTriageDraft(entry.id);
      setResult(r);
    });
  };

  const handleReject = (): void => {
    startTransition(async () => {
      const r = await rejectTriageDraft(entry.id, rejectReason);
      setResult(r);
    });
  };

  const decided = result?.ok === true;
  const errored = result !== null && result.ok === false;

  return (
    <PanelRow>
      <RowHead>
        <RowTitle>
          {entry.source} · {entry.externalAuthor} · {entry.externalCommentId}
        </RowTitle>
        <StatePill tone="review">{entry.category}</StatePill>
      </RowHead>
      <RowSub>
        {entry.territoryName ?? entry.territoryId} · review_role:{' '}
        {entry.reviewRole ?? '<inherits owner_role>'} · confidence:{' '}
        {entry.confidence.toFixed(2)} · classifier signals:{' '}
        {entry.signals.length > 0 ? entry.signals.join(', ') : 'none'}
      </RowSub>
      <details className="text-[12px] text-ink-muted">
        <summary className="cursor-pointer text-ink-subtle">
          Drafted proposal ({entry.discipline})
        </summary>
        <Mono as="pre" className="my-2 whitespace-pre-wrap text-[12px] text-ink-muted">
          {entry.bodyMarkdown}
        </Mono>
        <p className="m-0">
          <strong className="text-ink">Suggested action:</strong> {entry.suggestedAction}
        </p>
      </details>
      <blockquote className="m-0 my-2 border-l-[3px] border-rule px-3 py-2 text-[13px] text-ink-muted">
        {entry.commentText}
      </blockquote>
      {decided && result?.contributionId !== undefined ? (
        <Affordance>
          Approved. Contribution id: <Mono>{result.contributionId}</Mono>
        </Affordance>
      ) : decided ? (
        <Affordance>Rejected.</Affordance>
      ) : errored ? (
        <Affordance>
          Error {result?.error?.code}: {result?.error?.message}
        </Affordance>
      ) : entry.routedToViewer ? (
        <div className="flex flex-wrap items-center gap-2">
          {!showRejectReason ? (
            <>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={isPending}
                onClick={handleApprove}
              >
                Approve (creates contribution)
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isPending}
                onClick={() => setShowRejectReason(true)}
              >
                Reject…
              </Button>
            </>
          ) : (
            <>
              <Field
                name={`reject-reason-${entry.id}`}
                placeholder="Optional rejection reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-[60%]"
              />
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={isPending}
                onClick={handleReject}
              >
                Confirm reject
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  setShowRejectReason(false);
                  setRejectReason('');
                }}
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      ) : (
        <Affordance>
          Routed to <strong className="text-ink">{entry.reviewRole ?? '<owner_role>'}</strong>{' '}
          (your discipline: {viewerDiscipline ?? '<none>'}). Read-only here.
        </Affordance>
      )}
    </PanelRow>
  );
}
