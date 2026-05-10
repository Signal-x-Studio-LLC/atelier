// Triage cron orchestrator.
//
// Per ARCH §6.5.2 + BRD-OPEN-QUESTIONS §37 PR 2c (CF migration).
//
// Reads triage routes from .atelier/config.yaml; for each route polls the
// configured CommentSourceAdapter.fetchSince(watermark), routes each new
// comment through routeProposal(), and advances the watermark on success.
//
// Config shape (.atelier/config.yaml):
//   triage:
//     routes:
//       - project: <project name OR uuid>     # required; resolved to project_id
//         adapter: github | figma | ...       # must be a registered CommentSourceAdapter
//         territory: <territory name OR uuid> # required; resolved to territory_id within project
//         triage_session_id: <uuid>           # required; pre-created session for the triage composer
//         classifier: heuristic-v1 | llm-v1   # default: heuristic-v1
//         threshold: 0.5                      # default: 0.5
//         content_ref_prefix: github://triage # default: <adapter>://triage
//
// Per-route iteration: routes are independent; one route's failure doesn't
// prevent others from running. Per-comment errors within a route are
// captured + reported but don't fail the route.
//
// Watermark advancement: only advances on successful poll. If fetchSince
// throws, watermark stays where it was so the next tick re-attempts the
// same window.

import { Client } from 'pg';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { resolveCommentSourceAdapter } from '../lib/adapters.ts';
import { registerConfiguredAdapters } from '../lib/adapter-registry.ts';
import { routeProposal } from './route-proposal.ts';
import { AtelierClient } from '../lib/write.ts';

export interface TriageRouteConfig {
  project: string;
  adapter: string;
  territory: string;
  triage_session_id: string;
  classifier?: string;
  threshold?: number;
  content_ref_prefix?: string;
}

export interface TriageRunOpts {
  repoRoot?: string;
  databaseUrl?: string;
  dryRun?: boolean;
}

export type TriageRouteResult =
  | {
      route: TriageRouteConfig;
      skipped: true;
      reason: string;
    }
  | {
      route: TriageRouteConfig;
      skipped: false;
      commentsFetched: number;
      contributionsCreated: number;
      routedToHumanQueue: number;
      errors: number;
      newWatermark: string;
    };

export interface TriageRunResult {
  routesEvaluated: number;
  routes: TriageRouteResult[];
}

export async function runOnce(opts: TriageRunOpts = {}): Promise<TriageRunResult> {
  const repoRoot = opts.repoRoot ?? process.cwd();
  const dbUrl = opts.databaseUrl ?? process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

  const routes = loadTriageRoutes(repoRoot);
  if (routes.length === 0) {
    return { routesEvaluated: 0, routes: [] };
  }

  registerConfiguredAdapters();

  const db = new Client({ connectionString: dbUrl });
  await db.connect();

  const results: TriageRouteResult[] = [];
  try {
    for (const route of routes) {
      try {
        results.push(await runRoute(db, dbUrl, route, !!opts.dryRun));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ route, skipped: true, reason: `route_error: ${message}` });
      }
    }
  } finally {
    await db.end();
  }
  return { routesEvaluated: routes.length, routes: results };
}

function loadTriageRoutes(repoRoot: string): TriageRouteConfig[] {
  const path = join(repoRoot, '.atelier', 'config.yaml');
  if (!existsSync(path)) return [];
  const raw = parseYaml(readFileSync(path, 'utf-8')) as { triage?: { routes?: unknown[] } } | null;
  const list = raw?.triage?.routes;
  if (!Array.isArray(list)) return [];
  const routes: TriageRouteConfig[] = [];
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    if (typeof o.project !== 'string' || typeof o.adapter !== 'string' ||
        typeof o.territory !== 'string' || typeof o.triage_session_id !== 'string') continue;
    const route: TriageRouteConfig = {
      project: o.project,
      adapter: o.adapter,
      territory: o.territory,
      triage_session_id: o.triage_session_id,
      ...(typeof o.classifier === 'string' ? { classifier: o.classifier } : {}),
      ...(typeof o.threshold === 'number' ? { threshold: o.threshold } : {}),
      ...(typeof o.content_ref_prefix === 'string' ? { content_ref_prefix: o.content_ref_prefix } : {}),
    };
    routes.push(route);
  }
  return routes;
}

