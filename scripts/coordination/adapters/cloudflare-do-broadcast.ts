// Cloudflare Durable Object adapter for the BroadcastService interface.
//
// Per ADR-052 (Cloudflare-primary infrastructure pivot) + ADR-055
// (three-loop framing + SSE broadcast adoption). This is the publish-side
// adapter that runs inside the OpenNext-on-Workers process when an
// AtelierClient mutation needs to fan out a broadcast event.
//
// Architecture:
//
//   Publish path
//   ------------
//   AtelierClient.publishEvent(...) -> CloudflareDoBroadcastService.publish()
//     -> env.ATELIER_BROADCAST.get(idFromName(project_id)).fetch(
//          'https://internal/publish', { method: 'POST', body: envelope }
//        )
//   The DO instance keyed by project_id receives the envelope and fans it
//   out to its in-memory connection map (one per subscribed SSE client).
//
//   Subscribe path
//   --------------
//   The subscriber HTTP request hits /api/events?project_id=<uuid> and the
//   route handler forwards it to the SAME DO instance, which holds the
//   response stream open and writes envelopes as they arrive. The
//   BroadcastService.subscribe() method on THIS adapter is intentionally a
//   no-op for the worker-internal path -- subscribers don't go through the
//   AtelierClient; they hit the SSE route directly. Keeping subscribe() in
//   the interface shape preserves vendor-neutrality for adapters where the
//   subscriber side does live in the same process (Supabase Realtime,
//   Postgres NOTIFY/LISTEN).
//
// Per ADR-029 portability:
//   - This file is the ONLY place in the broadcast substrate that imports
//     Cloudflare-specific types (DurableObjectNamespace).
//   - Other implementations (NoopBroadcastService, SupabaseRealtimeAdapter,
//     future PostgresNotifyAdapter) remain interface-compatible.

import {
  type BroadcastService,
  type PublishInput,
  type SubscribeInput,
  type Subscription,
} from '../lib/broadcast.ts';

/**
 * Minimal structural type for the DO namespace binding. Defined locally
 * so this file does not require @cloudflare/workers-types to be a runtime
 * dependency outside the prototype Worker build.
 */
export interface DurableObjectNamespaceLike {
  idFromName(name: string): DurableObjectIdLike;
  get(id: DurableObjectIdLike): DurableObjectStubLike;
}
export interface DurableObjectIdLike {
  toString(): string;
}
export interface DurableObjectStubLike {
  fetch(input: string, init?: DoFetchInit): Promise<DoFetchResponse>;
}

export interface DoFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface DoFetchResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export interface CloudflareDoBroadcastOptions {
  /**
   * Durable Object namespace binding wired in wrangler.jsonc as
   * ATELIER_BROADCAST. The Worker entry point reads
   * `env.ATELIER_BROADCAST` and threads it here.
   */
  namespace: DurableObjectNamespaceLike;
}

/**
 * Internal URL the DO instance recognizes. Not a public route; only the
 * Worker code in this process (publisher side) and the SSE route handler
 * (subscriber side) call it. The host portion is irrelevant for DO stubs
 * but Workers' fetch() validates it as a URL, so we use a synthetic host.
 */
const DO_PUBLISH_URL = 'https://atelier-do.internal/publish';

export class CloudflareDoBroadcastService implements BroadcastService {
  private readonly namespace: DurableObjectNamespaceLike;

  constructor(opts: CloudflareDoBroadcastOptions) {
    this.namespace = opts.namespace;
  }

  async publish(input: PublishInput): Promise<void> {
    const projectId = input.envelope.project_id;
    if (!projectId) {
      throw new Error('CloudflareDoBroadcastService.publish: envelope.project_id is required');
    }
    const id = this.namespace.idFromName(projectId);
    const stub = this.namespace.get(id);
    // ADR-005 + ARCH 6.8: broadcast is downstream of the canonical write.
    // The caller (AtelierClient.publishEvent) already wraps this call in
    // try/catch and logs degraded; throwing here is acceptable. We
    // intentionally do NOT swallow errors at the adapter boundary so the
    // caller has full information.
    const res = await stub.fetch(DO_PUBLISH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.envelope),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '<unreadable>');
      throw new Error(
        `CloudflareDoBroadcastService.publish: DO returned ${res.status}: ${text}`,
      );
    }
  }

  /**
   * Subscribers do not flow through this adapter. The /api/events SSE
   * route forwards the HTTP request directly to the DO stub. This method
   * exists to satisfy the BroadcastService interface but throws on call
   * so misuse fails loudly instead of silently dropping subscriptions.
   */
  async subscribe(_input: SubscribeInput): Promise<Subscription> {
    throw new Error(
      'CloudflareDoBroadcastService.subscribe is not the subscription path; ' +
        'connect to /api/events?project_id=<uuid> with Authorization: Bearer <jwt> instead.',
    );
  }

  async unsubscribe(_subscription: Subscription): Promise<void> {
    // No-op; see subscribe() comment.
  }
}

/**
 * Factory matching the shape of createSupabaseRealtimeBroadcastService so
 * callers can construct via a single function reference.
 */
export function createCloudflareDoBroadcastService(
  opts: CloudflareDoBroadcastOptions,
): CloudflareDoBroadcastService {
  return new CloudflareDoBroadcastService(opts);
}
