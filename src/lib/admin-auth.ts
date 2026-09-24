import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ServiceError } from './google-script';

export const SESSION_COOKIE = 'vg_admin';
export const SESSION_SECONDS = 8 * 60 * 60;
const digest = (value: string) => createHash('sha256').update(value).digest();
function password() {
  const value = process.env.ADMIN_PASSWORD;
  return value && value.length >= 16 ? value : undefined;
}
export function authConfigured() { return !!password(); }
export function checkPassword(value: string) {
  const secret = password();
  return !!secret && timingSafeEqual(digest(value), digest(secret));
}
function sign(payload: string) {
  const secret = password();
  if (!secret) throw new ServiceError('El acceso administrativo aún no está configurado.', 503);
  return createHmac('sha256', secret).update(`vallegrande-admin-v1:${payload}`).digest('base64url');
}
export function createSession(now = Date.now()) {
  const payload = `${Math.floor(now / 1000) + SESSION_SECONDS}.${randomBytes(24).toString('base64url')}`;
  return `${payload}.${sign(payload)}`;
}
export function validSession(token: string | undefined, now = Date.now()) {
  if (!password() || !token || token.length > 200) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[\w-]{32}$/.test(parts[1])) return false;
  const expires = Number(parts[0]), seconds = Math.floor(now / 1000);
  if (expires <= seconds || expires > seconds + SESSION_SECONDS) return false;
  return timingSafeEqual(digest(parts[2]), digest(sign(`${parts[0]}.${parts[1]}`)));
}
export function isAdmin(request: Request) {
  const cookie = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`));
  return validSession(cookie?.slice(SESSION_COOKIE.length + 1));
}
export function requireAdmin(request: Request) {
  if (!isAdmin(request)) throw new ServiceError('Inicia sesión para acceder al dashboard.', 401);
}
export function requireSameOrigin(request: Request) {
  // Next can use an internal hostname in request.url behind its HTTP server.
  // Host represents the site requested by the browser; Vercel supplies the
  // original protocol in x-forwarded-proto after terminating HTTPS.
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  const protocol = request.headers.get('x-forwarded-proto') || url.protocol.slice(0, -1);
  if (!['http', 'https'].includes(protocol) || request.headers.get('origin') !== `${protocol}://${host}`) throw new ServiceError('Solicitud de otro sitio no permitida.', 403);
}
export function sessionCookie(token: string, maxAge = SESSION_SECONDS) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}
