// Atelier SSE Durable Object — per-project broadcast fan-out.
//
// Per ADR-055 (SSE supersedes Supabase Realtime as canonical broadcast
// pattern; Durable Object upgrade path documented for CF Workers) +
// ADR-052 (Cloudflare-primary infrastructure pivot).
//
// One DO instance per project_id. The instance holds two pieces of state:
//
//   1. A Map<connectionId, ReadableStreamDefaultController> of active SSE
//      subscribers. Connections are added on /subscribe fetch (the SSE
//      route forwards subscriber requests here) and removed when the
//      stream is cancelled by the client.
//
//   2. The most recent seq the DO has observed, used to flag `degraded:
//      true` on the first envelope a reconnecting subscriber sees if the
//      DO's connection map was empty during the writes (i.e. the
//      subscriber may have missed events while disconnected).
//
// Endpoints (internal; not exposed publicly):
//
//   POST /publish     — body: BroadcastEnvelope<TKind> JSON. Fans out to
//                       every active connection. Returns 204 on success.
//   GET  /subscribe   — opens a text/event-stream. The route handler in
//                       /api/events validates the JWT against the project
//                       binding BEFORE forwarding here, so the DO trusts
//                       the request shape. Returns SSE stream.
//
// Failure modes:
//   - Publish with no active subscribers: succeeds (204). Subscribers
//     that join later will see degraded=true on first event after gap.
//   - Subscriber connection drops: the ReadableStream's cancel() removes
//     it from the map. Other subscribers unaffected.
//   - DO instance evicted from memory between publishes: next subscriber
//     fetch causes CF to construct a fresh instance with empty state.
//     Next published event marks the connection's first envelope with
//     degraded=true via the lastSeq-watermark mechanism below.
//
// Why a Durable Object, not in-memory per-isolate:
//   Worker isolates may scale to many instances across CF's edge. A
//   per-isolate map would fragment the subscriber set so that a publish
//   in isolate A doesn't reach a subscriber connected to isolate B. The
//   DO is single-threaded per project_id and guarantees all
//   publish/subscribe traffic for one project routes to the same
//   instance.

import type {
  BroadcastEnvelope,
  BroadcastEventKind,
} from '../../scripts/coordination/lib/broadcast.ts';

/**
 * Structural type for the DO API surface this class relies on. The real
 * DurableObjectState comes from @cloudflare/workers-types at build time;
 * the structural form keeps tsc happy when @cloudflare/workers-types
 * isn't installed in the root tsconfig path.
 */
export interface DurableObjectStateLike {
  id: { toString(): string };
}

interface Connection {
  /** Monotonic per-DO; used as the connection key. */
  id: number;
  controller: ReadableStreamDefaultController<Uint8Array>;
  /** True until the first envelope has been written post-connect. */
  firstEnvelopePending: boolean;
}

const encoder = new TextEncoder();

export class AtelierSseDurableObject {
  private readonly state: DurableObjectStateLike;
  private readonly connections: Map<number, Connection> = new Map();
  private nextConnectionId: number = 1;
  /**
   * Set after the first publish() to this DO instance. Used to detect
   * subscribers that joined AFTER prior publishes -- their first envelope
   * is flagged degraded=true so the client can reconcile against
   * canonical state. The first subscriber on a fresh DO instance sees no
   * degraded flag because there are no prior events to have missed.
   */
  private hasPublishedBefore: boolean = false;

  constructor(state: DurableObjectStateLike, _env: unknown) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/publish') {
      return this.handlePublish(request);
    }
    if (request.method === 'GET' && url.pathname === '/subscribe') {
      return this.handleSubscribe();
    }
    return new Response(`unsupported: ${request.method} ${url.pathname}`, { status: 404 });
  }

  // -------------------------------------------------------------------------
  // Publish — fan out one envelope to every active connection
  // -------------------------------------------------------------------------

  private async handlePublish(request: Request): Promise<Response> {
    let envelope: BroadcastEnvelope<BroadcastEventKind>;
    try {
      envelope = (await request.json()) as BroadcastEnvelope<BroadcastEventKind>;
    } catch (err) {
      return new Response(`invalid JSON: ${(err as Error).message}`, { status: 400 });
    }
    if (!envelope?.id || !envelope.seq || !envelope.kind || !envelope.payload) {
      return new Response('envelope missing required fields', { status: 400 });
    }

    const wireLines = formatSseFrame(envelope);
    const dead: number[] = [];
    for (const conn of this.connections.values()) {
      // Mark degraded=true on the first envelope a subscriber sees ONLY
      // when this DO has fanned out at least one prior publish (i.e. the
      // subscriber joined LATE and may have missed events). The first
      // subscriber on a fresh DO does not get degraded -- there's no gap
      // to reconcile against.
      const markDegraded =
        conn.firstEnvelopePending &&
        this.hasPublishedBefore &&
        envelope.degraded !== true;
      const frame = markDegraded ? formatSseFrame({ ...envelope, degraded: true }) : wireLines;
      conn.firstEnvelopePending = false;
      try {
        conn.controller.enqueue(encoder.encode(frame));
      } catch {
        dead.push(conn.id);
      }
    }
    for (const id of dead) this.connections.delete(id);

    this.hasPublishedBefore = true;

    return new Response(null, { status: 204 });
  }

  // -------------------------------------------------------------------------
  // Subscribe — open an SSE stream and register a connection
  // -------------------------------------------------------------------------

  private handleSubscribe(): Response {
    const connectionId = this.nextConnectionId++;
    const self = this;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Initial comment frame: lets the client know the connection is
        // live, and primes any intermediary proxies that an event-stream
        // is flowing. SSE allows comments via lines beginning with ':'.
        controller.enqueue(
          encoder.encode(`: atelier sse connected do=${self.state.id.toString()}\n\n`),
        );
        // Initial retry hint: 5 seconds. Browsers honor this on
        // disconnects so EventSource auto-reconnect cadence is bounded.
        controller.enqueue(encoder.encode(`retry: 5000\n\n`));

        self.connections.set(connectionId, {
          id: connectionId,
          controller,
          firstEnvelopePending: true,
        });
      },
      cancel() {
        self.connections.delete(connectionId);
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, no-transform',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      },
    });
  }
}

/**
 * Format a single SSE frame. Per the SSE spec:
 *   id: <envelope.id>
 *   event: <envelope.kind>
 *   data: <stringified envelope>
 *   <blank line>
 *
 * `id:` lets browsers replay via Last-Event-ID on reconnect (we don't use
 * that path at v1 -- the reconcile contract is the `degraded` flag plus
 * canonical-state re-fetch -- but emitting id: keeps the framing standard
 * and gives operators a stable handle in the dev tools network panel).
 */
export function formatSseFrame(envelope: BroadcastEnvelope<BroadcastEventKind>): string {
  const data = JSON.stringify(envelope);
  return `id: ${envelope.id}\nevent: ${envelope.kind}\ndata: ${data}\n\n`;
}
