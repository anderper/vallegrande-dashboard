import { buildRegistrationPdf } from '@/lib/registration-pdf';
import { documentBytes, errorResponse, findPlayer, ServiceError } from '@/lib/google-script';
import { missingRequirements, normalizeRut } from '@/lib/registration';
import { requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const maxDuration = 120;
export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const player = await findPlayer(new URL(request.url).searchParams.get('rut') || '');
    const missing = missingRequirements(player);
    if (missing.length) throw new ServiceError(`Falta completar: ${missing.join(', ')}.`, 422);
    let bytes;
    try { bytes = await buildRegistrationPdf(player, field => documentBytes(player, field)); }
    catch (error) { if (error instanceof ServiceError) throw error; throw new ServiceError(error instanceof Error ? error.message : 'No se pudo generar la ficha.', 422); }
    if (bytes.length > 4 * 1024 * 1024) throw new ServiceError('El expediente supera 4 MB. Reduce el tamaño del certificado o de las imágenes y vuelve a generar la ficha.', 413);
    return new Response(bytes as BodyInit, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Ficha_${normalizeRut(player.RUT)}.pdf"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return errorResponse(error); }
}
