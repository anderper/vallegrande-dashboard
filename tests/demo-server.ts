// Local-only preview backend. It never connects to a real Google spreadsheet.
import { createServer } from 'node:http';
import { createScriptHarness } from './apps-script-harness';
import { pdfFixture } from './pdf-fixtures';
import { DOCUMENT_FIELDS } from '../src/lib/registration';

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Solo se permite en desarrollo.');
  const harness = createScriptHarness();
  const { player, load } = await pdfFixture();
  for (const field of DOCUMENT_FIELDS) {
    if (!player[field]) continue;
    const file = await load(field);
    player[field] = harness.post({ action: 'UPLOAD_FILE', fileData: Buffer.from(file.bytes).toString('base64'), mimeType: file.mimeType, fileName: field }).url;
  }
  harness.post({ action: 'CREATE_REGISTRATION', player });
  harness.post({ action: 'CREATE_REGISTRATION', player: { RUT: '9.876.543-3', Nombres: 'INSCRIPCIÓN', Apellido_Paterno: 'PENDIENTE', Apellido_Materno: 'DE PRUEBA', Fecha_Nacimiento: '2012-01-01', Nacionalidad: 'CHILENA', Serie: '1ERA INFANTIL' } });
  createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const result = request.method === 'POST' ? harness.post(JSON.parse(Buffer.concat(chunks).toString())) : harness.get(request.url?.includes('capabilities'));
      response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(result));
    } catch { response.writeHead(400); response.end(JSON.stringify({ success: false, error: 'Solicitud de prueba inválida.' })); }
  }).listen(9876, '127.0.0.1', () => console.log('Backend ficticio: http://127.0.0.1:9876/exec'));
}
void main();
