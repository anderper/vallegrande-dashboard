import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { buildRegistrationPdf } from '../src/lib/registration-pdf';
import { pdfFixture } from './pdf-fixtures';
import { guardianAuthorization, playerAuthorization } from '../src/lib/registration';

for (const minor of [false, true]) test(`genera expediente ${minor ? 'menor' : 'adulto'} con firma y anexos`, async () => {
  const { player, load } = await pdfFixture(minor);
  const originalStatus = player.Status_Validacion;
  const bytes = await buildRegistrationPdf(player, load);
  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), minor ? 4 : 3);
  assert.equal(player.Status_Validacion, originalStatus);
  assert.match(parsed.getTitle() || '', /JUGADOR/);
  if (process.env.PDF_OUTPUT_DIR) { mkdirSync(process.env.PDF_OUTPUT_DIR, { recursive: true }); writeFileSync(join(process.env.PDF_OUTPUT_DIR, `ficha-${minor ? 'menor' : 'adulto'}-prueba.pdf`), bytes); }
});
test('conserva todas las páginas de certificados multipágina', async () => {
  const { player, load } = await pdfFixture(false, 3);
  assert.equal((await PDFDocument.load(await buildRegistrationPdf(player, load))).getPageCount(), 5);
});
test('autorizaciones largas continúan en otra página para no cortar las firmas', async () => {
  const { player, load } = await pdfFixture(true);
  player.Nombres = 'Nombre de prueba '.repeat(10).trim();
  player.Apellido_Paterno = 'Apellido '.repeat(18).trim();
  player.Apellido_Materno = 'Apellido '.repeat(18).trim();
  player.Nombre_Apoderado = 'Apoderado '.repeat(18).trim();
  player.Autorizacion_Texto = playerAuthorization(player); player.Autorizacion_Apoderado_Texto = guardianAuthorization(player);
  assert.equal((await PDFDocument.load(await buildRegistrationPdf(player, load))).getPageCount(), 6);
});
test('no produce un expediente engañosamente completo si falta firma o falla un anexo', async () => {
  const { player, load } = await pdfFixture();
  await assert.rejects(buildRegistrationPdf({ ...player, Firma_Jugador: '' }, load), /incompleta/);
  await assert.rejects(buildRegistrationPdf(player, async field => field === 'Antecedentes_PDF' ? { bytes: new Uint8Array([1,2,3]), mimeType: 'application/pdf' } : load(field)), /certificado PDF/);
  await assert.rejects(buildRegistrationPdf(player, async () => { throw new Error('Drive no responde'); }), /Drive no responde/);
});
