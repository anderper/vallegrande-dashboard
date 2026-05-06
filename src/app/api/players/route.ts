import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;

export async function GET() {
  try {
    const response = await fetch(SCRIPT_URL || 'https://httpbin.org/json', { cache: 'no-store' });
    const data = await response.json();
    console.log("Datos de Google Sheets:", Array.isArray(data) ? `Array de ${data.length} items` : typeof data);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error en API Route:", error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const response = await fetch(SCRIPT_URL || '', {
      method: 'POST',
      body: JSON.stringify(body),
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      }
    });

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 200 });
  }
}
