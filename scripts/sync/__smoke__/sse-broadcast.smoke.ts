#!/usr/bin/env -S npx tsx
//
// SSE broadcast substrate smoke (G2).
//
// Validates the AtelierSseDurableObject fan-out shape + degraded reconcile
// contract IN-PROCESS, without requiring a deployed Cloudflare runtime.
// Live-deploy validation runs through the cloudflare-deploy workflow
// (operator activation per CF_DEPLOY_ENABLED + docs/user/tutorials/
// cloudflare-bootstrap.md) -- this smoke proves the substrate shape.
//
// Why in-process: the DO class uses only Web-standard primitives
// (ReadableStream, Response, TextEncoder) that Node 18+ exposes globally.
// The class can be exercised directly by constructing it with a stub DO
// state object and a stub env. The fan-out + degraded behavior we need to
// regression-protect is captured at this layer; the cross-network
// transport bits (Workers HTTP, the cross-Worker namespace binding) are
// thin wrappers the operator validates at deploy time.
//
// Coverage:
//   [1] Single subscriber receives published envelopes in order
//   [2] Multiple subscribers each receive every envelope (fan-out)
//   [3] Subscriber that joins AFTER an empty period sees degraded=true
//       on its first envelope (the reconcile contract from ARCH 6.8)
//   [4] SSE wire frames have correct shape (id:/event:/data:/\n\n)
//
// Run:
//   npm run smoke:sse-broadcast
//   # or:
//   npx tsx scripts/sync/__smoke__/sse-broadcast.smoke.ts

import {
  AtelierSseDurableObject,
  formatSseFrame,
} from '../../../broadcast-worker/src/durable-object.ts';
import type {
  BroadcastEnvelope,
  BroadcastEventKind,
} from '../../coordination/lib/broadcast.ts';

const PROJECT_ID = '99999999-aaaa-aaaa-aaaa-' + Date.now().toString().padStart(12, '0').slice(-12);

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  const status = ok ? 'PASS' : 'FAIL';
  const suffix = detail ? `  -- ${detail}` : '';
  // eslint-disable-next-line no-console
  console.log(`  ${status}  ${label}${suffix}`);
  if (!ok) failures += 1;
}

function makeEnvelope(seq: number, kind: BroadcastEventKind): BroadcastEnvelope {
  const id = `evt-${seq}`;
  const base = {
    id,
    seq: String(seq),
    published_at: new Date().toISOString(),
    project_id: PROJECT_ID,
  };
  if (kind === 'contribution.state_changed') {
    return {
      ...base,
      kind,
      payload: {
        contribution_id: `c-${seq}`,
        prior_state: null,
        new_state: 'claimed',
        author_session_id: 'sess-A',
        author_composer_id: 'comp-A',
        trace_ids: ['BRD:Epic-1'],
      },
    } as BroadcastEnvelope;
  }
  if (kind === 'lock.acquired') {
    return {
      ...base,
      kind,
      payload: {
        lock_id: `l-${seq}`,
        contribution_id: `c-${seq}`,
        artifact_scope: ['file.md'],
        holder_session_id: 'sess-A',
        holder_composer_id: 'comp-A',
        fencing_token: String(seq),
      },
    } as BroadcastEnvelope;
  }
  // default: decision.created
  return {
    ...base,
    kind: 'decision.created',
    payload: {
      decision_id: `d-${seq}`,
      adr_id: `ADR-${seq}`,
      trace_ids: ['BRD:Epic-1'],
      summary: `synthetic ${seq}`,
      category: 'architecture',
    },
  } as BroadcastEnvelope;
}

class StubState {
  id = { toString: () => `do-${PROJECT_ID}` };
}

interface ReaderHandle {
  frames: string[];
  reader: ReadableStreamDefaultReader<Uint8Array>;
  pump: Promise<void>;
}

async function startSubscriber(doInstance: AtelierSseDurableObject): Promise<ReaderHandle> {
  const subscribeRequest = new Request('https://atelier-do.internal/subscribe', { method: 'GET' });
  const res = await doInstance.fetch(subscribeRequest);
  if (!res.body) throw new Error('DO /subscribe returned no body');
  const reader = res.body.getReader();
  const frames: string[] = [];
  const decoder = new TextDecoder();
  let buffer = '';
  const pump = (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        // SSE frames are delimited by \n\n
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx + 2);
          buffer = buffer.slice(idx + 2);
          if (frame.trim().length > 0) frames.push(frame);
        }
      }
    } catch {
      // reader cancelled
    }
  })();
  // Give the start() callback a tick to enqueue the initial comment + retry frames
  await new Promise((r) => setTimeout(r, 10));
  return { frames, reader, pump };
}

