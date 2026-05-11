// Atelier broadcast Worker — owns the SSE Durable Object class.
//
// Per ADR-052 + ADR-055 + BRD-OPEN-QUESTIONS §37 + G2 dispatch.
//
// Why a separate Worker (mirrors the cron-worker pattern):
//   - The OpenNext-built main app Worker does NOT have a clean hook for
//     exporting an additional Durable Object class alongside the Next.js
//     handler. Keeping the DO in its own Worker decouples DO deploy from
//     the OpenNext build pipeline.
//   - The main app references the DO via a cross-Worker namespace binding
//     (durable_objects.bindings[].script_name = "atelier-broadcast" in
//     prototype/wrangler.jsonc).
//   - DO logic ships independently of the Next app; rolling a fix to the
//     fan-out shape doesn't require rebuilding the main app.
//
// Routes exposed by this Worker (called only by the main app's
// /api/events route forwarding subscriber requests + by the
// CloudflareDoBroadcastService publishing events):
//
//   * The Worker itself accepts no traffic at the root path. All
//     interaction happens through the DO stub, which the main app gets
//     via its `env.ATELIER_BROADCAST` binding (a DurableObjectNamespace
//     that points at this Worker's DO class).
//
// The default fetch handler is a sanity probe: GET /healthz returns 200
// for ops; everything else returns 404. The DO itself owns publish +
// subscribe.

export { AtelierSseDurableObject } from './durable-object.ts';

interface Env {
  // Self-reference for the DO. Wrangler binds the namespace under the
  // name SELF when a Worker exports its own DO class.
  ATELIER_BROADCAST: DurableObjectNamespace;
}

declare global {
  interface DurableObjectNamespace {
    idFromName(name: string): DurableObjectId;
    get(id: DurableObjectId): DurableObjectStub;
  }
  interface DurableObjectId {
    toString(): string;
  }
  interface DurableObjectStub {
    fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  }
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/healthz') {
      return new Response('ok', { status: 200 });
    }
    return new Response(
      'atelier-broadcast: traffic flows through DO stubs, not the Worker root',
      { status: 404 },
    );
  },
};
