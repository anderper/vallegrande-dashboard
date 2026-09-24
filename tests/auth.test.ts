import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createSession, validSession, checkPassword, requireSameOrigin, SESSION_COOKIE, SESSION_SECONDS } from '../src/lib/admin-auth';
import { POST as login } from '../src/app/api/auth/login/route';
import { POST as logout } from '../src/app/api/auth/logout/route';
import { proxy } from '../src/proxy';
import { NextRequest } from 'next/server';
import { createScriptHarness } from './apps-script-harness';

const original = process.env.ADMIN_PASSWORD;
const secret = 'random-test-only-admin-password-12345';
process.env.ADMIN_PASSWORD = secret;
after(() => { if (original) process.env.ADMIN_PASSWORD = original; else delete process.env.ADMIN_PASSWORD; });
const request = (password = secret, origin = 'http://localhost', ip = 'test') => new Request('http://localhost/api/auth/login', { method: 'POST', headers: { origin, 'x-vercel-forwarded-for': ip }, body: JSON.stringify({ password }) });

test('sesiones firmadas caducan, rechazan manipulación y se invalidan al cambiar clave', () => {
  const now = Date.now(), token = createSession(now);
  assert.ok(validSession(token, now));
  assert.equal(validSession(token, now + SESSION_SECONDS * 1000), false);
  assert.equal(validSession(`${token}x`, now), false);
  assert.equal(validSession(undefined), false);
  assert.equal(checkPassword('incorrecta'), false);
  process.env.ADMIN_PASSWORD = secret + '-rotada';
  assert.equal(validSession(token, now), false);
  delete process.env.ADMIN_PASSWORD;
  assert.equal(validSession(token, now), false);
  assert.equal(checkPassword(''), false);
  process.env.ADMIN_PASSWORD = secret;
});
test('login y logout usan cookies HttpOnly y rechazan solicitudes de otro origen', async () => {
  assert.equal((await login(request('incorrecta'))).status, 401);
  assert.equal((await login(request(secret, 'https://otro.example'))).status, 403);
  const response = await login(request());
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
  assert.ok(validSession(cookie.split(';')[0].split('=')[1]));
  const ended = await logout(request());
  assert.match(ended.headers.get('set-cookie')!, /Max-Age=0/);
  assert.equal((await logout(request(secret, 'https://otro.example'))).status, 403);
});
test('dashboard redirige sin sesión y acepta sesión válida', () => {
  const anonymous = proxy(new NextRequest('http://localhost/'));
  assert.equal(anonymous.status, 307);
  assert.equal(anonymous.headers.get('location'), 'http://localhost/login');
  const authenticated = proxy(new NextRequest('http://localhost/', { headers: { cookie: `${SESSION_COOKIE}=${createSession()}` } }));
  assert.equal(authenticated.status, 200);
  assert.match(authenticated.headers.get('cache-control')!, /no-store/);
});
test('valida origen público detrás del servidor y rechaza otros dominios', () => {
  const headers = { host: 'club.example', 'x-forwarded-proto': 'https', origin: 'https://club.example' };
  assert.doesNotThrow(() => requireSameOrigin(new Request('http://localhost/api/players', { headers })));
  assert.throws(() => requireSameOrigin(new Request('http://localhost/api/players', { headers: { ...headers, origin: 'https://otro.example' } })));
});
test('intentos repetidos se limitan y ausencia de clave bloquea login', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await login(request('incorrecta', 'http://localhost', 'repeated'))).status, 401);
  assert.equal((await login(request(secret, 'http://localhost', 'repeated'))).status, 429);
  delete process.env.ADMIN_PASSWORD;
  assert.equal((await login(request())).status, 503);
  process.env.ADMIN_PASSWORD = secret;
});
test('Apps Script con API_TOKEN no permite saltarse el dashboard por su URL directa', () => {
  const script = createScriptHarness(undefined, 'test-backend-token');
  assert.equal(script.get().success, false);
  for (const action of ['LIST_PLAYERS', 'GET_FILE', 'UPLOAD_FILE', 'UPDATE_STATUS', 'CREATE_REGISTRATION']) {
    assert.equal(script.post({ action }).success, false);
    assert.equal(script.post({ action, token: 'wrong' }).success, false);
  }
  assert.equal(script.get(true).registrationVersion, 1);
  assert.ok(Array.isArray(script.post({ action: 'LIST_PLAYERS', token: 'test-backend-token' })));
});
