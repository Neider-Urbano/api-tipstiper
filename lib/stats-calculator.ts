import prisma from "./prisma";
import { PickStatus, SubStatus } from "@/generated/prisma/enums";

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
    totalStake > 0
      ? Number.parseFloat(((profit / totalStake) * 100).toFixed(2))
      : 0;

  const roi =
    totalStake > 0
      ? Number.parseFloat(((profit / totalPicks) * 100).toFixed(2))
      : 0;

  const winRate = Number.parseFloat(((wonPicks / totalPicks) * 100).toFixed(2));

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
      unitsWon: Number.parseFloat(profit.toFixed(2)),
      winRate,
      streak,
    },
    create: {
      userId: tipsterId,
      totalPicks,
      wonPicks,
      yield: yieldPct,
      roi,
      unitsWon: Number.parseFloat(profit.toFixed(2)),
      winRate,
      streak,
    },
  });
}

export async function recalculateBettorStats(bettorId: string) {
  const now = new Date();

  const firstDayOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
    0,
    0,
    0,
  );

  const [activeSubscriptions, newSubscriptionsThisMonth, bettorPicks] =
    await Promise.all([
      prisma.subscription.count({
        where: {
          bettorId,
          status: SubStatus.ACTIVE,
        },
      }),

      prisma.subscription.count({
        where: {
          bettorId,
          startedAt: {
            gte: firstDayOfMonth,
          },
        },
      }),

      prisma.bettorPick.findMany({
        where: {
          bettorId,
        },
        include: {
          pick: {
            select: {
              status: true,
            },
          },
        },
      }),
    ]);

  const followedPicks = bettorPicks.length;

  const resolvedPicks = bettorPicks.filter(
    (p) =>
      p.pick.status === PickStatus.WON || p.pick.status === PickStatus.LOST,
  );

  const wonPicks = resolvedPicks.filter(
    (p) => p.pick.status === PickStatus.WON,
  ).length;

  const followedWinRate =
    resolvedPicks.length > 0 ? (wonPicks / resolvedPicks.length) * 100 : 0;

  let invested = 0;
  let profit = 0;

  for (const item of resolvedPicks) {
    const stake = Number(item.stake);
    const odds = Number(item.odds);

    invested += stake;

    if (item.pick.status === PickStatus.WON) {
      profit += stake * (odds - 1);
    } else {
      profit -= stake;
    }
  }

  const roi = invested > 0 ? (profit / invested) * 100 : 0;

  await prisma.bettorStats.upsert({
    where: {
      userId: bettorId,
    },
    update: {
      activeSubscriptions,
      newSubscriptionsThisMonth,
      followedPicks,
      totalProfitLoss: Number.parseFloat(profit.toFixed(2)),
      roi: Number.parseFloat(roi.toFixed(2)),
      followedWinRate: Number.parseFloat(followedWinRate.toFixed(2)),
    },
    create: {
      userId: bettorId,
      activeSubscriptions,
      newSubscriptionsThisMonth,
      followedPicks,
      totalProfitLoss: Number.parseFloat(profit.toFixed(2)),
      roi: Number.parseFloat(roi.toFixed(2)),
      followedWinRate: Number.parseFloat(followedWinRate.toFixed(2)),
    },
  });
}
