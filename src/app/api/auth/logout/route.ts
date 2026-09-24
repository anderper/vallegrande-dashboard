import { requireSameOrigin, sessionCookie } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/google-script';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    return Response.json({ success: true }, { headers: { 'Set-Cookie': sessionCookie('', 0), 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
