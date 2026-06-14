import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { PickStatus } from "../../../generated/prisma/client";

export enum FeedView {
  TIPSTERS = "tipsters",
  FEED = "feed",
  BOTH = "both",
}

interface FeedSearchParams {
  view: FeedView;
  page: number;
  limit: number;
  status: PickStatus | null;
}

export async function GET(req: NextRequest) {
  return requireAuth(req, async (authUser) => {
    const { searchParams } = new URL(req.url);

    // 2. Extraemos y parseamos garantizando que cumpla con la interfaz
    const filters: FeedSearchParams = {
      view: (searchParams.get("view") ?? "both") as FeedView,
      page: Math.max(1, Number(searchParams.get("page") ?? "1")),
      limit: Math.min(
        50,
        Math.max(1, Number(searchParams.get("limit") ?? "20")),
      ),
      status: searchParams.get("status") as PickStatus | null,
    };

    const skip = (filters.page - 1) * filters.limit;

    const validViews: FeedView[] = [
      FeedView.TIPSTERS,
      FeedView.FEED,
      FeedView.BOTH,
    ];

    if (!validViews.includes(filters.view)) {
      return NextResponse.json(
        {
          success: false,
          error: `view inválido. Opciones: ${validViews.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Obtener IDs de tipsters que sigo
    const follows = await prisma.follow.findMany({
      where: { followerId: authUser.userId },
      select: {
        id: true,
        createdAt: true,
        tipster: {
          select: {
            id: true,
            username: true,
            avatarUrl: true,
            bio: true,
            isVerified: true,
            subscriptionPrice: true,
            stats: {
              select: {
                yield: true,
                winRate: true,
                totalPicks: true,
                wonPicks: true,
                streak: true,
                unitsWon: true,
              },
            },
            picks: {
              orderBy: { publishedAt: "desc" },
              take: 1,
              select: { publishedAt: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const tipsterIds = follows.map((f) => f.tipster.id);

    // Si no sigo a nadie, responder rápido
    if (tipsterIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          tipsters: [],
          feed: {
            items: [],
            pagination: {
              total: 0,
              page: 1,
              limit: filters.limit,
              totalPages: 0,
              hasMore: false,
            },
          },
          totalFollowing: 0,
        },
      });
    }

    // ── Vista: solo tipsters ──────────────────────────────────────────
    if (filters.view === FeedView.TIPSTERS) {
      return NextResponse.json({
        success: true,
        data: {
          tipsters: follows.map((f) => f.tipster),
          totalFollowing: follows.length,
        },
      });
    }

    // ── Vista: feed de picks ──────────────────────────────────────────
    const validStatuses = Object.values(PickStatus);
    if (filters.status && !validStatuses.includes(filters.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `status inválido. Opciones: ${validStatuses.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const feedWhere = {
      tipsterId: { in: tipsterIds },
      ...(filters.status && { status: filters.status }),
    };

    const [feedPicks, totalFeed] = await Promise.all([
      prisma.pick.findMany({
        where: feedWhere,
        orderBy: { publishedAt: "desc" },
        skip,
        take: filters.limit,
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
          lockedAt: true,
          analysis: true,
          tipster: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
              stats: {
                select: { yield: true, winRate: true },
              },
            },
          },
        },
      }),
      prisma.pick.count({ where: feedWhere }),
    ]);

    // Ocultar análisis premium
    const feedWithAccess = feedPicks.map((pick) => ({
      ...pick,
      analysis:
        pick.isPremium && pick.tipster.id !== authUser.userId
          ? null
          : pick.analysis,
      isPremiumLocked: pick.isPremium && pick.tipster.id !== authUser.userId,
    }));

    const feed = {
      items: feedWithAccess,
      pagination: {
        total: totalFeed,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(totalFeed / filters.limit),
        hasMore: filters.page * filters.limit < totalFeed,
      },
    };

    // ── Vista: both (default) ─────────────────────────────────────────
    return NextResponse.json({
      success: true,
      data: {
        tipsters:
          filters.view === FeedView.FEED
            ? undefined
            : follows.map((f) => f.tipster),
        feed: feed,
        totalFollowing: follows.length,
      },
    });
  });
}
