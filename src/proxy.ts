import { NextResponse, type NextRequest } from 'next/server';
import { isAdmin } from './lib/admin-auth';

export function proxy(request: NextRequest) {
  const response = isAdmin(request) ? NextResponse.next() : NextResponse.redirect(new URL('/login', request.url));
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/'] };