async function runRoute(db: Client, dbUrl: string, route: TriageRouteConfig, dryRun: boolean): Promise<TriageRouteResult> {
  const projectId = await resolveProjectId(db, route.project);
  if (!projectId) {
    return { route, skipped: true, reason: `project_not_found: ${route.project}` };
  }
  const territoryId = await resolveTerritoryId(db, projectId, route.territory);
  if (!territoryId) {
    return { route, skipped: true, reason: `territory_not_found: ${route.territory} in project ${route.project}` };
  }

  const adapter = resolveCommentSourceAdapter(route.adapter);
  const watermark = await readWatermark(db, projectId, route.adapter);
  const since = new Date(watermark);

  const comments = await adapter.fetchSince(since);
  if (comments.length === 0) {
    await advanceWatermark(db, projectId, route.adapter, new Date(), null);
    return {
      route,
      skipped: false,
      commentsFetched: 0,
      contributionsCreated: 0,
      routedToHumanQueue: 0,
      errors: 0,
      newWatermark: new Date().toISOString(),
    };
  }

  const client = new AtelierClient({ databaseUrl: dbUrl });
  let contributionsCreated = 0;
  let routedToHumanQueue = 0;
  let errors = 0;
  let lastSuccessfulCommentId: string | null = null;
  let lastSuccessfulAt = since;

  const classifier = route.classifier ?? 'heuristic-v1';
  const threshold = route.threshold ?? 0.5;
  const contentRefPrefix = route.content_ref_prefix ?? `${route.adapter}://triage`;

  try {
    for (const comment of comments) {
      try {
        const decision = await routeProposal({
          client,
          comment,
          classifierName: classifier,
          projectId,
          triageSessionId: route.triage_session_id,
          territoryId,
          contentRef: `${contentRefPrefix}/${comment.externalCommentId}`,
          threshold,
          dryRun,
        });
        if (decision.outcome === 'contribution_created') contributionsCreated += 1;
        else if (decision.outcome === 'routed_to_human_queue') routedToHumanQueue += 1;
        lastSuccessfulCommentId = comment.externalCommentId;
        lastSuccessfulAt = new Date(comment.receivedAt);
      } catch (_err) {
        errors += 1;
        // Continue to next comment; per-comment failures don't break the route.
      }
    }
  } finally {
    await client.close();
  }

  // Advance watermark to the latest successfully-processed comment's
  // receivedAt timestamp, not now() — this lets the next tick retry comments
  // that failed mid-batch without re-processing successes.
  const advanceTo = errors > 0 ? lastSuccessfulAt : new Date();
  await advanceWatermark(db, projectId, route.adapter, advanceTo, lastSuccessfulCommentId);

  return {
    route,
    skipped: false,
    commentsFetched: comments.length,
    contributionsCreated,
    routedToHumanQueue,
    errors,
    newWatermark: advanceTo.toISOString(),
  };
}

async function resolveProjectId(db: Client, idOrName: string): Promise<string | null> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName)) {
    const { rows } = await db.query<{ id: string }>('SELECT id FROM projects WHERE id = $1::uuid', [idOrName]);
    return rows[0]?.id ?? null;
  }
  const { rows } = await db.query<{ id: string }>('SELECT id FROM projects WHERE slug = $1 OR name = $1 LIMIT 1', [idOrName]);
  return rows[0]?.id ?? null;
}

async function resolveTerritoryId(db: Client, projectId: string, idOrName: string): Promise<string | null> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName)) {
    const { rows } = await db.query<{ id: string }>(
      'SELECT id FROM territories WHERE id = $1::uuid AND project_id = $2::uuid',
      [idOrName, projectId],
    );
    return rows[0]?.id ?? null;
  }
  const { rows } = await db.query<{ id: string }>(
    'SELECT id FROM territories WHERE name = $1 AND project_id = $2::uuid LIMIT 1',
    [idOrName, projectId],
  );
  return rows[0]?.id ?? null;
}

async function readWatermark(db: Client, projectId: string, adapterName: string): Promise<string> {
  const { rows } = await db.query<{ last_polled_at: Date }>(
    `SELECT last_polled_at FROM triage_watermarks WHERE project_id = $1::uuid AND adapter_name = $2`,
    [projectId, adapterName],
  );
  return rows[0]?.last_polled_at?.toISOString() ?? new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

async function advanceWatermark(
  db: Client,
  projectId: string,
  adapterName: string,
  to: Date,
  lastExternalCommentId: string | null,
): Promise<void> {
  await db.query(
    `INSERT INTO triage_watermarks (project_id, adapter_name, last_polled_at, last_external_comment_id, updated_at)
     VALUES ($1::uuid, $2, $3, $4, now())
     ON CONFLICT (project_id, adapter_name)
     DO UPDATE SET last_polled_at = EXCLUDED.last_polled_at,
                   last_external_comment_id = EXCLUDED.last_external_comment_id,
                   updated_at = now()`,
    [projectId, adapterName, to.toISOString(), lastExternalCommentId],
  );
}
