import { authConfigured, checkPassword, createSession, requireSameOrigin, sessionCookie } from '@/lib/admin-auth';
import { errorResponse, ServiceError } from '@/lib/google-script';

export const runtime = 'nodejs';
// Local throttling supplements a long random password. Each server instance has
// its own counters; use Vercel Firewall for a shared deployment-wide rate limit.
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!authConfigured()) throw new ServiceError('El club todavía está configurando la clave del dashboard.', 503);
    const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for') || 'local';
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
    if (attempts.size > 10000 || (attempts.get(ip)?.count || 0) >= 10) return Response.json({ success: false, error: 'Demasiados intentos. Espera 15 minutos.' }, { status: 429, headers: { 'Retry-After': '900', 'Cache-Control': 'no-store' } });
    const entry = attempts.get(ip) || { count: 0, until: now + 900000 };
    entry.count++; attempts.set(ip, entry);
    if (Number(request.headers.get('content-length')) > 2048) throw new ServiceError('Solicitud demasiado grande.', 413);
    const text = await request.text();
    if (text.length > 2048) throw new ServiceError('Solicitud demasiado grande.', 413);
    let body;
    try { body = JSON.parse(text); } catch { throw new ServiceError('Solicitud inválida.', 400); }
    if (typeof body?.password !== 'string' || !checkPassword(body.password)) throw new ServiceError('Clave incorrecta.', 401);
    attempts.delete(ip);
    return Response.json({ success: true }, { headers: { 'Set-Cookie': sessionCookie(createSession()), 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
