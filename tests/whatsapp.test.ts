import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { getDoctorBySlug } from '../src/lib/data.ts';
import { submitRequest, type Deps } from '../src/lib/whatsapp/appointments.ts';
import { respond } from '../src/lib/whatsapp/bot.ts';
import { alreadySeen, parseWebhook, verifySignature } from '../src/lib/whatsapp/client.ts';
import { toApiPayload, type Out } from '../src/lib/whatsapp/messages.ts';

const text = (t: string) => respond({ kind: 'text', text: t });
const reply = (id: string) => respond({ kind: 'reply', replyId: id });
const all = (o: Out[]) => JSON.stringify(o);

/** Walks every reachable reply id (breadth first) and checks WhatsApp's hard limits on each message. */
function checkLimits(out: Out[]) {
  for (const m of out) {
    if (m.type === 'text') assert.ok(m.body.length <= 4096);
    if (m.type === 'image') assert.ok(m.caption.length <= 1024 && m.link.startsWith('https://'));
    if (m.type === 'buttons') { assert.ok(m.buttons.length <= 3 && m.body.length <= 1024); for (const b of m.buttons) assert.ok(b.title.length <= 20 && b.id.length <= 256); }
    if (m.type === 'list') { assert.ok(m.rows.length >= 1 && m.rows.length <= 10 && m.body.length <= 1024 && m.button.length <= 20); for (const r of m.rows) assert.ok(r.title.length <= 24 && (r.description?.length ?? 0) <= 72 && r.id.length <= 200, r.title); }
  }
}

test('every reachable bot reply respects WhatsApp limits and ids resolve', () => {
  const seen = new Set<string>(); const queue = ['menu'];
  while (queue.length && seen.size < 400) {
    const id = queue.shift()!; if (seen.has(id)) continue; seen.add(id);
    const { out } = id === 'menu' ? text('hola') : reply(id);
    assert.ok(out.length > 0); checkLimits(out); toApiPayload('18095550000', out[0]);
    for (const m of out) {
      if (m.type === 'list') for (const r of m.rows) queue.push(r.id);
      if (m.type === 'buttons') for (const b of m.buttons) queue.push(b.id);
    }
  }
  assert.ok(seen.size > 20, `explored ${seen.size}`);
});

test('free-text search by specialty and city lists verified doctors first', () => {
  const { out } = text('cardiólogo en Santo Domingo');
  const l = out[0]; assert.equal(l.type, 'list');
  if (l.type === 'list') {
    const doctorRows = l.rows.filter((r) => r.id.startsWith('d:'));
    assert.ok(doctorRows.length > 0);
    const firstListed = doctorRows.findIndex((r) => !r.description?.startsWith('✔'));
    const lastVerified = doctorRows.map((r) => r.description?.startsWith('✔')).lastIndexOf(true);
    assert.ok(firstListed === -1 || lastVerified < firstListed, 'verified before listed');
  }
});

test('verified doctor: photo, booking; listed doctor: no photo, no booking, no direct phone', () => {
  const dv = getDoctorBySlug('dra-maria-perez-cardiologa')!.doctor; const prev = dv.photo_url;
  dv.photo_url = '/img/demo.jpg';
  const v = reply('d:dra-maria-perez-cardiologa').out;
  dv.photo_url = prev;
  assert.ok(v.some((m) => m.type === 'image' && m.link.startsWith('http')), 'verified doctors get their photo');
  assert.match(all(v), /bk:dra-maria-perez-cardiologa/);
  const bk = respond({ kind: 'reply', replyId: 'bk:dra-maria-perez-cardiologa', from: '18095550001' }).out;
  assert.match(all(bk), /un solo mensaje/);
  assert.doesNotMatch(all(bk), /wa\.me\/1809555100/, 'the patient is not sent to the doctor directly');

  const listedSlug = text('Yudelka Brito').out;
  const listed = reply('d:yudelka-brito-paulino-cardiologia').out;
  assert.ok(!listed.some((m) => m.type === 'image'));
  assert.doesNotMatch(all(listed), /bk:/);
  assert.match(all(listed), /no verificad/);
  assert.match(all(reply('bk:yudelka-brito-paulino-cardiologia').out), /perfil informativo/);
  assert.ok(listedSlug.length > 0);
});

