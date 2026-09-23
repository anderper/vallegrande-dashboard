import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { GET, POST } from '../src/app/api/players/route';
import { GET as pdfGET } from '../src/app/api/players/ficha/route';
import { GET as documentGET } from '../src/app/api/players/document/route';
import { createScriptHarness } from './apps-script-harness';
import { pdfFixture } from './pdf-fixtures';
import { PDFDocument } from 'pdf-lib';
import { DOCUMENT_FIELDS } from '../src/lib/registration';

const originalFetch = globalThis.fetch;
const originalUrl = process.env.GOOGLE_SCRIPT_URL;
process.env.GOOGLE_SCRIPT_URL = 'http://127.0.0.1:9876/exec';
const harness = createScriptHarness();
globalThis.fetch = async (input, options) => {
  assert.match(String(input), /^http:\/\/127\.0\.0\.1:9876\/exec/);
  const data = options?.method === 'POST' ? harness.post(JSON.parse(String(options.body))) : harness.get(String(input).includes('capabilities'));
  return Response.json(data);
};
after(() => { globalThis.fetch = originalFetch; if (originalUrl) process.env.GOOGLE_SCRIPT_URL = originalUrl; else delete process.env.GOOGLE_SCRIPT_URL; });
const request = (body: object) => new Request('http://localhost/api/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

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
  const loaded = await GET(new Request('http://localhost/api/players')); assert.equal((await loaded.json())[0].Foto_Jugador, player.Foto_Jugador);
  const pdf = await pdfGET(new Request(`http://localhost/api/players/ficha?rut=${player.RUT}`)); assert.equal(pdf.status, 200);
  assert.equal((await PDFDocument.load(await pdf.arrayBuffer())).getPageCount(), 3);
  assert.equal(harness.get()[0].Status_Validacion, 'POR FEDERAR');
  for (const status of ['FEDERADO', 'POR FEDERAR']) { const changed = await POST(request({ action: 'UPDATE_STATUS', RUT: player.RUT, status })); assert.equal(changed.status, 200); assert.equal((await changed.json()).player.Status_Validacion, status); }
  const invalid = await documentGET(new Request(`http://localhost/api/players/document?rut=${player.RUT}&field=Observaciones`)); assert.equal(invalid.status, 400);
});
test('API rechaza archivos falsos, acciones desconocidas e inscripción incompleta', async () => {
  assert.equal((await POST(request({ action: 'DELETE_ALL' }))).status, 400);
  assert.equal((await POST(request({ action: 'UPLOAD_FILE', fileData: 'AAAA', mimeType: 'image/png' }))).status, 400);
  assert.equal((await POST(request({ action: 'CREATE_REGISTRATION', player: { RUT: '12345678-5', Nombres: 'Prueba' }, complete: true }))).status, 400);
});
