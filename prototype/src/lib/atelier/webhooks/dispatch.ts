// Per-event webhook dispatch (v1.x — closes the per-event wiring gap
// PR #78 left open).
//
// The route handlers at prototype/src/app/api/webhooks/{github,figma}/
// route.ts verify HMAC + record idempotency. Once a delivery is first-
// seen, they call into this module to apply per-event business logic:
//
//   GitHub `push` to default branch  -> enqueue embed_state rows
//                                       (ARCH §6.4.2 / §902-905)
//   GitHub `pull_request.closed && merged === true`
//                                    -> mark contribution state=merged
//                                       (ARCH §716 — authoritative)
//   Figma `FILE_COMMENT`             -> insert triage_pending row
//                                       (ARCH §6.5.2 / ADR-019)
//
// Project resolution:
//   GitHub events resolve project by repository.html_url matching
//   projects.repo_url. Multi-project deploys depend on each project
//   carrying a unique repo_url (already a NOT NULL column on projects).
//
//   Figma events do not carry a stable project mapping in the payload.
//   v1.x resolves Figma project + triage routing via env:
//     ATELIER_FIGMA_PROJECT_ID
//     ATELIER_FIGMA_TRIAGE_SESSION_ID
//     ATELIER_FIGMA_TRIAGE_TERRITORY_ID
//   A future increment may add a figma_file_key column to projects
//   for multi-project Figma fan-in.
//
// Returned DispatchOutcome carries a one-line summary string that the
// route handler stamps into webhook_deliveries.outcome so audit reads
// can show what each delivery actually triggered.

import type { Pool, PoolClient } from 'pg';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface DispatchOutcome {
  /** Short human-readable summary suitable for webhook_deliveries.outcome. */
  summary: string;
  /** Optional structured detail for tests + observability. */
  detail?: Record<string, unknown>;
}

export interface PathClassifier {
  /** True when the path matches a corpus folder per ARCH §902-905. */
  matches(path: string): boolean;
}

/**
 * Default path matcher: ADR / BRD / PRD / research files.
 * Mirrors the corpus-extractors walk pattern; a path that matches here
 * is one the embed runner would re-extract on the next pass.
 */
export const defaultCorpusPathClassifier: PathClassifier = {
  matches(path: string): boolean {
    if (!path) return false;
    return (
      path.startsWith('docs/architecture/decisions/') ||
      path === 'docs/functional/BRD.md' ||
      path.startsWith('docs/functional/BRD-') ||
      path === 'docs/functional/PRD.md' ||
      path.startsWith('docs/functional/PRD-') ||
      path.startsWith('docs/research/') ||
      path.startsWith('research/')
    );
  },
};

// ---------------------------------------------------------------------------
// GitHub: push -> embed_state queue
// ---------------------------------------------------------------------------

interface GithubCommit {
  id?: string;
  added?: string[];
  modified?: string[];
  removed?: string[];
}

export interface GithubPushPayload {
  ref?: string;
  after?: string;
  repository?: { html_url?: string; full_name?: string };
  commits?: GithubCommit[];
}

/**
 * Resolve a project_id from a GitHub repository's html_url. Matches
 * projects.repo_url either exactly or with/without a trailing `.git`.
 * Returns null when no project owns this repo (the receiver still
 * returns 200 so the provider does not retry).
 */
export async function resolveProjectByRepoUrl(
  pool: Pool | PoolClient,
  repoUrl: string,
): Promise<{ projectId: string; defaultBranch: string } | null> {
  const trimmed = repoUrl.replace(/\.git$/, '');
  const { rows } = await pool.query<{ id: string; default_branch: string }>(
    `SELECT id, default_branch
       FROM projects
      WHERE repo_url IN ($1, $2)
      LIMIT 1`,
    [trimmed, `${trimmed}.git`],
  );
  const row = rows[0];
  return row ? { projectId: row.id, defaultBranch: row.default_branch } : null;
}

