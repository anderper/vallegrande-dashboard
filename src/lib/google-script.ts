import { DOCUMENT_FIELDS, normalizePlayer, normalizeRut, type DocumentField, type Player } from './registration';

export class ServiceError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
function scriptUrl() {
  const value = process.env.GOOGLE_SCRIPT_URL || process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;
  if (!value) throw new ServiceError('Falta configurar la conexión con Google Sheets.', 503);
  const url = new URL(value);
  const local = process.env.NODE_ENV !== 'production' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (!local && (url.protocol !== 'https:' || url.hostname !== 'script.google.com' || !/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname))) throw new ServiceError('La dirección de Google Apps Script no es válida.', 503);
  return url;
}
export async function scriptRequest(body?: Record<string, unknown>, capabilities = false): Promise<unknown> {
  const url = scriptUrl();
  const token = process.env.GOOGLE_SCRIPT_TOKEN;
  if (capabilities) url.searchParams.set('capabilities', '1');
  // Tokens are sent only in the POST body, never in a URL or a browser bundle.
  const payload = body || (token && !capabilities ? { action: 'LIST_PLAYERS' } : undefined);
  const response = await fetch(url, {
    method: payload ? 'POST' : 'GET',
    ...(payload ? { body: JSON.stringify({ ...payload, ...(token ? { token } : {}) }), headers: { 'Content-Type': 'text/plain;charset=utf-8' } } : {}),
    cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new ServiceError('Google Sheets no respondió correctamente. Intenta nuevamente.');
  let data: unknown;
  try { data = await response.json(); } catch { throw new ServiceError('Google Apps Script no devolvió datos válidos. Revisa la implementación.'); }
  if (data && typeof data === 'object' && 'success' in data && data.success === false) {
    const message = 'error' in data && typeof data.error === 'string' ? data.error : 'No se pudo completar la operación.';
    throw new ServiceError(message, 400);
  }
  return data;
}
export async function listPlayers(): Promise<Player[]> {
  const data = await scriptRequest();
  if (!Array.isArray(data)) throw new ServiceError('La respuesta de Google Sheets no contiene una lista de jugadores.');
  return data.filter(row => row && typeof row === 'object' && row.RUT).map(normalizePlayer);
}
export async function findPlayer(rut: string) {
  const matches = (await listPlayers()).filter(p => normalizeRut(p.RUT) === normalizeRut(rut));
  if (matches.length > 1) throw new ServiceError('Hay RUT duplicados en la planilla. Revisa los registros antes de continuar.', 409);
  if (!matches[0]) throw new ServiceError('No se encontró el jugador.', 404);
  return matches[0];
}
export async function requireRegistrationBackend() {
  const result = await scriptRequest(undefined, true);
  if (!result || typeof result !== 'object' || !('registrationVersion' in result) || result.registrationVersion !== 1) throw new ServiceError('Es necesario actualizar Google Apps Script para guardar firmas y fichas.', 503);
}
export function driveFileId(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com') return null;
    const id = url.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1] || url.searchParams.get('id');
    return id && /^[\w-]{10,}$/.test(id) ? id : null;
  } catch { return null; }
}
export async function documentBytes(player: Player, field: DocumentField) {
  if (!DOCUMENT_FIELDS.includes(field) || !player[field]) throw new ServiceError('No se encontró el documento solicitado.', 404);
  // Apps Script resolves the field from the stored player: never an arbitrary URL or Drive ID supplied by a client.
  const result = await scriptRequest({ action: 'GET_FILE', RUT: player.RUT, field });
  if (!result || typeof result !== 'object' || !('fileData' in result) || typeof result.fileData !== 'string' || !('mimeType' in result) || typeof result.mimeType !== 'string') throw new ServiceError('No se pudo leer el documento desde Drive.');
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(result.mimeType)) throw new ServiceError('El documento guardado tiene un formato no admitido.', 422);
  if (result.fileData.length > 20 * 1024 * 1024) throw new ServiceError('El documento supera el tamaño permitido.', 413);
  return { bytes: new Uint8Array(Buffer.from(result.fileData, 'base64')), mimeType: result.mimeType };
}
export function errorResponse(error: unknown) {
  return Response.json({ success: false, error: error instanceof ServiceError ? error.message : 'No se pudo conectar con el servidor. Intenta nuevamente.' }, { status: error instanceof ServiceError ? error.status : 502, headers: { 'Cache-Control': 'no-store' } });
}
