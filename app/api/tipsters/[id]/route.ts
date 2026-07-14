import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { $Enums } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { PickStatus } from "../../../../generated/prisma/client";

interface TipsterProfileSearchParams {
  picksPage: number;
  picksLimit: number;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { searchParams } = new URL(req.url);
  const { id } = await context.params;

  const filters: TipsterProfileSearchParams = {
    picksPage: Math.max(1, Number(searchParams.get("picksPage") ?? "1")),
    picksLimit: Math.min(
      20,
      Math.max(1, Number(searchParams.get("picksLimit") ?? "10")),
    ),
  };

  const picksSkip = (filters.picksPage - 1) * filters.picksLimit;

  // Usuario autenticado (opcional — para mostrar análisis premium)
  const authUser = getAuthUser(req);
  const currentUserId = authUser?.userId ?? null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      bio: true,
      avatarUrl: true,
      isVerified: true,
      subscriptionPrice: true,
      createdAt: true,
      role: true,
      stats: true,
    },
  });

  if (!user || user.role !== $Enums.Role.TIPSTER) {
    return NextResponse.json(
      { success: false, error: "Tipster no encontrado" },
      { status: 404 },
    );
  }

  // Picks del tipster con paginación
  const [picks, totalPicks] = await Promise.all([
    prisma.pick.findMany({
      where: { tipsterId: user.id },
      orderBy: { publishedAt: "desc" },
      skip: picksSkip,
      take: filters.picksLimit,
      select: {
        id: true,
        matchDate: true,
        league: true,
        homeTeam: true,
        awayTeam: true,
        pickType: true,
        pickValue: true,
        odds: true,
        stake: true,
        isPremium: true,
        status: true,
        publishedAt: true,
        analysis: true,
      },
    }),
    prisma.pick.count({ where: { tipsterId: user.id } }),
  ]);

  // Historial de rendimiento por mes (últimos 6 meses)
  // para mostrar la gráfica de evolución en el perfil
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentPicks = await prisma.pick.findMany({
    where: {
      tipsterId: user.id,
      status: { in: [PickStatus.WON, PickStatus.LOST] },
      publishedAt: { gte: sixMonthsAgo },
    },
    orderBy: { publishedAt: "asc" },
    select: {
      status: true,
      odds: true,
      stake: true,
      publishedAt: true,
    },
  });

  // Calcular rendimiento acumulado mes a mes
  const monthlyPerformance = buildMonthlyPerformance(recentPicks);

  // Ocultar análisis premium si no es el dueño
  const picksWithAccess = picks.map((pick) => ({
    ...pick,
    analysis:
      pick.isPremium && user.id !== currentUserId ? null : pick.analysis,
    isPremiumLocked: pick.isPremium && user.id !== currentUserId,
  }));

  // Contar seguidores
  const followersCount = await prisma.follow.count({
    where: { tipsterId: user.id },
  });

  // ¿El usuario autenticado ya sigue a este tipster?
  const isFollowing = currentUserId
    ? await prisma.follow
        .findUnique({
          where: {
            followerId_tipsterId: {
              followerId: currentUserId,
              tipsterId: user.id,
            },
          },
        })
        .then((f) => !!f)
    : false;

  return NextResponse.json({
    success: true,
    data: {
      tipster: {
        ...user,
        followersCount,
        isFollowing,
      },
      picks: {
        items: picksWithAccess,
        pagination: {
          total: totalPicks,
          page: filters.picksPage,
          limit: filters.picksLimit,
          totalPages: Math.ceil(totalPicks / filters.picksLimit),
          hasMore: filters.picksPage * filters.picksLimit < totalPicks,
        },
      },
      monthlyPerformance,
    },
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

interface PickForChart {
  status: string;
  odds: unknown;
  stake: number;
  publishedAt: Date;
}

function buildMonthlyPerformance(picks: PickForChart[]) {
  const months: Record<
    string,
    { month: string; won: number; lost: number; yield: number; profit: number }
  > = {};

  picks.forEach((pick) => {
    const key = pick.publishedAt.toLocaleDateString("es-CO", {
      year: "numeric",
      month: "short",
      timeZone: "America/Bogota",
    });

    if (!months[key]) {
      months[key] = { month: key, won: 0, lost: 0, yield: 0, profit: 0 };
    }

    const odds = Number(pick.odds);
    const stake = pick.stake;

    if (pick.status === PickStatus.WON) {
      months[key].won += 1;
      months[key].profit += stake * (odds - 1);
    } else {
      months[key].lost += 1;
      months[key].profit -= stake;
    }
  });

  // Calcular yield por mes
  return Object.values(months).map((m) => ({
    ...m,
    yield:
      m.won + m.lost > 0
        ? parseFloat(((m.profit / (m.won + m.lost)) * 100).toFixed(2))
        : 0,
  }));
}
