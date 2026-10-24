import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { checkAuth, renderSimulator } from '../src/simulator.ts';
import { failedStatuses, handleEvent, verifyChallenge, type Io } from '../src/webhook.ts';

const env = { WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: '1', WHATSAPP_APP_SECRET: 's3cret', WHATSAPP_VERIFY_TOKEN: 'v3rify' } as NodeJS.ProcessEnv;
const sign = (b: string) => 'sha256=' + createHmac('sha256', 's3cret').update(b).digest('hex');
const payload = (id: string, body: string) => JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from: '18095550100', id, type: 'text', text: { body } }] } }] }] });
const fakeIo = (sent: { to: string; text: string }[], over: Partial<Io> = {}): Io => ({
  ensure: async () => {}, markRead: async () => {}, deps: async () => ({ save: async () => null, mark: async () => {}, notify: async () => {} }),
  send: async (to, out) => { sent.push({ to, text: JSON.stringify(out) }); }, ...over,
});

test('verify challenge needs the right token', () => {
  const ok = verifyChallenge(new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': 'v3rify', 'hub.challenge': '123' }), env);
  assert.deepEqual([ok.status, ok.body], [200, '123']);
  assert.equal(verifyChallenge(new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '1' }), env).status, 403);
  assert.equal(verifyChallenge(new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': '' }), {} as NodeJS.ProcessEnv).status, 403);
});

test('POST: rejects bad signature/JSON, replies in the background, dedupes redelivery', async () => {
  const sent: { to: string; text: string }[] = [];
  const raw = payload('wamid.t1', 'cardiólogo en Santo Domingo');
  assert.equal(handleEvent(raw, null, env, fakeIo(sent)).status, 401);
  assert.equal(handleEvent('{', sign('{'), env, fakeIo(sent)).status, 400);
  assert.equal(handleEvent(raw, sign(raw), {} as NodeJS.ProcessEnv, fakeIo(sent)).status, 503);
  const r = handleEvent(raw, sign(raw), env, fakeIo(sent));
  assert.equal(r.status, 200); await r.done;
  assert.equal(sent.length, 1); assert.equal(sent[0].to, '18095550100'); assert.match(sent[0].text, /d:/);
  await handleEvent(raw, sign(raw), env, fakeIo(sent)).done; // redelivered by Meta
  assert.equal(sent.length, 1);
});

test('POST: catalog failure tells the patient instead of staying silent', async () => {
  const sent: { to: string; text: string }[] = [];
  const raw = payload('wamid.t2', 'hola');
  await handleEvent(raw, sign(raw), env, fakeIo(sent, { ensure: async () => { throw new Error('db down'); } })).done;
  assert.match(sent[0].text, /problemas técnicos/);
});

test('simulator: disabled without password, Basic auth otherwise, escapes output', () => {
  assert.equal(checkAuth(null, {} as NodeJS.ProcessEnv)?.status, 404);
  const e = { ADMIN_PASSWORD: 'pw', ADMIN_USER: 'me' } as NodeJS.ProcessEnv;
  assert.equal(checkAuth(null, e)?.status, 401);
  assert.equal(checkAuth('Basic ' + Buffer.from('me:wrong').toString('base64'), e)?.status, 401);
  assert.equal(checkAuth('Basic ' + Buffer.from('me:pw').toString('base64'), e), null);
  const html = renderSimulator(new URLSearchParams({ q: '<script>alert(1)</script>' }), e).body;
  assert.doesNotMatch(html, /<script>alert/);
});

test('failed delivery receipts are reduced to Meta\'s reason', () => {
  const body = { entry: [{ changes: [{ value: { statuses: [
    { status: 'delivered', recipient_id: '18095550100' },
    { status: 'failed', recipient_id: '18095550100', errors: [{ code: 131031, title: 'Business Account locked', message: 'x' }] },
  ] } }] }] };
  assert.deepEqual(failedStatuses(body), [{ code: 131031, title: 'Business Account locked' }]);
  assert.deepEqual(failedStatuses({}), []);
});