async function publish(doInstance: AtelierSseDurableObject, envelope: BroadcastEnvelope): Promise<Response> {
  const req = new Request('https://atelier-do.internal/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(envelope),
  });
  return doInstance.fetch(req);
}

function findFrame(frames: string[], envelope: BroadcastEnvelope): string | null {
  for (const f of frames) {
    if (f.includes(`id: ${envelope.id}\n`)) return f;
  }
  return null;
}

async function main(): Promise<void> {
  const state = new StubState() as unknown as ConstructorParameters<typeof AtelierSseDurableObject>[0];
  const doInstance = new AtelierSseDurableObject(state, {});

  // -----------------------------------------------------------------------
  // [1] Single subscriber receives ordered envelopes
  // -----------------------------------------------------------------------
  console.log('\n[1] Single subscriber receives published envelopes in order');
  const subA = await startSubscriber(doInstance);

  const env1 = makeEnvelope(1, 'contribution.state_changed');
  const env2 = makeEnvelope(2, 'lock.acquired');
  const env3 = makeEnvelope(3, 'decision.created');

  const r1 = await publish(doInstance, env1);
  const r2 = await publish(doInstance, env2);
  const r3 = await publish(doInstance, env3);
  check('publish(1) returns 204', r1.status === 204, `status=${r1.status}`);
  check('publish(2) returns 204', r2.status === 204);
  check('publish(3) returns 204', r3.status === 204);

  await new Promise((r) => setTimeout(r, 20));
  check('subA received env1', findFrame(subA.frames, env1) !== null);
  check('subA received env2', findFrame(subA.frames, env2) !== null);
  check('subA received env3', findFrame(subA.frames, env3) !== null);

  // [4] Wire format: id:, event:, data:, terminated by \n\n
  const frame1 = findFrame(subA.frames, env1) ?? '';
  check('frame has id: line', frame1.includes(`id: ${env1.id}\n`));
  check('frame has event: line', frame1.includes(`event: ${env1.kind}\n`));
  check('frame has data: line', frame1.includes(`data: ${JSON.stringify(env1)}\n`));
  check('frame terminates with blank line', frame1.endsWith('\n\n'));

  // -----------------------------------------------------------------------
  // [2] Multi-subscriber fan-out
  // -----------------------------------------------------------------------
  console.log('\n[2] Multi-subscriber fan-out');
  const subB = await startSubscriber(doInstance);
  const env4 = makeEnvelope(4, 'contribution.state_changed');
  await publish(doInstance, env4);
  await new Promise((r) => setTimeout(r, 20));
  check('subA received env4', findFrame(subA.frames, env4) !== null);
  check('subB received env4', findFrame(subB.frames, env4) !== null);

  // -----------------------------------------------------------------------
  // [3] Reconcile contract: subscriber joining after empty period
  //     receives degraded=true on first envelope
  // -----------------------------------------------------------------------
  console.log('\n[3] Subscriber after disconnect+reconnect sees degraded=true on first envelope');
  await subA.reader.cancel();
  await subA.reader.releaseLock();
  await subB.reader.cancel();
  await subB.reader.releaseLock();
  // Allow the DO's cancel() callback to clear its map.
  await new Promise((r) => setTimeout(r, 50));

  // Publish env5 to nobody (DO map empty)
  const env5 = makeEnvelope(5, 'decision.created');
  await publish(doInstance, env5);

  // Fresh subscriber reconnects; next publish should carry degraded=true
  const subC = await startSubscriber(doInstance);
  const env6 = makeEnvelope(6, 'contribution.state_changed');
  await publish(doInstance, env6);
  await new Promise((r) => setTimeout(r, 20));
  const reconcileFrame = findFrame(subC.frames, env6);
  check('subC received env6 after reconnect', reconcileFrame !== null);
  if (reconcileFrame) {
    const dataLine = reconcileFrame
      .split('\n')
      .find((line) => line.startsWith('data: '));
    const wire = dataLine ? JSON.parse(dataLine.slice('data: '.length)) : null;
    check('first envelope post-reconnect has degraded=true', wire?.degraded === true);
  }

  // -----------------------------------------------------------------------
  // [4] formatSseFrame is pure + deterministic
  // -----------------------------------------------------------------------
  console.log('\n[4] formatSseFrame purity');
  const refFrame = formatSseFrame(env1);
  check('formatSseFrame is stable', refFrame === formatSseFrame(env1));
  check('formatSseFrame starts with id:', refFrame.startsWith(`id: ${env1.id}\n`));

  await subC.reader.cancel().catch(() => {});

  if (failures > 0) {
    console.error(`\nFAIL: ${failures} SSE assertion(s) failed`);
    process.exit(1);
  }
  console.log('\nPASS: SSE broadcast substrate smoke green');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('sse-broadcast smoke crashed:', err);
  process.exit(1);
});
