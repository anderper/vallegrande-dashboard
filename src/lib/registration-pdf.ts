import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fullName, isMinor, missingRequirements, type DocumentField, type Player } from './registration';

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
  // pdf-lib reads the underlying ArrayBuffer from offset zero. Copy pooled Node
  // buffers so the JPEG header is at zero in every runtime, including Vercel.
  const leagueLogo = await pdf.embedJpg(new Uint8Array(readFileSync(join(process.cwd(), 'public', 'liga-lampa.jpg'))));
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
  const centerText = (value: string, top: number, size: number) => text(page, value, (page.getWidth() - bold.widthOfTextAtSize(value, size)) / 2, top, size, bold);
  page.drawImage(leagueLogo, { x: (page.getWidth() - 108) / 2, y: page.getHeight() - 145, width: 108, height: 108 });
  centerText('TRÁMITE DE INSCRIPCIÓN JUGADOR', 155, 16);
  centerText('LIGA DE FÚTBOL COMUNAL LAMPA', 179, 16);
  function originalSection(label: string, top: number) {
    text(page, label,  60, top, 9, bold);
    line(page, 60, top + 11, bold.widthOfTextAtSize(label, 9));
  }
  function originalField(label: string, value: string, labelX: number, x: number, top: number, width: number) {
    text(page, label, labelX, top + 5, 8, regular, x - labelX - 5);
    page.drawRectangle({ x, y: page.getHeight() - top - 21, width, height: 21, borderWidth: 0.6, borderColor: rgb(0.1, 0.1, 0.1) });
    text(page, value, x + 6, top + 5, 10, regular, width - 12);
  }
  originalSection('DATOS DEL JUGADOR', 230);
  originalField('APELLIDO PATERNO', player.Apellido_Paterno, 60, 180, 254, 205);
  originalField('APELLIDO MATERNO', player.Apellido_Materno, 60, 180, 282, 205);
  originalField('NOMBRES', player.Nombres, 60, 180, 310, 205);
  originalField('NACIONALIDAD', player.Nacionalidad, 60, 180, 338, 205);
  page.drawRectangle({ x: 397, y: page.getHeight() - 359, width: 100, height: 105, borderWidth: 0.6, borderColor: rgb(0.1, 0.1, 0.1), color: rgb(1, 1, 1) });
  await picture(page, 'Foto_Jugador', 399, 256, 96, 101);
  originalField('FECHA DE NACIMIENTO', date(player.Fecha_Nacimiento), 60, 180, 369, 110);
  originalField('RUT', player.RUT, 340, 371, 369, 144);
  originalSection('DATOS DE LA INSCRIPCIÓN', 411);
  originalField('FECHA DE INSCRIPCIÓN', date(player.Fecha_Inscripcion || player.Fecha_Registro), 60, 180, 434, 110);
  originalField('CLUB', 'VALLE GRANDE FC', 310, 342, 434, 173);
  originalSection('TIPO DE INSCRIPCIÓN', 470);
  const options = [
    { type: 'PASE INTERNO', label: 'PASE INTERNO', x: 60, box: 143, top: 496 },
    { type: 'INSC ADULTO', label: 'INSC ADULTO', x: 175, box: 253, top: 496 },
    { type: 'INSC INF/JUV', label: 'INSC INF/JUV', x: 286, box: 365, top: 496 },
    { type: 'EXTRANJERO INT', label: 'EXTRANJERO INT', x: 400, box: 497, top: 496 },
    { type: 'PASE ADULTO CONCEDIDO', label: 'PASE ADULTO CONCEDIDO', x: 60, box: 143, top: 526 },
    { type: 'PASE INTERNO INF CONCEDIDO', label: 'PASE INTERNO INF CONCEDIDO', x: 175, box: 275, top: 526 },
  ];
  for (const option of options) {
    paragraph(page, option.label, option.x, option.top + 3, option.box - option.x - 5, 8);
    page.drawRectangle({ x: option.box, y: page.getHeight() - option.top - 20, width: 16, height: 20, borderWidth: 0.6, color: rgb(1, 1, 1) });
    if (player.Tipo_Inscripcion === option.type) text(page, 'X', option.box + 4, option.top + 4, 10, bold);
  }
  originalSection('DOCUMENTACIÓN', 566);
  [{ label: 'CÉDULA DE IDENTIDAD', x: 60, box: 180, checked: true }, { label: 'CERTIFICADO ANTEC.', x: 232, box: 344, checked: true }, { label: 'AUTORIZACIÓN TUTOR', x: 391, box: 507, checked: isMinor(player) }].forEach(item => {
    text(page, item.label, item.x, 599, 8, regular, item.box - item.x - 5);
    page.drawRectangle({ x: item.box, y: page.getHeight() - 613, width: 27, height: 21, borderWidth: 0.6, color: rgb(1, 1, 1) });
    if (item.checked) text(page, 'X', item.box + 10, 596, 10);
  });
  await picture(page, 'Firma_Jugador', 60, 669, 140, 60);
  ['FIRMA JUGADOR', 'FIRMA Y TIMBRE CLUB', 'FIRMA Y TIMBRE LDFCL'].forEach((label, index) => { const x = 60 + index * 162; line(page, x, 737, 144); text(page, label, x, 743, 8, regular, 144); });

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
  if (['image/png', 'image/jpeg'].includes(certificate.mimeType)) {
    const certificatePage = pdf.addPage([595.28, 841.89]);
    header(certificatePage, 'CERTIFICADO DE ANTECEDENTES');
    await picture(certificatePage, 'Antecedentes_PDF', 45, 140, 505, 656);
  } else if (certificate.mimeType === 'application/pdf') {
  let attached;
  try { attached = await PDFDocument.load(certificate.bytes); }
  catch { throw new Error('No se pudo abrir el certificado PDF. Comprueba que no esté dañado ni protegido con contraseña.'); }
  if (attached.getPageCount() < 1 || attached.getPageCount() > 20) throw new Error('El certificado debe contener entre 1 y 20 páginas.');
  for (const copied of await pdf.copyPages(attached, attached.getPageIndices())) pdf.addPage(copied);
  } else throw new Error('El certificado de antecedentes debe ser PDF o imagen JPG o PNG.');

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
