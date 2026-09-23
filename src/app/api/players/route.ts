import { automaticStatus, DOCUMENT_FIELDS, missingRequirements, normalizePlayer, STATUSES, statusOf } from '@/lib/registration';
import { driveFileId, errorResponse, findPlayer, listPlayers, requireRegistrationBackend, scriptRequest, ServiceError } from '@/lib/google-script';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    if (new URL(request.url).searchParams.has('capabilities')) {
      await requireRegistrationBackend();
      return Response.json({ registrationVersion: 1 });
    }
    return Response.json(await listPlayers(), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length')) > 3.8 * 1024 * 1024) throw new ServiceError('El archivo supera el tamaño permitido.', 413);
    const text = await request.text();
    if (text.length > 3.8 * 1024 * 1024) throw new ServiceError('La solicitud supera el tamaño permitido.', 413);
    let body;
    try { body = JSON.parse(text); } catch { throw new ServiceError('La solicitud no contiene JSON válido.', 400); }
    if (!body || typeof body !== 'object') throw new ServiceError('Solicitud inválida.', 400);
    await requireRegistrationBackend();
    if (body.action === 'UPLOAD_FILE') {
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(body.mimeType) || typeof body.fileData !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.fileData)) throw new ServiceError('Formato de archivo no admitido.', 400);
      const buffer = Buffer.from(body.fileData, 'base64');
      const valid = body.mimeType === 'application/pdf' ? buffer.subarray(0, 5).toString() === '%PDF-' : body.mimeType === 'image/png' ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : buffer[0] === 255 && buffer[1] === 216;
      if (!valid || buffer.length > 2.5 * 1024 * 1024 || buffer.length < 10) throw new ServiceError('Archivo inválido o mayor a 2,5 MB.', 400);
      const fileName = String(body.fileName || 'documento').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 160);
      return Response.json(await scriptRequest({ action: 'UPLOAD_FILE', fileData: body.fileData, mimeType: body.mimeType, fileName }));
    }
    if (body.action === 'CREATE_REGISTRATION' || body.action === 'UPDATE_REGISTRATION') {
      if (!body.player || typeof body.player !== 'object' || Array.isArray(body.player)) throw new ServiceError('Datos del jugador inválidos.', 400);
      if (Object.values(body.player).some(v => typeof v !== 'string' || v.length > 2500)) throw new ServiceError('Hay campos inválidos o demasiado largos.', 400);
      const player = normalizePlayer(body.player);
      for (const field of ['Nombres', 'Apellido_Paterno', 'Apellido_Materno', 'Nombre_Apoderado', 'Nacionalidad', 'Serie']) if (player[field]?.length > 180) throw new ServiceError(`El campo ${field} es demasiado largo.`, 400);
      if (!player.RUT?.trim() || !player.Nombres?.trim()) throw new ServiceError('El nombre y el RUT son obligatorios.', 400);
      for (const field of DOCUMENT_FIELDS) if (player[field] && !driveFileId(player[field])) throw new ServiceError('Los documentos deben estar guardados en Google Drive.', 400);
      const existing = body.action === 'UPDATE_REGISTRATION' ? await findPlayer(String(body.originalRut || '')) : undefined;
      if (existing && existing.RUT !== player.RUT) throw new ServiceError('No se puede cambiar el RUT de un registro existente.', 400);
      player.Status_Validacion = existing ? statusOf(existing) : 'PENDIENTE';
      player.Status_Validacion = automaticStatus(player);
      if (body.complete && missingRequirements(player).length) throw new ServiceError(`Falta completar: ${missingRequirements(player).join(', ')}.`, 400);
      const result = await scriptRequest({ action: body.action, player, originalRut: body.originalRut, requestId: typeof body.requestId === 'string' ? body.requestId.slice(0, 80) : undefined });
      if (!result || typeof result !== 'object' || !('player' in result)) throw new ServiceError('No se pudo verificar que la ficha quedó guardada.');
      return Response.json(result);
    }
    if (body.action === 'UPDATE_STATUS') {
      if (!STATUSES.includes(body.status)) throw new ServiceError('Estado inválido.', 400);
      const player = await findPlayer(String(body.RUT || ''));
      if (body.status === 'POR FEDERAR' && missingRequirements(player).length) throw new ServiceError('Completa la ficha antes de marcarla como por federar.', 400);
      return Response.json(await scriptRequest({ action: 'UPDATE_STATUS', RUT: player.RUT, status: body.status }));
    }
    if (body.action === 'BULK_CREATE') {
      if (!Array.isArray(body.players) || body.players.length < 1 || body.players.length > 500) throw new ServiceError('Importa entre 1 y 500 jugadores por archivo.', 400);
      return Response.json(await scriptRequest({ action: 'BULK_CREATE', players: body.players }));
    }
    throw new ServiceError('Acción no permitida.', 400);
  } catch (error) { return errorResponse(error); }
}
