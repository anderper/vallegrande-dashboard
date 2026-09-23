import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { fullName, isMinor, missingRequirements, REGISTRATION_TYPES, type DocumentField, type Player } from './registration';

type Attachment = { bytes: Uint8Array; mimeType: string };
export type AttachmentLoader = (field: DocumentField) => Promise<Attachment>;

export async function buildRegistrationPdf(player: Player, load: AttachmentLoader) {
  const missing = missingRequirements(player);
  if (missing.length) throw new Error(`Ficha incompleta: ${missing.join(', ')}.`);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Ficha de inscripción - ${fullName(player)}`);
  pdf.setAuthor('Club Deportivo Valle Grande FC');
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cache = new Map<DocumentField, Attachment>();
  async function attachment(field: DocumentField) {
    if (!cache.has(field)) cache.set(field, await load(field));
    return cache.get(field)!;
  }
  const clean = (text: string) => [...String(text || '').normalize('NFC')].map(char => {
    try { regular.encodeText(char); return char; } catch { return '?'; }
  }).join('').replace(/[\r\n\t]/g, ' ');
  function text(page: PDFPage, value: string, x: number, top: number, size = 10, font: PDFFont = regular, maxWidth = 510) {
    const content = clean(value);
    const fitted = Math.min(size, maxWidth / Math.max(1, font.widthOfTextAtSize(content, 1)));
    page.drawText(content, { x, y: page.getHeight() - top - fitted, size: fitted, font, color: rgb(0.08, 0.1, 0.12) });
  }
  function paragraph(page: PDFPage, value: string, x: number, top: number, width: number, size = 11, draw = true) {
    const words = clean(value).split(' ').flatMap(word => {
      const parts: string[] = []; let part = '';
      for (const char of word) { if (part && regular.widthOfTextAtSize(part + char, size) > width) { parts.push(part); part = ''; } part += char; }
      return [...parts, part];
    }); let line = ''; let cursor = top;
    for (const word of words) {
      if (line && regular.widthOfTextAtSize(`${line} ${word}`, size) > width) { if (draw) text(page, line, x, cursor, size); cursor += size * 1.5; line = word; }
      else line = line ? `${line} ${word}` : word;
    }
    if (line) { if (draw) text(page, line, x, cursor, size); cursor += size * 1.5; }
    return cursor;
  }
  function line(page: PDFPage, x: number, top: number, width: number) { page.drawLine({ start: { x, y: page.getHeight() - top }, end: { x: x + width, y: page.getHeight() - top }, thickness: 0.6, color: rgb(0.25, 0.3, 0.3) }); }
  function section(page: PDFPage, label: string, top: number) { text(page, label, 45, top, 10, bold); line(page, 45, top + 18, 505); }
  function field(page: PDFPage, label: string, value: string, x: number, top: number, width: number) {
    text(page, label.toUpperCase(), x, top, 8, bold, width);
    page.drawRectangle({ x, y: page.getHeight() - top - 39, width, height: 25, borderWidth: 0.6, borderColor: rgb(0.45, 0.48, 0.5) });
    text(page, value, x + 6, top + 20, 11, regular, width - 12);
  }
  async function picture(page: PDFPage, key: DocumentField, x: number, top: number, width: number, height: number) {
    const file = await attachment(key);
    if (!['image/png', 'image/jpeg'].includes(file.mimeType)) throw new Error(`El documento ${key} debe ser una imagen PNG o JPG.`);
    let embedded;
    try { embedded = file.mimeType === 'image/png' ? await pdf.embedPng(file.bytes) : await pdf.embedJpg(file.bytes); }
    catch { throw new Error(`No se pudo abrir la imagen ${key}. Reemplázala antes de generar la ficha.`); }
    const scaled = embedded.scaleToFit(width, height);
    page.drawImage(embedded, { x: x + (width - scaled.width) / 2, y: page.getHeight() - top - height + (height - scaled.height) / 2, width: scaled.width, height: scaled.height });
  }
  function date(value: string) { const part = value?.slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(part || '') ? part.split('-').reverse().join('/') : ''; }
  function header(page: PDFPage, title: string) {
    text(page, 'LIGA DE FÚTBOL COMUNAL LAMPA', 45, 42, 19, bold, 505);
    text(page, title, 45, 72, 13, bold);
    text(page, 'CLUB DEPORTIVO VALLE GRANDE FC', 45, 97, 10);
    line(page, 45, 121, 505);
  }
  const page = pdf.addPage([595.28, 841.89]);
  header(page, 'TRÁMITE DE INSCRIPCIÓN DE JUGADOR');
  section(page, 'DATOS DEL JUGADOR', 143);
  field(page, 'Apellido paterno', player.Apellido_Paterno, 45, 177, 338);
  field(page, 'Apellido materno', player.Apellido_Materno, 45, 225, 338);
  field(page, 'Nombres', player.Nombres, 45, 273, 338);
  await picture(page, 'Foto_Jugador', 408, 177, 120, 150);
  field(page, 'Nacionalidad', player.Nacionalidad, 45, 321, 180);
  field(page, 'Fecha de nacimiento', date(player.Fecha_Nacimiento), 237, 321, 146);
  field(page, 'RUT', player.RUT, 395, 337, 155);
  section(page, 'DATOS DE LA INSCRIPCIÓN', 394);
  field(page, 'Fecha de inscripción', date(player.Fecha_Inscripcion || player.Fecha_Registro), 45, 425, 145);
  field(page, 'Club', 'VALLE GRANDE FC', 203, 425, 175);
  field(page, 'Serie', player.Serie, 391, 425, 159);
  section(page, 'TIPO DE INSCRIPCIÓN', 484);
  REGISTRATION_TYPES.forEach((type, index) => {
    const x = 45 + (index % 3) * 172, top = 517 + Math.floor(index / 3) * 30;
    page.drawRectangle({ x, y: page.getHeight() - top - 13, width: 13, height: 13, borderWidth: 0.7, borderColor: rgb(0.1, 0.1, 0.1), color: rgb(1, 1, 1) });
    if (player.Tipo_Inscripcion === type) text(page, 'X', x + 3, top + 1, 10, bold);
    text(page, type, x + 20, top + 2, 8, regular, 143);
  });
  section(page, 'DOCUMENTACIÓN ADJUNTA', 587);
  ['Cédula de identidad', 'Certificado de antecedentes', ...(isMinor(player) ? ['Autorización del apoderado'] : [])].forEach((label, index) => text(page, `X  ${label}`, 45 + index * 172, 619, 9, regular, 163));
  await picture(page, 'Firma_Jugador', 45, 670, 153, 65);
  ['FIRMA JUGADOR', 'FIRMA Y TIMBRE CLUB', 'FIRMA Y TIMBRE LDFCL'].forEach((label, index) => { const x = 45 + index * 175; line(page, x, 741, 155); text(page, label, x, 751, 8, bold, 155); });

  const identity = pdf.addPage([595.28, 841.89]);
  header(identity, 'IDENTIFICACIÓN Y AUTORIZACIÓN DEL JUGADOR');
  await picture(identity, 'Foto_Cedula_Frontal', 70, 143, 455, 235);
  await picture(identity, 'Foto_Cedula_Reverso', 70, 394, 455, 235);
  let authorizationPage = identity, authorizationTop = 648;
  if (paragraph(identity, player.Autorizacion_Texto, 45, authorizationTop, 505, 10, false) > 702) {
    text(identity, 'La autorización firmada continúa en la página siguiente.', 45, 660, 10);
    authorizationPage = pdf.addPage([595.28, 841.89]); header(authorizationPage, 'AUTORIZACIÓN DEL JUGADOR'); authorizationTop = 155;
  }
  const after = paragraph(authorizationPage, player.Autorizacion_Texto, 45, authorizationTop, 505, 10);
  await picture(authorizationPage, 'Firma_Jugador', 200, after + 7, 190, 50);
  line(authorizationPage, 190, after + 61, 210); text(authorizationPage, 'Firma del jugador', 245, after + 66, 9);
  text(authorizationPage, `Autorización registrada: ${date(player.Fecha_Firma)} | ${player.Autorizacion_Version}`, 45, 796, 8);

  const certificate = await attachment('Antecedentes_PDF');
  if (certificate.mimeType !== 'application/pdf') throw new Error('El certificado de antecedentes debe ser un PDF.');
  let attached;
  try { attached = await PDFDocument.load(certificate.bytes); }
  catch { throw new Error('No se pudo abrir el certificado PDF. Comprueba que no esté dañado ni protegido con contraseña.'); }
  if (attached.getPageCount() < 1 || attached.getPageCount() > 20) throw new Error('El certificado debe contener entre 1 y 20 páginas.');
  for (const copied of await pdf.copyPages(attached, attached.getPageIndices())) pdf.addPage(copied);

  if (isMinor(player)) {
    const guardian = pdf.addPage([595.28, 841.89]);
    header(guardian, 'IDENTIFICACIÓN Y AUTORIZACIÓN DEL APODERADO');
    await picture(guardian, 'Foto_Cedula_Padre_Frontal', 70, 143, 455, 225);
    await picture(guardian, 'Foto_Cedula_Padre_Reverso', 70, 383, 455, 225);
    let guardianPage = guardian, guardianTop = 625;
    if (paragraph(guardian, player.Autorizacion_Apoderado_Texto, 45, guardianTop, 505, 10, false) > 705) {
      text(guardian, 'La autorización firmada continúa en la página siguiente.', 45, 640, 10);
      guardianPage = pdf.addPage([595.28, 841.89]); header(guardianPage, 'AUTORIZACIÓN DEL APODERADO'); guardianTop = 155;
    }
    const end = paragraph(guardianPage, player.Autorizacion_Apoderado_Texto, 45, guardianTop, 505, 10);
    await picture(guardianPage, 'Firma_Apoderado', 200, end + 6, 190, 48);
    line(guardianPage, 190, end + 58, 210); text(guardianPage, 'Firma del apoderado', 239, end + 64, 9);
    text(guardianPage, `Autorización registrada: ${date(player.Fecha_Firma_Apoderado)}`, 45, 796, 8);
  }
  return pdf.save();
}