export async function dispatchGithubPush(
  pool: Pool,
  payload: GithubPushPayload,
  classifier: PathClassifier = defaultCorpusPathClassifier,
): Promise<DispatchOutcome> {
  const repoUrl = payload.repository?.html_url;
  const ref = payload.ref ?? '';
  if (!repoUrl) {
    return { summary: 'push: skipped (no repository.html_url)' };
  }

  const project = await resolveProjectByRepoUrl(pool, repoUrl);
  if (!project) {
    return { summary: `push: skipped (no project for ${repoUrl})` };
  }

  const expectedRef = `refs/heads/${project.defaultBranch}`;
  if (ref !== expectedRef) {
    return {
      summary: `push: skipped (ref ${ref} != ${expectedRef})`,
      detail: { ref, defaultBranch: project.defaultBranch },
    };
  }

  // Collect every changed path across all commits. Removed paths still
  // get an enqueue; the runner decides whether to re-embed or remove.
  const touched = new Map<string, string>(); // path -> latest sha
  for (const commit of payload.commits ?? []) {
    const sha = commit.id ?? payload.after ?? null;
    const paths = [
      ...(commit.added ?? []),
      ...(commit.modified ?? []),
      ...(commit.removed ?? []),
    ];
    for (const p of paths) {
      if (classifier.matches(p)) {
        if (sha) touched.set(p, sha);
        else if (!touched.has(p)) touched.set(p, '');
      }
    }
  }

  if (touched.size === 0) {
    return {
      summary: 'push: no corpus paths touched',
      detail: { project_id: project.projectId },
    };
  }

  let enqueued = 0;
  for (const [path, sha] of touched) {
    await pool.query(
      `INSERT INTO embed_state (project_id, artifact_path, observed_commit_sha, status, requested_at)
       VALUES ($1, $2, $3, 'pending', now())
       ON CONFLICT (project_id, artifact_path) DO UPDATE
         SET observed_commit_sha = EXCLUDED.observed_commit_sha,
             status              = 'pending',
             requested_at        = now(),
             processed_at        = NULL,
             error_message       = NULL`,
      [project.projectId, path, sha || null],
    );
    enqueued += 1;
  }

  return {
    summary: `push: enqueued ${enqueued} path(s) for embed`,
    detail: { project_id: project.projectId, enqueued },
  };
}

// ---------------------------------------------------------------------------
// GitHub: pull_request closed+merged -> contribution state=merged
// ---------------------------------------------------------------------------

export interface GithubPullRequestPayload {
  action?: string;
  pull_request?: {
    merged?: boolean;
    head?: { ref?: string };
    merge_commit_sha?: string | null;
    html_url?: string;
  };
  repository?: { html_url?: string; full_name?: string };
}

export async function dispatchGithubPullRequest(
  pool: Pool,
  payload: GithubPullRequestPayload,
): Promise<DispatchOutcome> {
  if (payload.action !== 'closed' || payload.pull_request?.merged !== true) {
    return { summary: `pull_request: skipped (action=${payload.action ?? 'unknown'})` };
  }

  const repoUrl = payload.repository?.html_url;
  const branch = payload.pull_request?.head?.ref;
  if (!repoUrl || !branch) {
    return { summary: 'pull_request: skipped (missing repo url or head.ref)' };
  }

  const project = await resolveProjectByRepoUrl(pool, repoUrl);
  if (!project) {
    return { summary: `pull_request: skipped (no project for ${repoUrl})` };
  }

  const mergeSha = payload.pull_request?.merge_commit_sha ?? null;

  // Authoritative merge-observation per ARCH §716. Bypass the author-
  // session check that AtelierClient.update enforces — webhook merge
  // observations originate from the platform, not from a session, and
  // moving the row to terminal `merged` state is the contract that
  // makes ADR-005 / ARCH §716 enforceable.
  //
  // We update only contributions in non-terminal states so a re-fired
  // webhook (manual dispatch / mirror) does not perturb already-terminal
  // rows.
  const { rows } = await pool.query<{ id: string }>(
    `UPDATE contributions
        SET state                    = 'merged',
            last_observed_commit_sha = COALESCE($3, last_observed_commit_sha),
            updated_at               = now()
      WHERE project_id = $1
        AND repo_branch = $2
        AND state IN ('claimed', 'in_progress', 'review', 'plan_review')
      RETURNING id`,
    [project.projectId, branch, mergeSha],
  );

  if (rows.length === 0) {
    return {
      summary: `pull_request: merged but no matching contribution for branch ${branch}`,
      detail: { project_id: project.projectId, branch },
    };
  }

  return {
    summary: `pull_request: marked ${rows.length} contribution(s) merged`,
    detail: {
      project_id: project.projectId,
      branch,
      contribution_ids: rows.map((r) => r.id),
      merge_sha: mergeSha,
    },
  };
}

// ---------------------------------------------------------------------------
// Figma: FILE_COMMENT -> triage_pending
// ---------------------------------------------------------------------------

export interface FigmaFileCommentPayload {
  event_type?: string;
  file_key?: string;
  file_name?: string;
  comment_id?: string;
  triggered_by?: { handle?: string; id?: string };
  comment?: Array<{ text?: string }>;
  timestamp?: string;
  webhook_id?: string;
}

