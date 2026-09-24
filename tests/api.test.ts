import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { GET, POST } from '../src/app/api/players/route';
import { GET as pdfGET } from '../src/app/api/players/ficha/route';
import { GET as documentGET } from '../src/app/api/players/document/route';
import { createScriptHarness } from './apps-script-harness';
import { pdfFixture } from './pdf-fixtures';
import { PDFDocument } from 'pdf-lib';
import { DOCUMENT_FIELDS } from '../src/lib/registration';
import { createSession, SESSION_COOKIE } from '../src/lib/admin-auth';

const originalFetch = globalThis.fetch;
const originalUrl = process.env.GOOGLE_SCRIPT_URL;
const originalPassword = process.env.ADMIN_PASSWORD;
process.env.ADMIN_PASSWORD = 'test-only-admin-password-never-deploy';
process.env.GOOGLE_SCRIPT_URL = 'http://127.0.0.1:9876/exec';
const harness = createScriptHarness();
globalThis.fetch = async (input, options) => {
  assert.match(String(input), /^http:\/\/127\.0\.0\.1:9876\/exec/);
  const data = options?.method === 'POST' ? harness.post(JSON.parse(String(options.body))) : harness.get(String(input).includes('capabilities'));
  return Response.json(data);
};
after(() => { globalThis.fetch = originalFetch; if (originalUrl) process.env.GOOGLE_SCRIPT_URL = originalUrl; else delete process.env.GOOGLE_SCRIPT_URL; if (originalPassword) process.env.ADMIN_PASSWORD = originalPassword; else delete process.env.ADMIN_PASSWORD; });
const adminHeaders = () => ({ cookie: `${SESSION_COOKIE}=${createSession()}` });
const request = (body: object, admin = true) => new Request('http://localhost/api/players', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...(admin ? adminHeaders() : {}) }, body: JSON.stringify(body) });

test('API guarda, relee, genera PDF y cambia/revierte estado con el script real simulado', async () => {
  const { player, load } = await pdfFixture();
  for (const field of DOCUMENT_FIELDS) {
    if (!player[field]) continue;
    const file = await load(field);
    const uploaded = await POST(request({ action: 'UPLOAD_FILE', mimeType: file.mimeType, fileData: Buffer.from(file.bytes).toString('base64'), fileName: field }));
    assert.equal(uploaded.status, 200); player[field] = (await uploaded.json()).url;
  }
  const result = await POST(request({ action: 'CREATE_REGISTRATION', player, complete: true, requestId: 'integration-1' }));
  assert.equal(result.status, 200); assert.equal((await result.json()).player.Status_Validacion, 'POR FEDERAR');
  const loaded = await GET(new Request('http://localhost/api/players', { headers: adminHeaders() })); assert.equal((await loaded.json())[0].Foto_Jugador, player.Foto_Jugador);
  const pdf = await pdfGET(new Request(`http://localhost/api/players/ficha?rut=${player.RUT}`, { headers: adminHeaders() })); assert.equal(pdf.status, 200);
  assert.equal((await PDFDocument.load(await pdf.arrayBuffer())).getPageCount(), 3);
  assert.equal(harness.get()[0].Status_Validacion, 'POR FEDERAR');
  for (const status of ['FEDERADO', 'POR FEDERAR']) { const changed = await POST(request({ action: 'UPDATE_STATUS', RUT: player.RUT, status })); assert.equal(changed.status, 200); assert.equal((await changed.json()).player.Status_Validacion, status); }
  const invalid = await documentGET(new Request(`http://localhost/api/players/document?rut=${player.RUT}&field=Observaciones`, { headers: adminHeaders() })); assert.equal(invalid.status, 400);
});
test('sin sesión bloquea datos, documentos, PDF, estados, edición e importación', async () => {
  for (const handler of [GET, documentGET, pdfGET]) assert.equal((await handler(new Request('http://localhost/api/players'))).status, 401);
  for (const action of ['UPDATE_STATUS', 'UPDATE_REGISTRATION', 'BULK_CREATE', 'GET_FILE', 'LIST_PLAYERS']) assert.equal((await POST(request({ action }, false))).status, 401);
  assert.equal((await GET(new Request('http://localhost/api/players?capabilities=1'))).status, 200);
});
test('registro público exige ficha completa y no expone registros en respuestas o reintentos', async () => {
  assert.equal((await POST(request({ action: 'CREATE_REGISTRATION', complete: false, player: { Nombres: 'Prueba', RUT: '9876543-3' } }, false))).status, 400);
  const { player, load } = await pdfFixture();
  player.RUT = '9.876.543-3';
  const { playerAuthorization } = await import('../src/lib/registration');
  player.Autorizacion_Texto = playerAuthorization(player);
  const file = await load('Foto_Jugador');
  assert.equal((await POST(request({ action: 'UPLOAD_FILE', mimeType: file.mimeType, fileData: Buffer.from(file.bytes).toString('base64'), fileName: 'test.png' }, false))).status, 200);
  for (let i = 0; i < 2; i++) {
    const result = await POST(request({ action: 'CREATE_REGISTRATION', player, requestId: 'public-retry' }, false));
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { success: true });
  }
});
test('API rechaza archivos falsos, acciones desconocidas e inscripción incompleta', async () => {
  assert.equal((await POST(request({ action: 'DELETE_ALL' }))).status, 400);
  assert.equal((await POST(request({ action: 'UPLOAD_FILE', fileData: 'AAAA', mimeType: 'image/png' }))).status, 400);
  assert.equal((await POST(request({ action: 'CREATE_REGISTRATION', player: { RUT: '12345678-5', Nombres: 'Prueba' }, complete: true }))).status, 400);
});