test('drafts are invisible and unknown slugs never throw', () => {
  assert.doesNotMatch(all(reply('d:dr-sin-verificar-cardiologo').out), /Sin Verificar/);
  for (const id of ['d:nope', 'f:nope', 'g:nope', 'c:nope', 'r:nope:all:all:0', 'ar:nope:all', 'zzz', '']) assert.ok(reply(id).out.length > 0);
});

test('emergency, handoff, greeting and unsupported input', () => {
  assert.match(all(text('creo que es un infarto').out), /911/);
  assert.match(all(text('quiero hablar con una persona').out), /contacto@/);
  assert.equal(text('hola').intent, 'menu');
  assert.match(all(respond({ kind: 'other' }).out), /texto/);
  assert.match(all(reply('m:ver').out), /exequátur/i);
});

test('webhook signature and parsing', () => {
  const body = JSON.stringify({ entry: [{ changes: [{ value: { contacts: [{ wa_id: '1809', profile: { name: 'X' } }], messages: [
    { from: '1809', id: 'wamid.1', type: 'text', text: { body: 'hola' } },
    { from: '1809', id: 'wamid.2', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'm:doc', title: 'Buscar' } } },
    { from: '1809', id: 'wamid.3', type: 'image' },
  ] } }] }] });
  const sig = 'sha256=' + createHmac('sha256', 's3cret').update(body).digest('hex');
  assert.equal(verifySignature(body, sig, 's3cret'), true);
  assert.equal(verifySignature(body + ' ', sig, 's3cret'), false);
  assert.equal(verifySignature(body, null, 's3cret'), false);
  assert.equal(verifySignature(body, 'sha256=zz', 's3cret'), false);
  const msgs = parseWebhook(JSON.parse(body));
  assert.deepEqual(msgs.map((m) => m.kind), ['text', 'reply', 'other']);
  assert.equal(msgs[1].replyId, 'm:doc');
  assert.equal(alreadySeen('dup-1'), false); assert.equal(alreadySeen('dup-1'), true);
  assert.deepEqual(parseWebhook({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] }), []);
});

test('appointment request: patient writes once, guiddo saves it and forwards it to the verified doctor', async () => {
  const from = '18095557777'; const slug = 'dra-maria-perez-cardiologa';
  respond({ kind: 'reply', replyId: `bk:${slug}`, from });
  const res = respond({ kind: 'text', text: 'María Pérez, martes en la tarde', from });
  assert.equal(res.intent, 'appt'); assert.deepEqual(res.request, { slug, message: 'María Pérez, martes en la tarde' });
  // the next message is a normal message again
  assert.equal(respond({ kind: 'text', text: 'hola', from }).request, undefined);

  const calls: string[] = [];
  const deps: Deps = {
    save: async (_d, phone, msg) => { calls.push(`save:${phone}:${msg}`); return 7; },
    mark: async (id, status) => { calls.push(`mark:${id}:${status}`); },
    notify: async (to, body) => { calls.push(`notify:${to}`); assert.match(body, /wa\.me\/18095557777/); },
  };
  const out = await submitRequest({ slug, from, message: res.request!.message }, deps);
  assert.deepEqual(calls.map((c) => c.split(':')[0]), ['save', 'notify', 'mark']);
  assert.match(all(out), /Enviamos tu solicitud/);

  // forwarding fails but it was saved: the team follows up from the admin panel
  const failing: Deps = { ...deps, notify: async () => { throw new Error('boom'); } };
  assert.match(all(await submitRequest({ slug, from: '18095558888', message: 'x' }, failing)), /Recibimos tu solicitud/);
  // nothing saved and not forwarded: give the patient the doctor's direct link
  const none: Deps = { save: async () => null, mark: async () => {}, notify: async () => { throw new Error('boom'); } };
  assert.match(all(await submitRequest({ slug, from: '18095559999', message: 'x' }, none)), /wa\.me\//);
  // listed doctors never receive requests; hourly limit applies
  assert.match(all(await submitRequest({ slug: 'yudelka-brito-paulino-cardiologia', from, message: 'x' }, deps)), /no recibe citas/);
  for (let i = 0; i < 3; i++) await submitRequest({ slug, from: '18095550003', message: 'x' }, deps);
  assert.match(all(await submitRequest({ slug, from: '18095550003', message: 'x' }, deps)), /varias solicitudes/);
});
