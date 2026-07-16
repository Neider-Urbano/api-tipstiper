import prisma from "@/lib/prisma";
import { computeBadge } from "@/lib/tipster-badge";
import { NextRequest, NextResponse } from "next/server";

// Se ejecuta automáticamente cada hora via Vercel Cron.
// Configuración en vercel.json:

// También puede llamarse manualmente para testing:
// GET /api/cron/recalculate-badges
// Authorization: Bearer <CRON_SECRET>

export async function GET(req: NextRequest) {
  // ── Seguridad: solo Vercel Cron o llamada con CRON_SECRET ──────────
  // Vercel envía automáticamente el header authorization en los cron jobs
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  try {
    // 1. Traer todas las stats con suficientes picks
    const allStats = await prisma.tipsterStats.findMany({
      where: { totalPicks: { gte: 20 } },
      select: {
        id: true,
        totalPicks: true,
        wonPicks: true,
        winRate: true,
        yield: true,
      },
    });

    if (allStats.length === 0) {
      return NextResponse.json({ message: "No stats found", updated: 0 });
    }

    // 2. Yields para percentiles
    const allYields = allStats.map((s) => Number(s.yield));

    // 3. Calcular y persistir badges en batch
    await Promise.all(
      allStats.map((stats) => {
        const badge = computeBadge(
          {
            totalPicks: stats.totalPicks,
            wonPicks: stats.wonPicks,
            winRate: Number(stats.winRate),
            yield: Number(stats.yield),
          },
          allYields,
        );

        return prisma.tipsterStats.update({
          where: { id: stats.id },
          data: {
            badge,
            badgeUpdatedAt: new Date(),
          },
        });
      }),
    );

    return NextResponse.json({
      message: "Badges recalculated",
      updated: allStats.length,
    });
  } catch (error) {
    console.error("[CRON recalculate-badges] Error fatal:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 },
    );
  }
}
