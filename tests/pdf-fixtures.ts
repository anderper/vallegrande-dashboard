import { readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { AUTHORIZATION_VERSION, guardianAuthorization, playerAuthorization, type Player, type DocumentField } from '../src/lib/registration';

export async function pdfFixture(minor = false, certificatePages = 1) {
  const player: Player = { RUT: '12.345.678-5', Nombres: 'JUGADOR', Apellido_Paterno: 'DE', Apellido_Materno: 'PRUEBA', Fecha_Nacimiento: minor ? '2012-01-01' : '2000-01-01', Fecha_Inscripcion: '2026-09-23', Fecha_Registro: '2026-09-23T15:00:00Z', Nacionalidad: 'CHILENA', Serie: minor ? '1ERA INFANTIL' : '1ERA ADULTA', Tipo_Inscripcion: minor ? 'INSC INF/JUV' : 'INSC ADULTO', Status_Validacion: 'POR FEDERAR', Fecha_Firma: '2026-09-23T15:00:00Z', Autorizacion_Version: AUTHORIZATION_VERSION, Nombre_Apoderado: 'APODERADO DE PRUEBA', RUT_Apoderado: '12.345.678-5', Fecha_Firma_Apoderado: '2026-09-23T15:00:00Z' };
  player.Autorizacion_Texto = playerAuthorization(player);
  player.Autorizacion_Apoderado_Texto = guardianAuthorization(player);
  const pdf = await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < certificatePages; i++) {
    const page = pdf.addPage([595.28,841.89]);
    page.drawText('CERTIFICADO FICTICIO', { x: 50, y: 730, size: 24, font });
    page.drawText('SOLO PARA PRUEBAS - SIN VALIDEZ', { x: 50, y: 680, size: 16, font });
    page.drawText(`Página de prueba ${i + 1}`, { x: 50, y: 620, size: 12, font });
  }
  const certificate = await pdf.save();
  const load = async (field: DocumentField) => ({ bytes: field === 'Antecedentes_PDF' ? certificate : new Uint8Array(readFileSync(`tests/fixtures/${field === 'Foto_Jugador' ? 'foto' : field.startsWith('Firma') ? 'firma' : 'cedula'}.png`)), mimeType: field === 'Antecedentes_PDF' ? 'application/pdf' : 'image/png' });
  for (const field of ['Foto_Cedula_Frontal','Foto_Cedula_Reverso','Antecedentes_PDF','Foto_Jugador','Firma_Jugador', ...(minor ? ['Foto_Cedula_Padre_Frontal','Foto_Cedula_Padre_Reverso','Firma_Apoderado'] : [])]) player[field] = `https://drive.google.com/file/d/fake_${field}_123/view`;
  return { player, load };
}
