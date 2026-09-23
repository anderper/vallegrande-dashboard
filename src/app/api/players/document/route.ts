import { documentBytes, errorResponse, findPlayer, ServiceError } from '@/lib/google-script';
import { DOCUMENT_FIELDS, type DocumentField } from '@/lib/registration';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const field = url.searchParams.get('field') as DocumentField;
    if (!DOCUMENT_FIELDS.includes(field)) throw new ServiceError('Documento no permitido.', 400);
    const player = await findPlayer(url.searchParams.get('rut') || '');
    const file = await documentBytes(player, field);
    if (file.bytes.length > 4 * 1024 * 1024) throw new ServiceError('Este documento supera 4 MB. Sube una versión de menor tamaño para poder editarlo.', 413);
    return new Response(file.bytes as BodyInit, { headers: { 'Content-Type': file.mimeType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return errorResponse(error); }
}