export interface FigmaTriageRoute {
  projectId: string;
  triageSessionId: string;
  territoryId: string;
}

/** Resolve Figma triage route from env. Returns null when unconfigured. */
export function resolveFigmaTriageRouteFromEnv(): FigmaTriageRoute | null {
  const projectId = process.env.ATELIER_FIGMA_PROJECT_ID;
  const triageSessionId = process.env.ATELIER_FIGMA_TRIAGE_SESSION_ID;
  const territoryId = process.env.ATELIER_FIGMA_TRIAGE_TERRITORY_ID;
  if (!projectId || !triageSessionId || !territoryId) return null;
  return { projectId, triageSessionId, territoryId };
}

function flattenFigmaCommentText(payload: FigmaFileCommentPayload): string {
  if (!payload.comment) return '';
  return payload.comment
    .map((c) => c.text ?? '')
    .filter((t) => t.length > 0)
    .join('\n');
}

export async function dispatchFigmaFileComment(
  pool: Pool,
  payload: FigmaFileCommentPayload,
  route: FigmaTriageRoute | null = resolveFigmaTriageRouteFromEnv(),
): Promise<DispatchOutcome> {
  if (payload.event_type !== 'FILE_COMMENT') {
    return { summary: `figma: skipped (event_type=${payload.event_type ?? 'unknown'})` };
  }
  if (!route) {
    return {
      summary: 'figma: skipped (ATELIER_FIGMA_{PROJECT_ID,TRIAGE_SESSION_ID,TRIAGE_TERRITORY_ID} not set)',
    };
  }

  const externalCommentId = payload.comment_id ?? `figma-${payload.webhook_id ?? 'unknown'}-${Date.now()}`;
  const externalAuthor = payload.triggered_by?.handle ?? payload.triggered_by?.id ?? 'figma-user';
  const text = flattenFigmaCommentText(payload);
  const receivedAt = payload.timestamp ?? new Date().toISOString();

  // Insert directly into triage_pending. We bypass routeProposal here
  // because the classifier+drafter chain depends on lib paths under
  // scripts/sync/ that aren't bundled into the Next.js route runtime
  // (those scripts run in CLI/cron context). The shape we write
  // matches what a below-threshold routeProposal call would persist:
  // raw comment + a permissive "needs human triage" classification.
  // The FeedbackQueuePanel surfaces the row exactly the same way.
  //
  // Future increment: factor classifier+drafter into a runtime-safe
  // module so the route handler can score before persisting (today
  // every Figma comment lands as needs-human-review, which is the
  // ADR-018 default and safer than under-classifying).
  const classification = {
    category: 'off-topic',
    confidence: 0.0,
    signals: ['figma-webhook-default'],
  };
  const draftedProposal = {
    category: 'off-topic',
    confidence: 0.0,
    bodyMarkdown: `Figma comment from ${externalAuthor} on ${payload.file_name ?? payload.file_key ?? 'unknown'}:\n\n${text}`,
    suggestedAction: 'human-review',
    discipline: 'design',
  };
  const commentContext = {
    file_key: payload.file_key ?? null,
    file_name: payload.file_name ?? null,
    webhook_id: payload.webhook_id ?? null,
  };

  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO triage_pending (
       project_id, comment_source, external_comment_id, external_author,
       comment_text, comment_context, received_at,
       classification, drafted_proposal,
       territory_id, triage_session_id
     )
     VALUES (
       $1, 'figma', $2, $3,
       $4, $5::jsonb, $6,
       $7::jsonb, $8::jsonb,
       $9, $10
     )
     ON CONFLICT ON CONSTRAINT triage_pending_external_uniq DO UPDATE
       SET comment_text    = EXCLUDED.comment_text,
           comment_context = EXCLUDED.comment_context,
           received_at     = EXCLUDED.received_at
     RETURNING id`,
    [
      route.projectId,
      externalCommentId,
      externalAuthor,
      text,
      JSON.stringify(commentContext),
      receivedAt,
      JSON.stringify(classification),
      JSON.stringify(draftedProposal),
      route.territoryId,
      route.triageSessionId,
    ],
  );

  return {
    summary: `figma: enqueued triage_pending row ${rows[0]?.id ?? '<unknown>'}`,
    detail: {
      project_id: route.projectId,
      triage_pending_id: rows[0]?.id ?? null,
      external_comment_id: externalCommentId,
    },
  };
}
