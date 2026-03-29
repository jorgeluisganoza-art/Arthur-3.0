export async function POST(request: Request) {
  try {
    const { email, code } = await request.json() as { email: string; code: string };

    if (!email || !code) {
      return Response.json({ success: false, error: 'Completa todos los campos' }, { status: 400 });
    }

    const validCode = process.env.ACCESS_CODE || 'ARTHUR2026';

    if (code.toUpperCase().trim() === validCode.toUpperCase().trim()) {
      return Response.json({ success: true });
    }

    return Response.json({ success: false, error: 'Código de acceso incorrecto' }, { status: 401 });
  } catch {
    return Response.json({ success: false, error: 'Error en la solicitud' }, { status: 500 });
  }
}
