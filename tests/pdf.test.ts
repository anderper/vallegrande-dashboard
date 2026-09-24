import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import fs from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { buildRegistrationPdf } from '../src/lib/registration-pdf';
import { pdfFixture } from './pdf-fixtures';
import { guardianAuthorization, playerAuthorization } from '../src/lib/registration';

test('genera la ficha cuando Node entrega el logo en un buffer con desplazamiento', async context => {
  const { player, load } = await pdfFixture();
  const originalRead = fs.readFileSync;
  context.mock.method(fs, 'readFileSync', (path: unknown, ...options: unknown[]) => {
    const value = Reflect.apply(originalRead, fs, [path, ...options]);
    if (String(path).endsWith('liga-lampa.jpg')) {
      const storage = Buffer.alloc(value.length + 64);
      value.copy(storage, 32);
      return storage.subarray(32, 32 + value.length);
    }
    return value;
  });
  const pdf = await PDFDocument.load(await buildRegistrationPdf(player, load));
  assert.equal(pdf.getPageCount(), 3);
});

for (const minor of [false, true]) test(`genera expediente ${minor ? 'menor' : 'adulto'} con firma y anexos`, async () => {
  const { player, load } = await pdfFixture(minor);
  const originalStatus = player.Status_Validacion;
  const bytes = await buildRegistrationPdf(player, load);
  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), 3);
  assert.equal(player.Status_Validacion, originalStatus);
  assert.match(parsed.getTitle() || '', /JUGADOR/);
  if (process.env.PDF_OUTPUT_DIR) { mkdirSync(process.env.PDF_OUTPUT_DIR, { recursive: true }); writeFileSync(join(process.env.PDF_OUTPUT_DIR, `ficha-${minor ? 'menor' : 'adulto'}-prueba.pdf`), bytes); }
});
test('conserva todas las páginas de certificados multipágina', async () => {
  const { player, load } = await pdfFixture(false, 3);
  assert.equal((await PDFDocument.load(await buildRegistrationPdf(player, load))).getPageCount(), 5);
});
test('menor genera ficha sin consultar antecedentes, incluso si tiene un enlace antiguo', async () => {
  const { player, load } = await pdfFixture(true);
  for (const antecedente of ['', player.Antecedentes_PDF]) {
    const bytes = await buildRegistrationPdf({ ...player, Antecedentes_PDF: antecedente }, async field => {
      assert.notEqual(field, 'Antecedentes_PDF');
      return load(field);
    });
    assert.equal((await PDFDocument.load(bytes)).getPageCount(), 3);
  }
});

for (const extension of ['png', 'jpg']) test(`incluye antecedentes guardados como imagen ${extension} sin recortarlos`, async () => {
  const { player, load } = await pdfFixture();
  const bytes = await buildRegistrationPdf(player, async field => field === 'Antecedentes_PDF'
    ? { bytes: new Uint8Array(readFileSync(`tests/fixtures/antecedentes.${extension}`)), mimeType: extension === 'png' ? 'image/png' : 'image/jpeg' } : load(field));
  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), 3);
  assert.equal(parsed.getPage(2).getWidth(), 595.28);
  if (process.env.PDF_OUTPUT_DIR) writeFileSync(join(process.env.PDF_OUTPUT_DIR, `antecedentes-${extension}-prueba.pdf`), bytes);
});
test('autorizaciones largas continúan en otra página para no cortar las firmas', async () => {
  const { player, load } = await pdfFixture(true);
  player.Nombres = 'Nombre de prueba '.repeat(10).trim();
  player.Apellido_Paterno = 'Apellido '.repeat(18).trim();
  player.Apellido_Materno = 'Apellido '.repeat(18).trim();
  player.Nombre_Apoderado = 'Apoderado '.repeat(18).trim();
  player.Autorizacion_Texto = playerAuthorization(player); player.Autorizacion_Apoderado_Texto = guardianAuthorization(player);
  assert.equal((await PDFDocument.load(await buildRegistrationPdf(player, load))).getPageCount(), 5);
});
test('no produce un expediente engañosamente completo si falta firma o falla un anexo', async () => {
  const { player, load } = await pdfFixture();
  await assert.rejects(buildRegistrationPdf({ ...player, Firma_Jugador: '' }, load), /incompleta/);
  await assert.rejects(buildRegistrationPdf(player, async field => field === 'Antecedentes_PDF' ? { bytes: new Uint8Array([1,2,3]), mimeType: 'application/pdf' } : load(field)), /certificado PDF/);
  await assert.rejects(buildRegistrationPdf(player, async () => { throw new Error('Drive no responde'); }), /Drive no responde/);
});
