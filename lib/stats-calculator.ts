import prisma from "./prisma";
import { PickStatus } from "@/generated/prisma/enums";

// Recalcula las estadísticas de un tipster desde cero
// basándose en todos sus picks verificados (WON / LOST).
// Se llama desde el cron job cada vez que un pick se resuelve.

export async function recalculateTipsterStats(
  tipsterId: string,
): Promise<void> {
  // Traer todos los picks resueltos del tipster
  const picks = await prisma.pick.findMany({
    where: {
      tipsterId,
      status: { in: [PickStatus.WON, PickStatus.LOST] },
    },
    select: {
      status: true,
      odds: true,
      stake: true,
    },
  });

  const totalPicks = picks.length;

  if (totalPicks === 0) {
    // Sin picks resueltos → resetear todo a 0
    await prisma.tipsterStats.upsert({
      where: { userId: tipsterId },
      update: {
        totalPicks: 0,
        wonPicks: 0,
        yield: 0,
        roi: 0,
        unitsWon: 0,
        winRate: 0,
        streak: 0,
      },
      create: { userId: tipsterId },
    });
    return;
  }

  const wonPicks = picks.filter((p) => p.status === PickStatus.WON).length;

  // Calcular profit y total apostado para yield
  // Yield = (profit total / total stake apostado) * 100
  let totalStake = 0;
  let profit = 0;

  picks.forEach((pick) => {
    const odds = Number(pick.odds);
    const stake = pick.stake;

    totalStake += stake;
    profit +=
      pick.status === PickStatus.WON
        ? stake * (odds - 1) // ganancia neta
        : -stake; // pérdida
  });

  const yieldPct =
    totalStake > 0 ? parseFloat(((profit / totalStake) * 100).toFixed(2)) : 0;

  const roi =
    totalStake > 0 ? parseFloat(((profit / totalPicks) * 100).toFixed(2)) : 0;

  const winRate = parseFloat(((wonPicks / totalPicks) * 100).toFixed(2));

  // Calcular racha actual
  // Ordenar por publishedAt desc para leer la racha desde el pick más reciente
  const recentPicks = await prisma.pick.findMany({
    where: { tipsterId, status: { in: [PickStatus.WON, PickStatus.LOST] } },
    orderBy: { publishedAt: "desc" },
    select: { status: true },
  });

  let streak = 0;
  const firstStatus = recentPicks[0]?.status;

  for (const pick of recentPicks) {
    if (pick.status === firstStatus) {
      streak += pick.status === PickStatus.WON ? 1 : -1;
    } else {
      break; // la racha se rompió
    }
  }

  await prisma.tipsterStats.upsert({
    where: { userId: tipsterId },
    update: {
      totalPicks,
      wonPicks,
      yield: yieldPct,
      roi,
      unitsWon: parseFloat(profit.toFixed(2)),
      winRate,
      streak,
    },
    create: {
      userId: tipsterId,
      totalPicks,
      wonPicks,
      yield: yieldPct,
      roi,
      unitsWon: parseFloat(profit.toFixed(2)),
      winRate,
      streak,
    },
  });
}
