import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { $Enums } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";

interface TipsterProfileSearchParams {
  picksPage: number;
  picksLimit: number;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return requireRole(req, $Enums.Role.TIPSTER, async (authUser) => {
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

    // Ocultar análisis premium si no es el dueño
    const picksWithAccess = picks.map((pick) => ({
      ...pick,
      analysis:
        pick.isPremium && user.id !== currentUserId ? null : pick.analysis,
      isPremiumLocked: pick.isPremium && user.id !== currentUserId,
    }));

    return NextResponse.json({
      success: true,
      data: {
        picks: picksWithAccess,
        pagination: {
          total: totalPicks,
          page: filters.picksPage,
          limit: filters.picksLimit,
          totalPages: Math.ceil(totalPicks / filters.picksLimit),
          hasMore: filters.picksPage * filters.picksLimit < totalPicks,
        },
      },
    });
  });
}
