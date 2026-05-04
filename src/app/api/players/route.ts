import { NextResponse } from 'next/server';

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
    
    // Le agregamos la acción que espera nuestro script
    const payload = {
      action: "ADD",
      ...body
    };

    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      // Es importante seguir la redirección porque Google Script siempre responde con un 302
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      }
    });

    const textResponse = await response.text();
    return NextResponse.json({ success: true, message: textResponse });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
