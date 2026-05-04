import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;

export async function GET() {
  try {
    if (!SCRIPT_URL) throw new Error("URL de Google Script no configurada");
    
    const response = await fetch(SCRIPT_URL, { cache: 'no-store' });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!SCRIPT_URL) throw new Error("URL de Google Script no configurada");

    const body = await request.json();

    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(body),
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      }
    });

    // Leer la respuesta como JSON
    const data = await response.json();
    
    // Devolvemos el JSON tal cual
    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
