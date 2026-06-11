import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const startTime = Date.now();

  // Intentar conectar a la base de datos
  let dbStatus: "connected" | "disconnected" = "disconnected";
  let dbError: string | null = null;

  try {
    // $queryRaw es la forma más ligera de verificar conexión
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = "connected";
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Error desconocido";
  }

  const responseTime = Date.now() - startTime;

  return NextResponse.json(
    {
      status: dbStatus === "connected" ? "ok" : "degraded",
      message:
        dbStatus === "connected"
          ? "🚀 Tipster Platform API funcionando correctamente"
          : "⚠️  API funcionando pero sin conexión a la base de datos",
      db: {
        status: dbStatus,
        ...(dbError && { error: dbError }),
      },
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      environment: process.env.NODE_ENV,
    },
    {
      status: dbStatus === "connected" ? 200 : 503,
    },
  );
}
