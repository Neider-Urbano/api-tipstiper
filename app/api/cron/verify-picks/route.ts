import prisma from "@/lib/prisma";
import { getFixtureById } from "@/lib/api-football";
import { NextRequest, NextResponse } from "next/server";
import { verifyPickResult } from "@/lib/pick-validator";
import { PickStatus } from "../../../../generated/prisma/client";
import {
  recalculateBettorStats,
  recalculateTipsterStats,
} from "@/lib/stats-calculator";

// Se ejecuta automáticamente cada hora via Vercel Cron.
// Configuración en vercel.json:

// También puede llamarse manualmente para testing:
// GET /api/cron/verify-picks
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

  const startTime = Date.now();
  const now = new Date();

  const result = {
    locked: 0, // picks bloqueados (partido por empezar)
    verified: 0, // picks verificados (WON / LOST / VOID)
    tipsterStatsUpdated: 0, // tipsters con stats recalculadas
    bettorStatsUpdated: 0, // bettors con stats recalculadas
    errors: [] as string[],
  };

  try {
    // ── PASO 1: Bloquear picks cuyo partido empieza en ≤ 5 minutos ───
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    const lockedResult = await prisma.pick.updateMany({
      where: {
        status: PickStatus.PENDING,
        matchDate: { lte: fiveMinutesFromNow },
      },
      data: {
        status: PickStatus.LOCKED,
        lockedAt: now,
      },
    });

    result.locked = lockedResult.count;

    // ── PASO 2: Buscar picks LOCKED cuyo partido ya debió terminar ───
    // Un partido de fútbol dura ~2h con descanso y tiempo añadido.
    // Solo consultamos picks de partidos que empezaron hace más de 2h.
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const pendingVerification = await prisma.pick.findMany({
      where: {
        status: PickStatus.LOCKED,
        matchDate: { lte: twoHoursAgo },
      },
      select: {
        id: true,
        matchId: true,
        tipsterId: true,
        pickType: true,
        pickValue: true,
        odds: true,
        stake: true,
      },
    });

    if (pendingVerification.length === 0) {
      return NextResponse.json({
        success: true,
        data: { ...result, duration: `${Date.now() - startTime}ms` },
      });
    }

    // ── PASO 3: Agrupar por matchId → 1 llamada API por partido ──────
    // Así si 5 tipsters pusieron pick en el mismo partido,
    // solo hacemos 1 llamada a API-Football en vez de 5.
    const uniqueMatchIds = [
      ...new Set(pendingVerification.map((p) => p.matchId)),
    ];

    // Obtener resultados de API-Football
    // Procesamos en batches de 10 para no saturar la API
    const fixtureMap: Record<
      string,
      Awaited<ReturnType<typeof getFixtureById>>
    > = {};

    for (let i = 0; i < uniqueMatchIds.length; i += 10) {
      const batch = uniqueMatchIds.slice(i, i + 10);

      await Promise.allSettled(
        batch.map(async (matchId) => {
          try {
            const fixture = await getFixtureById(Number(matchId));
            fixtureMap[matchId] = fixture;
          } catch (err) {
            result.errors.push(
              `Error obteniendo fixture ${matchId}: ${err instanceof Error ? err.message : "unknown"}`,
            );
          }
        }),
      );
    }

    // ── PASO 4: Verificar cada pick contra el resultado real ──────────
    const tipstersTouched = new Set<string>();
    const picksTouched = new Set<string>();

    for (const pick of pendingVerification) {
      const fixture = fixtureMap[pick.matchId];

      if (!fixture) {
        // No se pudo obtener el partido → intentar en la próxima ejecución
        continue;
      }

      const newStatus = verifyPickResult(
        pick.pickType,
        pick.pickValue,
        fixture,
      );

      // Si el partido sigue en curso → no cambiar nada todavía
      if (newStatus === PickStatus.LOCKED) continue;

      try {
        await prisma.pick.update({
          where: { id: pick.id },
          data: { status: newStatus },
        });

        result.verified++;
        tipstersTouched.add(pick.tipsterId);
        picksTouched.add(pick.id);
      } catch (err) {
        result.errors.push(
          `Error actualizando pick ${pick.id}: ${err instanceof Error ? err.message : "unknown"}`,
        );
      }
    }

    // ── PASO 5: Recalcular stats de tipsters afectados ────────────────
    // Solo recalculamos los tipsters cuyos picks cambiaron de estado.
    // Así no recalculamos innecesariamente a todos.
    for (const tipsterId of tipstersTouched) {
      try {
        await recalculateTipsterStats(tipsterId);
        result.tipsterStatsUpdated++;
      } catch (err) {
        result.errors.push(
          `Error recalculando stats de tipster ${tipsterId}: ${err instanceof Error ? err.message : "unknown"}`,
        );
      }
    }

    const bettorIds = new Set(
      (
        await prisma.bettorPick.findMany({
          where: {
            pickId: {
              in: [...picksTouched],
            },
          },
          select: {
            bettorId: true,
          },
        })
      ).map((b) => b.bettorId),
    );

    const bettorResults = await Promise.allSettled(
      [...bettorIds].map((bettorId) => recalculateBettorStats(bettorId)),
    );

    bettorResults.forEach((res, index) => {
      const bettorId = [...bettorIds][index];
      if (res.status === "fulfilled") {
        result.bettorStatsUpdated++;
      } else {
        result.errors.push(
          `Error recalculando stats de bettor ${bettorId}: ${res.reason instanceof Error ? res.reason.message : "unknown"}`,
        );
      }
    });

    const duration = Date.now() - startTime;

    // Log para Vercel — visible en el dashboard de logs
    console.log(
      `[CRON verify-picks] locked=${result.locked} verified=${result.verified} stats=${result.tipsterStatsUpdated} errors=${result.errors.length} duration=${duration}ms`,
    );

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        duration: `${duration}ms`,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("[CRON verify-picks] Error fatal:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Error interno del servidor",
        data: result,
      },
      { status: 500 },
    );
  }
}
