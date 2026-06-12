import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "Tipster Platform API",
    version: "1.0.0",
    description:
      "El primer marketplace de tipsters verificados para Latinoamérica",
    status: "active",
    endpoints: {
      health: "GET /api/health — Estado del servidor y conexión a DB",
      auth: "POST /api/auth - auth",
      picks: "GET /api/picks - picks",
    },
    docs: "https://github.com/tu-usuario/tipster-platform",
    timestamp: new Date().toISOString(),
  });
}
